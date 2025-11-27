// src/config.js

export const API_BASE =
  import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:3000";

// Auth endpoints
export const LOGIN_PATH =
  import.meta.env.VITE_LOGIN_PATH || "/api/users/login";

export const REGISTER_PATH =
  import.meta.env.VITE_REGISTER_PATH || "/api/users/create";

export const PROFILE_PATH =
  import.meta.env.VITE_PROFILE_PATH || "/api/users/me";

// Other endpoints
export const GET_LIST_ASSISTANT_PATH =
  import.meta.env.GET_LIST_ASSISTANT_PATH || "/api/assistants";
export const POST_SESSION_PATH =
  import.meta.env.POST_SESSION_PATH || "/api/sessions";
export const POST_STREAM_CHAT_PATH =
  import.meta.env.POST_STREAM_CHAT_PATH || "/api/chats/stream";
export const POST_STREAM_CHAT_V2_PATH =
  import.meta.env.POST_STREAM_CHAT_V2_PATH || "/api/chats/v2/stream";
export const GET_LIST_HISTORY_PATH =
  import.meta.env.GET_LIST_HISTORY_PATH || "/api/chats/history";
export const GET_LIST_MESSAGE_PER_SESSION_PATH =
  import.meta.env.GET_LIST_MESSAGE_PER_SESSION_PATH || "/api/chats/messages";
export const GET_CHAT_HIST_REPORT_PATH =
  import.meta.env.GET_CHAT_HIST_REPORT_PATH || "/api/chats/history/report";
export const POST_UPDATE_CHAT_TITLE_PATH =
  import.meta.env.POST_UPDATE_CHAT_TITLE_PATH || "/api/chats/title/update";
export const GET_EXPORT_ALL_CHAT_PATH =
  import.meta.env.GET_EXPORT_ALL_CHAT_PATH || "/api/chats/history/all/report";

export const POST_CREATE_USER =
  import.meta.env.POST_CREATE_USER || "/api/users/create";
export const GET_LIST_USERS =
  import.meta.env.GET_LIST_USERS || "/api/users/list";
