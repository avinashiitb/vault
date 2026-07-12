import React, { useState } from "react";
import "./LockScreen.css";

const LockScreen = ({ isSetup, onUnlock, onSetup }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your master password.");
      return;
    }
    setError("");
    const success = await onUnlock(password);
    if (!success) {
      setError("Incorrect master password. Please try again.");
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter a master password.");
      return;
    }
    if (password.length < 4) {
      setError("Master password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    await onSetup(password);
  };

  return (
    <div className="lockscreen-overlay">
      <div className="lockscreen-card">
        <div className="lockscreen-header">
          <div className="lockscreen-icon-container">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isSetup ? "icon-shield" : "icon-lock"}
            >
              {isSetup ? (
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              ) : (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </>
              )}
            </svg>
          </div>
          <h1 className="lockscreen-title">
            {isSetup ? "Initialize Vault" : "Vault Locked"}
          </h1>
          <p className="lockscreen-subtitle">
            {isSetup
              ? "Set a master password to secure your credentials."
              : "Enter your master password to decrypt your credentials."}
          </p>
        </div>

        {error && <div className="lockscreen-error">{error}</div>}

        {isSetup ? (
          <form className="lockscreen-form" onSubmit={handleSetupSubmit}>
            <div className="input-group">
              <label>Master Password</label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Confirm Master Password</label>
              <input
                type="password"
                placeholder="Re-enter password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="lockscreen-btn btn-setup">
              Create Secure Vault
            </button>
          </form>
        ) : (
          <form className="lockscreen-form" onSubmit={handleUnlockSubmit}>
            <div className="input-group">
              <label>Master Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="lockscreen-btn btn-unlock">
              Unlock Vault
            </button>
          </form>
        )}
        <div className="lockscreen-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Your master password is never sent to any server. Encryption is performed entirely client-side.
        </div>
      </div>
    </div>
  );
};

export default LockScreen;
