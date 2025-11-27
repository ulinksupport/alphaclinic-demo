// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Alpha Clinic login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 420 }}>
        
        {/* Alpha Clinic Logo */}
        <img
          src="/alpha-logo.png"
          alt="Alpha Clinic Logo"
          style={{
            width: 110,
            height: "auto",
            display: "block",
            margin: "0 auto 18px auto",
          }}
        />

        <h2 className="form-title">Alpha Clinic Console</h2>
        <p className="form-sub">Sign in to access the Alpha Clinic console</p>

        <form className="stack" onSubmit={onSubmit}>
          <label>Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div style={{ color: "crimson", marginBottom: "4px" }}>
              {error}
            </div>
          )}

          <button
            className="button primary"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="row" style={{ marginTop: 10 }}>
          <span>New Alpha Clinic user?</span>
          <Link to="/signup" className="button ghost">
            Create account
          </Link>
        </div>

      </div>
    </div>
  );
}
