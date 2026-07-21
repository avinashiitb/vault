import React, { useState, useEffect, useRef } from "react";
import "./VaultDashboard.css";

const VaultDashboard = ({
  items,
  onAddItem,
  onEditItem,
  onViewItem,
  onAddEnv,
  onDeleteItem,
  onLock,
  onCopyText,
  onExport,
  fileName,
  breadcrumbs,
  revealedSecrets = {},
  previews = {},
  onRevealField,
  onHideField,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [autoLockSeconds, setAutoLockSeconds] = useState(300); // 5 minutes
  const [revealedCountdowns, setRevealedCountdowns] = useState({}); // itemId_fieldKey -> seconds left
  const [expandedSections, setExpandedSections] = useState({
    website: false,
    card: false,
    bank: false,
    env: false,
    apikey: false,
    identity: false
  });

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const autoLockTimer = useRef(null);
  const countdownTimers = useRef({});

  // 1. Auto-Lock timer management
  const resetAutoLock = () => {
    setAutoLockSeconds(300);
  };

  useEffect(() => {
    // Reset timer on user interactions
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetAutoLock);
    });

    autoLockTimer.current = setInterval(() => {
      setAutoLockSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(autoLockTimer.current);
          onLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetAutoLock);
      });
      if (autoLockTimer.current) clearInterval(autoLockTimer.current);
    };
  }, [onLock]);

  // Format auto-lock time (MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 2. Secret Reveal and Auto-Hide Countdown (Multi-field support)
  const toggleRevealMultiple = (itemId, fieldKeysWithCiphertexts) => {
    const primaryKey = fieldKeysWithCiphertexts[0].key;
    const timerKey = `${itemId}_${primaryKey}`;
    const isCurrentlyRevealed = revealedSecrets[itemId]?.[primaryKey] !== undefined;

    if (isCurrentlyRevealed) {
      fieldKeysWithCiphertexts.forEach(({ key }) => {
        onHideField(itemId, key);
      });
      if (countdownTimers.current[timerKey]) {
        clearInterval(countdownTimers.current[timerKey]);
        delete countdownTimers.current[timerKey];
      }
      setRevealedCountdowns((prev) => {
        const copy = { ...prev };
        delete copy[timerKey];
        return copy;
      });
    } else {
      fieldKeysWithCiphertexts.forEach(({ key, cipher }) => {
        onRevealField(itemId, key, cipher);
      });
      setRevealedCountdowns((prev) => ({ ...prev, [timerKey]: 12 }));

      if (countdownTimers.current[timerKey]) {
        clearInterval(countdownTimers.current[timerKey]);
      }

      countdownTimers.current[timerKey] = setInterval(() => {
        setRevealedCountdowns((prev) => {
          const currentVal = prev[timerKey];
          if (currentVal <= 1) {
            clearInterval(countdownTimers.current[timerKey]);
            delete countdownTimers.current[timerKey];
            fieldKeysWithCiphertexts.forEach(({ key }) => {
              onHideField(itemId, key);
            });
            const copy = { ...prev };
            delete copy[timerKey];
            return copy;
          }
          return { ...prev, [timerKey]: currentVal - 1 };
        });
      }, 1000);
    }
  };

  useEffect(() => {
    // Cleanup timers on unmount
    const timers = countdownTimers.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, []);

  // Copy helper
  const handleCopy = (e, text, fieldName) => {
    e.stopPropagation();
    onCopyText(text, fieldName);
  };

  // Helper to determine masking / ciphertexts
  const renderSecret = (itemId, secretType, ciphertext) => {
    // 1. If revealed, show plaintext
    const lookupKey = secretType === "websitePin" ? "password" : secretType;
    const revealedVal = revealedSecrets[itemId]?.[lookupKey];
    if (revealedVal !== undefined) {
      return revealedVal;
    }

    // 2. Default masked with preview fallback
    if (secretType === "password" || secretType === "cardCvv" || secretType === "upiPin" || secretType === "cardPin" || secretType === "websitePin") {
      if (secretType === "cardCvv") return "•••";
      if (secretType === "upiPin" || secretType === "cardPin" || secretType === "websitePin") return "PIN ••••";
      return "••••••••••••";
    }

    const preview = previews[itemId]?.[secretType + "Preview"];
    if (preview) {
      if (secretType === "cardNumber") return `···· ···· ···· ${preview}`;
      if (secretType === "cardExpiry") return `Exp ${preview}`;
      if (secretType === "accountNumber") return `A/c ······${preview}`;
      if (secretType === "ifscCode") return `IFSC ${preview}`;
      if (secretType === "customerId") return `Cust ID ${preview}`;
      if (secretType === "apiKeyValue") return `${preview}`;
      if (secretType === "idNumber") return `${preview}`;
      if (secretType === "envContent") return `env ${preview}`;
    }

    // Static fallback if preview isn't loaded yet
    if (secretType === "cardNumber") return "···· ···· ···· 4242";
    if (secretType === "cardExpiry") return "Exp 09/27";
    if (secretType === "accountNumber") return "A/c ······6641";
    if (secretType === "ifscCode") return "IFSC HDFC000••••";
    if (secretType === "customerId") return "Cust ID ••••••••";
    if (secretType === "apiKeyValue") return "ghp_••••••••••••";
    if (secretType === "idNumber") return "Z••••••93";
    if (secretType === "envContent") return "env ••••••••";

    return "••••••••";
  };

  // Helper to determine custom fields display limit
  const getCustomFieldsLimit = (category) => {
    if (category === "apikey" || category === "identity") return 1;
    if (category === "card" || category === "bank") return 2;
    return 3; // website, env, others
  };

  // Render Custom Fields inline as secret pills
  const renderCustomFieldsInline = (item) => {
    if (!item.fields || !item.fields.customFields || item.fields.customFields.length === 0) return null;
    
    const limit = getCustomFieldsLimit(item.category);
    const visibleFields = item.fields.customFields.slice(0, limit);
    const hasMore = item.fields.customFields.length > limit;
    
    const pills = visibleFields.map((cf) => {
      const customSecretKey = `custom-${cf.id}`;
      const isCfRevealed = revealedSecrets[item.id]?.[customSecretKey] !== undefined;
      const countdown = revealedCountdowns[`${item.id}_${customSecretKey}`] || 0;
      
      return (
        <span
          key={cf.id}
          className={`secret-pill font-mono ${isCfRevealed ? "revealed-pill" : ""}`}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleRevealMultiple(item.id, [{ key: customSecretKey, cipher: cf.value }]);
          }}
          title="Click to toggle reveal"
        >
          <span style={{ opacity: 0.65, fontWeight: 500 }}>{cf.name}:</span>
          <span>{renderSecret(item.id, customSecretKey, cf.value)}</span>
          {isCfRevealed && countdown > 0 && (
            <span className="reveal-countdown-timer" style={{ fontSize: "10px", marginLeft: "2px" }}>
              ({countdown}s)
            </span>
          )}
        </span>
      );
    });

    if (hasMore) {
      pills.push(
        <span
          key="more-dots"
          className="secret-pill font-mono"
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
          onClick={(e) => {
            e.stopPropagation();
            onViewItem(item);
          }}
          title="Click to view all fields"
        >
          •••
        </span>
      );
    }
    
    return pills;
  };

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const matchesTitle = item.title.toLowerCase().includes(query);
    const matchesCategory = item.category.toLowerCase().includes(query);
    const matchesFields = Object.values(item.fields || {}).some((val) =>
      String(val).toLowerCase().includes(query)
    );

    return matchesTitle || matchesCategory || matchesFields;
  });

  // Group items by category
  const websites = filteredItems.filter((i) => i.category === "website" || i.category === "app");
  const cards = filteredItems.filter((i) => i.category === "card");
  const banks = filteredItems.filter((i) => i.category === "bank");
  const apikeys = filteredItems.filter((i) => i.category === "apikey");
  const identities = filteredItems.filter((i) => i.category === "identity");
  const envs = filteredItems.filter((i) => i.category === "env");

  return (
    <div className="dashboard-layout">
      {/* Header Bar */}
      <div className="dashboard-header">
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center' }}>
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              fontSize: 12,
              color: '#9ca3af',
              overflow: 'visible',
              flexWrap: 'nowrap',
              userSelect: 'none',
              marginRight: 16,
            }}
            aria-label="file path"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ marginRight: 6, opacity: 0.7, color: '#9ca3af' }}
            >
              <path d="M20 5h-8.586l-2-2H4c-1.104 0-2 .896-2 2v14c0 1.104.896 2 2 2h16c1.104 0 2-.896 2-2V7c0-1.104-.896-2-2-2z" />
            </svg>
            {(breadcrumbs && breadcrumbs.length > 0
              ? breadcrumbs
              : [{ label: fileName || "Untitled Vault", isFile: true }]
            ).map((seg, idx) => (
              <React.Fragment key={idx}>
                {!seg.isFile && (
                  <>
                    <span
                      className="breadcrumb-folder"
                      style={{
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      title={seg.label}
                    >
                      {seg.label}
                    </span>
                    <span className="breadcrumb-chevron" style={{ userSelect: 'none', margin: '0 4px' }}>›</span>
                  </>
                )}
                {seg.isFile && (
                  <span
                    className="breadcrumb-file"
                    style={{
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                    title={seg.label}
                  >
                    {seg.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="topbar-center" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="brand-status" style={{ fontSize: 11, color: 'var(--green-primary)', fontWeight: 600 }}>
            ● Unlocked · {items.length} items · auto-locks in {formatTime(autoLockSeconds)}
          </span>
        </div>

        <div className="header-actions">
          {/* Search */}
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search vault…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                ×
              </button>
            )}
          </div>


          {/* Add Item Button */}
          <button className="btn-add-item" onClick={onAddItem}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add item
          </button>

          {/* Manual Lock */}
          <button className="btn-manual-lock" onClick={onLock} title="Lock Vault Now">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </button>

          {/* Export Button */}
          <button className="btn-export-vault" onClick={onExport} title="Export Vault (.ds)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Scroller Content */}
      <div className="dashboard-content">
        {/* WEBSITES SECTION */}
        {websites.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              Websites / Apps · {websites.length}
            </div>

            <div className="category-card-list">
              {websites.slice(0, expandedSections.website ? websites.length : 4).map((item) => {
                const isRevealed = revealedSecrets[item.id]?.password !== undefined;
                const countdown = revealedCountdowns[`${item.id}_password`] || 0;
                return (
                  <div
                    key={item.id}
                    className={`item-row ${isRevealed ? "revealed-bg" : ""}`}
                  >
                    {item.category === "app" ? (
                      <div className="item-avatar font-bold" style={{ backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#06b6d4" }} title="App Login">
                        <i className="fa-solid fa-mobile-alt" style={{ fontSize: "14px" }}></i>
                      </div>
                    ) : (
                      <div className="item-avatar font-bold" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }} title="Website Login">
                        <i className="fa-solid fa-globe" style={{ fontSize: "14px" }}></i>
                      </div>
                    )}
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{item.fields.username}</span>
                    </div>
                    <div className="item-secrets">
                      {item.fields.loginMethod && item.fields.loginMethod !== "password" && item.fields.loginMethod !== "pin" ? (
                        item.fields.loginMethod === "otp" ? (
                          <span className="login-method-badge otp-badge">OTP Login</span>
                        ) : (
                          <span className="login-method-badge sso-badge">SSO Login</span>
                        )
                      ) : (
                        <span className={`secret-pill font-mono ${isRevealed ? "revealed-pill" : ""}`}>
                          {renderSecret(item.id, item.fields.loginMethod === "pin" ? "websitePin" : "password", item.fields.password)}
                        </span>
                      )}
                      {(!item.fields.loginMethod || item.fields.loginMethod === "password" || item.fields.loginMethod === "pin") && isRevealed && (
                        <span className="reveal-countdown-timer">
                          hides in {countdown}s
                        </span>
                      )}
                      {renderCustomFieldsInline(item)}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      {(!item.fields.loginMethod || item.fields.loginMethod === "password" || item.fields.loginMethod === "pin") && (
                        <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.password, item.fields.loginMethod === "pin" ? "PIN" : "Password")} title={item.fields.loginMethod === "pin" ? "Copy PIN" : "Copy Password"}>
                          <i className="fa-solid fa-copy"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {websites.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("website")}>
                  {expandedSections.website ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {websites.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CARDS SECTION */}
        {cards.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Cards · {cards.length}
            </div>

            <div className="category-card-list">
              {cards.slice(0, expandedSections.card ? cards.length : 4).map((item) => {
                const isRevealed = revealedSecrets[item.id]?.cardNumber !== undefined;
                const isVisa = item.title.toLowerCase().includes("visa");
                const cardTypeLabel = isVisa ? "VISA" : "MC";
                const cardClass = isVisa ? "visa-avatar" : "mc-avatar";
                const countdown = revealedCountdowns[`${item.id}_cardNumber`] || 0;

                return (
                  <div key={item.id} className="item-row">
                    <div className={`card-badge-avatar ${cardClass}`}>{cardTypeLabel}</div>
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{item.fields.cardholder}</span>
                    </div>

                    <div className="item-secrets flex-row-fields">
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "cardNumber", item.fields.cardNumber)}
                      </span>
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "cardExpiry", item.fields.cardExpiry)}
                      </span>
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "cardCvv", item.fields.cardCvv)}
                      </span>
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "cardPin", item.fields.cardPin)}
                      </span>
                      {isRevealed && (
                        <span className="reveal-countdown-timer">
                          hides in {countdown}s
                        </span>
                      )}
                      {renderCustomFieldsInline(item)}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.cardNumber, "Card Number")} title="Copy Card Number">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {cards.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("card")}>
                  {expandedSections.card ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {cards.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* BANK ACCOUNTS SECTION */}
        {banks.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"></path>
                <path d="M5 21V7l7-4 7 4v14"></path>
                <path d="M9 21v-6h6v6"></path>
              </svg>
              Bank accounts · {banks.length}
            </div>

            <div className="category-card-list">
              {banks.slice(0, expandedSections.bank ? banks.length : 4).map((item) => {
                const isRevealed = revealedSecrets[item.id]?.accountNumber !== undefined;
                const countdown = revealedCountdowns[`${item.id}_accountNumber`] || 0;
                return (
                  <div key={item.id} className="item-row">
                    <div className="item-avatar-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18"></path>
                        <path d="M5 21V7l7-4 7 4v14"></path>
                      </svg>
                    </div>
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{item.fields.accountHolder || item.fields.bankSub}</span>
                    </div>

                    <div className="item-secrets flex-row-fields">
                      {item.fields.customerId && (
                        <span className="secret-pill font-mono">
                          {renderSecret(item.id, "customerId", item.fields.customerId)}
                        </span>
                      )}
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "accountNumber", item.fields.accountNumber)}
                      </span>
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "ifscCode", item.fields.ifscCode)}
                      </span>
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "upiPin", item.fields.upiPin)}
                      </span>
                      {isRevealed && (
                        <span className="reveal-countdown-timer">
                          hides in {countdown}s
                        </span>
                      )}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.accountNumber, "Account Number")} title="Copy Account Number">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {banks.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("bank")}>
                  {expandedSections.bank ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {banks.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ENVIRONMENT VARIABLES SECTION */}
        {envs.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              Environment Variables · {envs.length}
            </div>

            <div className="category-card-list">
              {envs.slice(0, expandedSections.env ? envs.length : 4).map((item) => {
                const count = item.fields.envContent ? item.fields.envContent.split("\n").filter(line => line.trim() && !line.trim().startsWith("#")).length : 0;
                return (
                  <div key={item.id} className="item-row">
                    <div className="item-avatar-circle" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                    </div>
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{count} variable{count !== 1 ? "s" : ""}</span>
                    </div>

                    <div className="item-secrets">
                      <span className="secret-pill font-mono" style={{ background: "rgba(16, 185, 129, 0.05)", color: "#10b981" }}>
                        {renderSecret(item.id, "envContent", item.fields.envContent)}
                      </span>
                      {renderCustomFieldsInline(item)}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.envContent, "Environment Variables")} title="Copy Env Block">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {envs.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("env")}>
                  {expandedSections.env ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {envs.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* API KEYS SECTION */}
        {apikeys.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              API Keys / Credentials · {apikeys.length}
            </div>

            <div className="category-card-list">
              {apikeys.slice(0, expandedSections.apikey ? apikeys.length : 4).map((item) => (
                <div key={item.id} className="item-row">
                    <div className="item-avatar-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                      </svg>
                    </div>
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{item.fields.keyScope}</span>
                    </div>

                    <div className="item-secrets">
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "apiKeyValue", item.fields.apiKeyValue)}
                      </span>
                      {renderCustomFieldsInline(item)}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.apiKeyValue, "API Key")} title="Copy Key">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                </div>
              ))}
            </div>
            {apikeys.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("apikey")}>
                  {expandedSections.apikey ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {apikeys.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* IDENTITY SECTION */}
        {identities.length > 0 && (
          <div className="category-group">
            <div className="category-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <circle cx="9" cy="10" r="2"></circle>
                <path d="M15 8h4"></path>
                <path d="M15 12h4"></path>
                <path d="M5 18c.8-1.5 2.2-2.5 4-2.5s3.2 1 4 2.5"></path>
              </svg>
              Identity · {identities.length}
            </div>

            <div className="category-card-list">
              {identities.slice(0, expandedSections.identity ? identities.length : 4).map((item) => {
                const isRevealed = revealedSecrets[item.id]?.idNumber !== undefined;
                const countdown = revealedCountdowns[`${item.id}_idNumber`] || 0;
                return (
                  <div key={item.id} className="item-row">
                    <div className="item-avatar-circle">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                        <circle cx="9" cy="10" r="2"></circle>
                        <path d="M15 8h4"></path>
                        <path d="M15 12h4"></path>
                        <path d="M5 18c.8-1.5 2.2-2.5 4-2.5s3.2 1 4 2.5"></path>
                      </svg>
                    </div>
                    <div className="item-info">
                      <span className="item-name-title">{item.title}</span>
                      <span className="item-sub-title">{item.fields.idSub}</span>
                    </div>

                    <div className="item-secrets">
                      <span className="secret-pill font-mono">
                        {renderSecret(item.id, "idNumber", item.fields.idNumber)}
                      </span>
                      {isRevealed && (
                        <span className="reveal-countdown-timer position-absolute">
                          {countdown}s
                        </span>
                      )}
                      {renderCustomFieldsInline(item)}
                    </div>

                    <div className="item-card-actions">
                      <button className="row-action-btn edit" onClick={() => onEditItem(item)} title="Edit Item">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="row-action-btn delete" onClick={() => onDeleteItem(item.id)} title="Delete Item">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      <button className="row-action-btn view" onClick={() => onViewItem(item)} title="View Details">
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button className="row-action-btn copy" onClick={(e) => handleCopy(e, item.fields.idNumber, "ID Number")} title="Copy ID">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {identities.length > 4 && (
              <div className="section-expand-container">
                <button className="section-expand-btn" onClick={() => toggleSection("identity")}>
                  {expandedSections.identity ? (
                    <>
                      <i className="fa-solid fa-chevron-up"></i> Show less
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ellipsis"></i> Show {identities.length - 4} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty Search State */}
        {filteredItems.length === 0 && (
          <div className="empty-search-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h3>No items matched your search</h3>
            <p>Try searching for a different username, title, or credential type.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultDashboard;
