const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const Pdfkit = require('pdfkit');
const moment = require('moment');

const { OPENAI_MODEL, REPORT_FOLDER_PATH } = require('../../config');
const { asssistantMap } = require('../assistant/assistant.controller');

const { formatFileName } = require('../../utils/report-util');
const { convertDocxToPdf } = require('../../utils/pdf-util');
const { zip } = require('../../utils/archive-util');

const { doTriggerOcr } = require('../../services/ocr-space/ocr-space');
const { uploadToWorkDrive } = require('../../services/zoho/workdrive/workdrive-upload');

const { findChat, addChat, getAllChats, saveChat, getAllChatByAssistant, deleteChat } = require('../../models/chats/chat.model');
const { addMessage, findMessageByChatId, deleteMessage } = require('../../models/messages/message.model');
const { addUpload, deleteUpload } = require('../../models/uploads/upload.model');
const { getAsisstantKeyById, getListOfAssistant } = require('../../models/assistants/assistant.model');
const { getUserById } = require('../../models/users/user.model');
const { deleteSession } = require('../../models/sessions/session.model');

// ***************************
// Start Controller Function
async function doCreateNewChat(chatConfig) {

  const { userId, assistantId, sessionId, title } = chatConfig;
  
  let existingChat = await findChat({ sessionId });
  if (!existingChat) {
    existingChat = await addChat({
      title,
      userId,
      sessionId,
      assistantId
    });
  }

  return existingChat;
}

async function doStreamChat(req, res) {
  try {
    const { userId, assistantId, sessionId, message } = req.body;
    const systemPromptIns = loadSystemPrompt(assistantId);
    const vectorStoreIds = loadVectorId(assistantId);
    const projectApiKey = loadProjectKey(assistantId);

    let existingChat = await doCreateNewChat({ userId, assistantId, sessionId });
    let history = await findMessageByChatId({ chatId: existingChat._id, isOcr: false }, {createdAt: 0, chatId: 0, updatedAt: 0});

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const client = new OpenAI({ apiKey: projectApiKey });

    const clientConfig = {
        model: OPENAI_MODEL,
        instructions: systemPromptIns,
        input: [
            { role: 'system', content: 'Answer strictly from your system knowledge.' },
            ...history,
            { 
              role: 'user', 
              content: message,  
            }
        ],
        stream: true,
    };

    if (vectorStoreIds) {
      clientConfig['tools'] = [{
          "type": "file_search",
          "vector_store_ids": vectorStoreIds
      }];
    }

    let stream = null;
    let isRetry = true;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    while (isRetry) {
      try {
        stream = await doCallOpenAI(client, clientConfig);
        isRetry = false;
      } catch (err) {
        const is429 = err?.status === 429 || err?.code === 'rate_limit_exceeded';

        const resetHeader = err?.headers?.['x-ratelimit-reset-tokens'];
        const delay = resetHeader ? Number(resetHeader) * 1000 : 6000;

        console.log(`OpenAI token TPM need delay: ${delay}`);
        console.log(`${is429}, error code: ${err?.status}, ${err?.code}`);

        await sleep(delay);
      }
    }
    
    // Store User Messages
    addMessage({
      chatId: existingChat?._id,
      role: 'user',
      content: message,
      isOcr: false
    });
    
    let msg = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        msg += event.delta;
        res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
      } else if (event.type === 'response.completed') {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } else if (event.type === 'error') {
        res.write(`data: ${JSON.stringify({ error: event.error })}\n\n`);
      }
    }

    // Store Assistant Messages
    addMessage({
      chatId: existingChat?._id.toString(),
      role: 'assistant',
      content: msg,
      isOcr: false
    });

    // console.log(msg);
    return res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
}

async function doGetChatHistory(req, res) {
  const { assistantId, userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      message: 'Please provide valid userId'
    });
  }

  // check user id is admin or not
  const user = await getUserById(userId);
  if (!user) {
    return res.status(400).json({
      message: 'Please provide valid userId'
    });
  }

  const isAdmin = (user?.role?.toLowerCase() === 'admin') ? true : false;
  const chatHistories = await getAllChats({ userId, assistantId, isAdmin });

  return res.status(200).json({
    data: chatHistories
  });
}

async function doGetChatMessages(req, res) {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({
      message: 'Please provide valid chatId'
    });
  }

  const chatMessages = await findMessageByChatId({chatId, isOcr: false});

  return res.status(200).json({
    data: chatMessages
  });
}

async function doGenerateConversationHistoryReport(req, res) {
  const { sessionId } = req.params;
  let existingChat = await findChat({ sessionId });
  if (!existingChat) {
    return res.status(400).json({ 
      message: 'No Chat History Found.'
    });
  }

  const chatMessages = await findMessageByChatId({chatId: existingChat._id, $expr: { $eq: [{ $ifNull: ["$isOcr", false] }, false] } });
  const assistant = await getAsisstantKeyById(existingChat.assistantId);

  if (chatMessages && chatMessages.length > 1) {
    
    try {
      const fileName = formatFileName(`${existingChat?.title}`);
      const file = path.join(__dirname, '..', '..', '..', REPORT_FOLDER_PATH, fileName);

      const stream = fs.createWriteStream(file);

      doGenerateReport(stream, existingChat, assistant, chatMessages);

      stream.on('finish', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.sendFile(file);
      });

      stream.on('error', (err) => {
        console.error('PDF write error:', err);
        res.status(500).json({ message: 'Error writing PDF' });
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        message: 'Error on system handling'
      })
    }
  }
}

async function doUpdateChatTitle(req, res) {

  const { sessionId, title } = req.body;

  try {
    let existingChat = await findChat({ sessionId });
    
    if (!existingChat) {
      return res.status(400).json({
        message: 'Chat Session does not exist.'
      });
    }
    
    if (existingChat) {
      existingChat.title = title;

      await saveChat(existingChat);
    }

    return res.status(200).json({
      message: 'Succesfully Updated Chat Session Title',
      data: existingChat
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update chat title.'
    });
  }
}

async function doStreamChatV2(req, res) {
  try {
    // console.log(`API started at ${Date.now()} ms:`);
    // Start get-set (payload & file upload)
    const payload = req.body?.payload;
    let body = {};
    if (typeof payload === 'string') {
      try {
        body = JSON.parse(payload);
      } catch {
        return res.status(400).json({ error: "Invalid JSON in 'payload'." });
      }
    }

    if (!body?.userId || !body?.assistantId || !body?.sessionId) {
      return res.status(400).json({ error: 'invalid field.'});
    }

    let fileObjs = [];
    if (req.files) {
      req.files.forEach(file => {
        let fileObj = {
          originalname: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          destination: file.destination
        }

        fileObjs.push(fileObj);
      });
      
    }
    // End get-set (payload & file upload)


    const { userId, assistantId, sessionId, message } = body;
    const systemPromptIns = loadSystemPrompt(assistantId);
    const vectorStoreIds = loadVectorId(assistantId);
    const projectApiKey = loadProjectKey(assistantId);

    let content = message;

    let existingChat = await doCreateNewChat({ userId, assistantId, sessionId });
    let history = await findMessageByChatId({ chatId: existingChat._id, isOcr: false}, {createdAt: 0, chatId: 0, updatedAt: 0, isOcr: 0});
    let curAssistant = await getAsisstantKeyById(assistantId);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Handling the Upload & OCR (if uploaded)
    let isOcr = false;
    for (const fileObj of fileObjs) {
      if (fileObj?.path) {
        // convert word into pdf if word file.
        if (fileObj?.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const fileNameUp = (fileObj?.filename.split('.')[0])?.trim() + '.pdf';
          const docFilePath = fileObj?.path;
          const pdfFilePath = `${fileObj?.destination}\\${fileNameUp}`;
          await convertDocxToPdf(docFilePath, pdfFilePath);
          fileObj.path = pdfFilePath;
          fileObj.filename = fileNameUp;
        }

        let filePath = fileObj?.path;

        const pdfPath = filePath;

        let ocrText = await doTriggerOcr(pdfPath);
        if (ocrText) {
          isOcr = true;
          content += '\r\n\r\n' + ocrText;
        }
      }
    };

    if (!content) {
      return res.status(400).json({ error: 'message/file required'});
    }
    
    const client = new OpenAI({ apiKey: projectApiKey });
    const clientConfig = {
        model: OPENAI_MODEL,
        instructions: systemPromptIns,
        input: [
            { role: 'system', content: 'Answer strictly from your system knowledge.' },
            ...history,
            { 
              role: 'user', 
              content: content,  
            }
        ],
        stream: true,
    };

    if (vectorStoreIds) {
      clientConfig['tools'] = [{
          "type": "file_search",
          "vector_store_ids": vectorStoreIds
      }];
    }

    // console.log(`Stream started at ${Date.now()} ms:`);
    let stream = null;
    let isRetry = true;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    while (isRetry) {
      try {
        stream = await doCallOpenAI(client, clientConfig);
        isRetry = false;
      } catch (err) {
        const is429 = err?.status === 429 || err?.code === 'rate_limit_exceeded';

        const resetHeader = err?.headers?.['x-ratelimit-reset-tokens'];
        const delay = resetHeader ? Number(resetHeader) * 1000 : 6000;

        console.log(err?.code);
        console.log(err?.status);
        console.log(`OpenAI token TPM need delay: ${delay}`);
        console.log(`${is429}, error code: ${err?.status}, ${err?.code}`);

        await sleep(delay);
      }
    }

    // isFirstReply & no history messages, the first message will be isOcr = true (ex: FM Clinic Case)
    if (history.length === 0 && curAssistant && curAssistant?.isFirstReply === true) {
      isOcr = true;
    }  

    // Store User Messages
    const userMsg = await addMessage({
      chatId: existingChat?._id,
      role: 'user',
      content: content,
      isOcr: isOcr 
      // if upload docs meaning OCR & skip from display chat history like OpenAI
      // also for isFirstReply use flag isOcr
    });

    if (userMsg && fileObjs?.length) {
      for (const fileObj of fileObjs) {
        await addUpload({
          messageId: userMsg?._id,
          originalFileName: fileObj?.originalname,
          uploadedFileName: fileObj?.filename,
          destination: fileObj?.destination
        });
      }
    }
    
    let msg = '';
    if (stream) {
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          msg += event.delta;
          res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
          res.flush?.();
        } else if (event.type === 'response.completed') {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        } else if (event.type === 'error') {
          res.write(`data: ${JSON.stringify({ error: event.error })}\n\n`);
        }
      }
    }
    // console.log(`Stream ended at ${Date.now()} ms:`);

    // Store Assistant Messages
    await addMessage({
      chatId: existingChat?._id.toString(),
      role: 'assistant',
      content: msg,
      isOcr: false
    });

    // console.log('\r\n\r\n ----OPENAI RESPONSE: \r\n\r\n');
    // console.log(msg);
    // console.log(`API ended at ${Date.now()} ms:`);
    return res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
}

async function doGenerateALLConversationHistoryReport(req, res) {
  /**
  RULE & FLOW:
  // Generate Report Tree Level
  // -> Folder format (EXP_ALL_CHAT_{yyyymmdd})
  //    -> Assistant Level
  //        -> User Level (all pdf report in here)
  // All Report assigned to the linked folder
  // zip the folder exported
  // Delete all chat + message + upload records
  // download / upload into google drive
  */

  try {
    const pathSegments = [
      __dirname,
      '..',
      '..',
      '..',
      REPORT_FOLDER_PATH,
      'EXP_ALL_CHAT'
    ];
    
    const folderExport = path.join(...pathSegments);
    if (!fs.existsSync(folderExport)) fs.mkdirSync(folderExport, { recursive: true });

    const tmF = `${moment(new Date()).format('YYYYMMDD')}`;
    const pathSegmentsTM = [...pathSegments, tmF];
    const folderExportAll = path.join(...pathSegmentsTM);
    if (!fs.existsSync(folderExportAll)) fs.mkdirSync(folderExportAll, { recursive: true });

    // Generate Assistant/Users/{report} level
    const listOfAssistant = await getListOfAssistant([], { enabled: true });
    for (const assistant of listOfAssistant) {
      
      const asssistantCode = assistant?.code;

      const folderAssistant = path.join(...pathSegmentsTM, asssistantCode);
      if (!fs.existsSync(folderAssistant)) fs.mkdirSync(folderAssistant, { recursive: true });

      // list of chat by assistant
      const chatAssistants = await getAllChatByAssistant({ assistantId: assistant?._id });

      let iteration = 1;
      for (const chatAsst of chatAssistants) {

        const userFolder = [...pathSegmentsTM, asssistantCode, chatAsst?.users?.username];
        const userNameFolder = path.join(...userFolder);
        if (!fs.existsSync(userNameFolder)) fs.mkdirSync(userNameFolder, { recursive: true });

        if (chatAsst && chatAsst?.messages?.length > 1) {
          
          const fileName = formatFileName(`chat_${moment(chatAsst?.createdAt).format('yyyymmdd')}_${iteration}`);
          const file = path.join(...userFolder, fileName);

          const stream = fs.createWriteStream(file);

          const chat = {
            users,
            messages,
            ...filter
          } = chatAsst;

          await doGenerateReport(stream, chat, assistant, chatAsst?.messages);
          iteration++;
        }
      }
    }

    const zipPath = path.join(...pathSegments, `${tmF}.zip`);
    const output = fs.createWriteStream(zipPath);

    zip(folderExportAll, output);

    output.on('close', async () => {
      fs.rm(folderExportAll, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error('Error deleting folder:', err);
        } else {
          console.log('Folder and its contents deleted successfully');
        }
      });

      // upload to ULINK Zoho WorkDrive
      await uploadToWorkDrive(zipPath, `${tmF}.zip`);
    });

    // delete all records
    // Upload -> Message -> Chat -> Session
    await deleteUpload();
    await deleteMessage();
    await deleteChat();
    await deleteSession();

    return res.status(200).json({
      message: 'Succesfull Export All Chat Conversation',
      path: `${zipPath}`
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'System Error during process Export All Chat'});
  }
}

// End Controller Function
// ***************************



// ***************************
// Start UTIL Function
async function doGenerateReport(stream, existingChat, assistant, chatMessages) {

  try {
    const doc = new Pdfkit({ size: "A4", margin: 48 });

    doc.pipe(stream);

    const timeNRoman = path.join(__dirname, '..', '..', '..', 'fonts', 'times.ttf');
    const timeNRomanBold = path.join(__dirname, '..', '..', '..', 'fonts', 'timesbd.ttf');

    const margin = 48;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const maxW = pageW - margin * 2;

    doc.font(timeNRomanBold).fontSize(16).text(`Chat with ${assistant?.displayName || "Assistant"}`, margin);
    doc.moveDown(0.6);
    doc.font(timeNRoman).fontSize(11).text(`Started: ${moment(existingChat.createdAt).format('DD/MM/YYYY HH:MM')}`, margin);
    doc.moveDown(0.4);
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).strokeColor("#dddddd").stroke();
    doc.moveDown(0.6);

    doc.fontSize(12);
    for (const m of (chatMessages || [])) {
      doc.font(timeNRomanBold).text(`(${moment(m.createdAt).format('DD/MM/YYYY HH:MM')}) - `, { continued: true });
      doc.font(timeNRomanBold).text(m.role === "user" ? "User:" : "Assistant:", { width: maxW });
      doc.moveDown(0.2);
      doc.font(timeNRoman).text(String(m.content ?? ""), { width: maxW });
      doc.moveDown(0.7);
      if (doc.y > pageH - margin) doc.addPage();
    }

    doc.moveDown(1);
    doc.fontSize(10).fillColor("#777777").text("Generated by Ulink Assist", margin, pageH - margin, { lineBreak: false });

    doc.end();
  } catch (err) {
    console.log(err); 
    throw err;
  }
}

async function doCallOpenAI(client, clientConfig) {
  return await client.responses.create(clientConfig);
}

function loadSystemPrompt(assistantId) {

    let systemPrompt;
    if (assistantId) {
      const asstConf = asssistantMap.get(assistantId);

      if (asstConf && asstConf?.systemPromptFile) {
        systemPrompt = asstConf?.systemPromptFile;
      }
    }
    
    if (systemPrompt) {
      const systemPromptPath = path.join(__dirname, '..', '..', '..', 'prompts', systemPrompt);
      if (!fs.existsSync(systemPromptPath)) {
        return '';
      } else {
        return fs.readFileSync(systemPromptPath, 'utf-8');
      }
    }
}

function loadVectorId(assistantId) {
  let vectorId;
  if (assistantId) {
    const asstConf = asssistantMap.get(assistantId);

    vectorId = asstConf?.vectorStoreId;
    vectorId = vectorId.split(',');
  }

  return vectorId;
}

function loadProjectKey(assistantId) {
  let projectKey;
  if (assistantId) {
    const asstConf = asssistantMap.get(assistantId);

    projectKey = asstConf?.apiKey;
  }

  return projectKey;
}
// End UTIL Function
// ***************************

module.exports = {
  doStreamChat,
  doGetChatHistory,
  doGetChatMessages,
  doGenerateConversationHistoryReport,
  doGenerateALLConversationHistoryReport,
  doUpdateChatTitle,
  doCreateNewChat,

  // V2
  doStreamChatV2,  
};