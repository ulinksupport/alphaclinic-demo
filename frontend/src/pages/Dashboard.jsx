// src/pages/Dashboard.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, clearAuth, getUser } from "../api";

const ALPHA_IFRAME_URL =
  "https://chat.lindy.ai/embed/6923e2271b8eea1141106520";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
    }
  }, [navigate]);

  const user = getUser();

  const GOLD = "#FECE54";
  const GOLD_SOFT = "#FCE59E";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(circle at top, #1b1410 0%, #050506 45%, #020203 100%)",
        color: "#f9fafb",
        fontFamily:
          '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(5, 5, 7, 0.95)",
          borderBottom: `1px solid rgba(254, 206, 84, 0.28)`,
          backdropFilter: "blur(14px)",
          boxShadow: "0 18px 45px rgba(0,0,0,0.75)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Logo */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              padding: 2,
              background:
                "conic-gradient(from 180deg at 50% 50%, #FECE54, #FCE59E, #FECE54)",
              boxShadow: "0 0 18px rgba(254, 206, 84, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/alpha-logo.png"
              alt="Alpha Clinic Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: "999px",
                backgroundColor: "#050507",
              }}
            />
          </div>

          {/* Title + User */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: GOLD_SOFT,
                opacity: 0.9,
              }}
            >
              The Alpha Clinic
            </span>
            <strong style={{ fontSize: 18, marginTop: 2, color: "#fdfdfd" }}>
              Clinical AI Console
            </strong>
            {user && (
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.75,
                  marginTop: 4,
                }}
              >
                Logged in as{" "}
                <span style={{ color: GOLD, fontWeight: 600 }}>
                  {user.username}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right section */}
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid rgba(148, 163, 184, 0.25)`,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.3,
              color: "#e5e7eb",
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.35))",
            }}
          >
            Assistant Online
          </div>

          <button
            onClick={() => {
              clearAuth();
              navigate("/login");
            }}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid ${GOLD}`,
              background:
                "linear-gradient(135deg, rgba(5,5,7,0.9), rgba(15,15,20,0.9))",
              color: GOLD_SOFT,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
              transition:
                "background 160ms ease, transform 160ms ease, box-shadow 160ms ease, color 160ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(254, 206, 84, 0.18), rgba(246, 224, 156, 0.05))";
              e.currentTarget.style.boxShadow =
                "0 10px 28px rgba(0,0,0,0.75), 0 0 18px rgba(254, 206, 84, 0.35)";
              e.currentTarget.style.color = "#fefce8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(5,5,7,0.9), rgba(15,15,20,0.9))";
              e.currentTarget.style.boxShadow =
                "0 0 0 1px rgba(0,0,0,0.6)";
              e.currentTarget.style.color = GOLD_SOFT;
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN AREA – NEW IFRAME */}
      <main
        style={{
          flex: 1,
          padding: "0px 0px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 22,
            overflow: "hidden",
            background:
              "radial-gradient(circle at top left, rgba(254,206,84,0.14), transparent 55%), #050507",
            boxShadow:
              "0 28px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(148,163,184,0.2)",
            border: "1px solid rgba(15, 23, 42, 0.8)",
            position: "relative",
            margin: 16,
          }}
        >
          {/* Gold accent */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background:
                "linear-gradient(90deg, transparent 0%, #FECE54 35%, #FCE59E 50%, #FECE54 65%, transparent 100%)",
              opacity: 0.9,
              zIndex: 2,
            }}
          />

          {/* Updated Lindy iframe */}
          <iframe
            src={ALPHA_IFRAME_URL}
            width="100%"
            height="100%"
            title="Alpha Clinic Assistant"
            allow="microphone"
            style={{
              border: "none",
              borderRadius: "8px",
              display: "block",
            }}
          />
        </div>
      </main>
    </div>
  );
}
