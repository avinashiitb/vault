import React from "react";
import "./CategorySelectorModal.css";

const CATEGORIES_LIST = [
  {
    value: "website",
    label: "Website Login",
    desc: "Passwords, PINs, usernames, and login URLs",
    iconClass: "fa-solid fa-globe",
    color: "#3b82f6" // blue
  },
  {
    value: "app",
    label: "App Login",
    desc: "Passwords, PINs, and usernames for mobile or desktop apps",
    iconClass: "fa-solid fa-mobile-alt",
    color: "#06b6d4" // cyan
  },
  {
    value: "card",
    label: "Payment Card",
    desc: "Credit/debit card numbers, expiry dates, and CVVs",
    iconClass: "fa-solid fa-credit-card",
    color: "#ec4899" // pink
  },
  {
    value: "bank",
    label: "Bank Account",
    desc: "Account numbers, IFSC codes, netbanking passwords",
    iconClass: "fa-solid fa-money-check-dollar",
    color: "#f59e0b" // amber
  },
  {
    value: "apikey",
    label: "API Key / Credentials",
    desc: "Developer tokens, Client IDs, and Secrets",
    iconClass: "fa-solid fa-key",
    color: "#a855f7" // purple
  },
  {
    value: "identity",
    label: "Identity Document",
    desc: "Passports, driver licenses, or national IDs",
    iconClass: "fa-solid fa-id-card",
    color: "#ef4444" // red
  },
  {
    value: "env",
    label: "Environment Variables",
    desc: "Store multiline config blocks in Monaco Editor",
    iconClass: "fa-solid fa-code",
    color: "#10b981" // emerald/green
  }
];

const CategorySelectorModal = ({ onClose, onSelect }) => {
  return (
    <div className="selector-backdrop" onClick={onClose}>
      <div className="selector-card" onClick={(e) => e.stopPropagation()}>
        <div className="selector-header">
          <h2>Select Item Type</h2>
          <button className="selector-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="selector-grid">
          {CATEGORIES_LIST.map((cat) => (
            <button
              key={cat.value}
              className="selector-option-btn"
              onClick={() => onSelect(cat.value)}
            >
              <div
                className="selector-option-icon"
                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
              >
                <i className={cat.iconClass}></i>
              </div>
              <div className="selector-option-text">
                <span className="selector-option-label">{cat.label}</span>
                <span className="selector-option-desc">{cat.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategorySelectorModal;
