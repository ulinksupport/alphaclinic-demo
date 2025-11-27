// src/pages/Dashboard.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, clearAuth, getUser } from "../api";

const ALPHA_IFRAME_URL =
  "https://chat.lindy.ai/embedded/lindyEmbed/744de731-56c5-4a9c-ba48-3175a50a48e1";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
    }
  }, [navigate]);

  const user = getUser();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg,#f5fbff 0%,#fff7f1 100%)",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ffffff",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Alpha Clinic Logo */}
          <img
            src="/alpha-logo.png" 
            alt="Alpha Clinic Logo"
            style={{
              width: 30,
              height: "auto",
              display: "block",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: 16 }}>Alpha Clinic Console</strong>
            {user && (
              <span
                style={{
                  fontSize: 13,
                  opacity: 0.7,
                  marginTop: 2,
                }}
              >
                Logged in as <strong>{user.username}</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button ghost"
            onClick={() => {
              clearAuth();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Full-screen iframe */}
      <main style={{ flex: 1, padding: 16 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 16,
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: "0 10px 40px rgba(15,23,42,0.12)",
          }}
        >
          <iframe
            src={ALPHA_IFRAME_URL}
            title="Alpha Clinic Assistant"
            width="100%"
            height="100%"
            style={{ border: "none", display: "block" }}
          />
        </div>
      </main>
    </div>
  );
}
