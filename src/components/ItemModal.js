import React, { useState, useEffect, useCallback } from "react";
import "./ItemModal.css";

const CATEGORIES = [
  { value: "website", label: "Website" },
  { value: "card", label: "Payment Card" },
  { value: "bank", label: "Bank Account" },
  { value: "apikey", label: "API Key / Credentials" },
  { value: "identity", label: "Identity Document" },
];

const ItemModal = ({ mode, item, onSave, onClose }) => {
  const isView = mode === "view";
  const isEdit = mode === "edit" || isView;
  const [category, setCategory] = useState(item?.category || "website");
  const [title, setTitle] = useState(item?.title || "");

  // Category specific fields
  const [username, setUsername] = useState(item?.fields?.username || "");
  const [password, setPassword] = useState(item?.fields?.password || "");
  const [url, setUrl] = useState(item?.fields?.url || "");

  const [cardholder, setCardholder] = useState(item?.fields?.cardholder || "");
  const [cardNumber, setCardNumber] = useState(item?.fields?.cardNumber || "");
  const [cardExpiry, setCardExpiry] = useState(item?.fields?.cardExpiry || "");
  const [cardCvv, setCardCvv] = useState(item?.fields?.cardCvv || "");

  const [bankSub, setBankSub] = useState(item?.fields?.bankSub || "");
  const [accountNumber, setAccountNumber] = useState(item?.fields?.accountNumber || "");
  const [ifscCode, setIfscCode] = useState(item?.fields?.ifscCode || "");
  const [upiPin, setUpiPin] = useState(item?.fields?.upiPin || "");

  const [keyScope, setKeyScope] = useState(item?.fields?.keyScope || "");
  const [apiKeyValue, setApiKeyValue] = useState(item?.fields?.apiKeyValue || "");

  const [idSub, setIdSub] = useState(item?.fields?.idSub || "");
  const [idNumber, setIdNumber] = useState(item?.fields?.idNumber || "");

  // Custom Fields states
  const [customFields, setCustomFields] = useState(item?.fields?.customFields || []);

  const handleAddCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), name: "", value: "" }
    ]);
  };

  const handleCustomFieldChange = (id, field, value) => {
    setCustomFields(
      customFields.map((cf) => (cf.id === id ? { ...cf, [field]: value } : cf))
    );
  };

  const handleRemoveCustomField = (id) => {
    setCustomFields(customFields.filter((cf) => cf.id !== id));
  };

  // Password Generator states
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const handleGenerate = useCallback(() => {
    let charset = "";
    if (genUpper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (genLower) charset += "abcdefghijklmnopqrstuvwxyz";
    if (genNumbers) charset += "0123456789";
    if (genSymbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    if (!charset) {
      setGeneratedPassword("Please select at least one option");
      return;
    }

    let result = "";
    for (let i = 0; i < genLength; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setGeneratedPassword(result);
  }, [genLength, genUpper, genLower, genNumbers, genSymbols]);

  useEffect(() => {
    if (showGenerator) {
      handleGenerate();
    }
  }, [showGenerator, handleGenerate]);

  const handleUseGenerated = () => {
    if (generatedPassword) {
      if (category === "website") setPassword(generatedPassword);
      else if (category === "apikey") setApiKeyValue(generatedPassword);
      setShowGenerator(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (isView) return; // Prevent any saves in view mode
    if (!title.trim()) return;

    let fields = {};
    if (category === "website") {
      fields = { username, password, url };
    } else if (category === "card") {
      fields = { cardholder, cardNumber, cardExpiry, cardCvv };
    } else if (category === "bank") {
      fields = { bankSub, accountNumber, ifscCode, upiPin };
    } else if (category === "apikey") {
      fields = { keyScope, apiKeyValue };
    } else if (category === "identity") {
      fields = { idSub, idNumber };
    }

    // Filter and append custom fields
    fields.customFields = customFields.filter((cf) => cf.name.trim() !== "");

    onSave({
      id: item?.id, // undefined for new items
      category,
      title,
      fields,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isView ? "View Credentials" : isEdit ? "Edit Item" : "Add Credentials"}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isEdit}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group flex-2">
                <label>Title</label>
                <input
                  type="text"
                  placeholder={
                    category === "website" ? "github.com" :
                    category === "card" ? "Visa Platinum" :
                    category === "bank" ? "HDFC Savings" :
                    category === "apikey" ? "GitHub PAT" : "Passport"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isView}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* WEBSITE FIELDS */}
            {category === "website" && (
              <div className="category-fields">
                <div className="form-group">
                  <label>Username / Email</label>
                  <input
                    type="text"
                    placeholder="dev@priya.io"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group relative">
                  <div className="label-row">
                    <label>Password</label>
                    {!isView && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setShowGenerator(!showGenerator)}
                      >
                        {showGenerator ? "Hide Generator" : "Generate Password"}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group">
                  <label>Website URL (optional)</label>
                  <input
                    type="text"
                    placeholder="https://github.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isView}
                  />
                </div>
              </div>
            )}

            {/* CARD FIELDS */}
            {category === "card" && (
              <div className="category-fields">
                <div className="form-group">
                  <label>Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="Priya Sharma"
                    value={cardholder}
                    onChange={(e) => setCardholder(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group">
                  <label>Card Number</label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Expiration Date</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      disabled={isView}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>CVV</label>
                    <input
                      type="text"
                      placeholder="•••"
                      maxLength="4"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      disabled={isView}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BANK FIELDS */}
            {category === "bank" && (
              <div className="category-fields">
                <div className="form-group">
                  <label>Sub Description (e.g. Primary Account)</label>
                  <input
                    type="text"
                    placeholder="Primary account"
                    value={bankSub}
                    onChange={(e) => setBankSub(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group">
                  <label>Account Number</label>
                  <input
                    type="text"
                    placeholder="A/C ······6641"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      placeholder="HDFC000••••"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      disabled={isView}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>UPI PIN</label>
                    <input
                      type="text"
                      placeholder="••••"
                      value={upiPin}
                      onChange={(e) => setUpiPin(e.target.value)}
                      disabled={isView}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* API KEY FIELDS */}
            {category === "apikey" && (
              <div className="category-fields">
                <div className="form-group">
                  <label>Client ID / Key ID / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Client ID, Access Key ID, or Description"
                    value={keyScope}
                    onChange={(e) => setKeyScope(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group">
                  <div className="label-row">
                    <label>Client Secret / Key Value</label>
                    {!isView && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setShowGenerator(!showGenerator)}
                      >
                        {showGenerator ? "Hide Generator" : "Generate Secure Key"}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Client Secret or Secret Key Value"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    disabled={isView}
                  />
                </div>
              </div>
            )}

            {/* IDENTITY FIELDS */}
            {category === "identity" && (
              <div className="category-fields">
                <div className="form-group">
                  <label>Label / Expiry (e.g. Expires 2031, Govt ID)</label>
                  <input
                    type="text"
                    placeholder="Expires 2031"
                    value={idSub}
                    onChange={(e) => setIdSub(e.target.value)}
                    disabled={isView}
                  />
                </div>
                <div className="form-group">
                  <label>ID Number</label>
                  <input
                    type="text"
                    placeholder="Z••••••93"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    disabled={isView}
                  />
                </div>
              </div>
            )}

            {/* PASSWORD GENERATOR DRAWER */}
            {showGenerator && !isView && (
              <div className="password-generator-panel">
                <div className="generator-header">
                  <span className="generator-title">Secure Generator</span>
                </div>
                <div className="generated-output-box">
                  <span className="generated-pass-text">{generatedPassword}</span>
                  <button
                    type="button"
                    className="btn-use-password"
                    onClick={handleUseGenerated}
                  >
                    Use Value
                  </button>
                </div>
                <div className="generator-controls">
                  <div className="gen-slider-group">
                    <label>Length: {genLength}</label>
                    <input
                      type="range"
                      min="6"
                      max="32"
                      value={genLength}
                      onChange={(e) => setGenLength(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="gen-options-grid">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={genUpper}
                        onChange={(e) => setGenUpper(e.target.checked)}
                      />
                      A-Z
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={genLower}
                        onChange={(e) => setGenLower(e.target.checked)}
                      />
                      a-z
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={genNumbers}
                        onChange={(e) => setGenNumbers(e.target.checked)}
                      />
                      0-9
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={genSymbols}
                        onChange={(e) => setGenSymbols(e.target.checked)}
                      />
                      Symbols
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* CUSTOM FIELDS (ALL CATEGORIES) */}
            <div className="custom-fields-section" style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px dashed var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Custom Fields (Encrypted)
                </h4>
                {!isView && (
                  <button
                    type="button"
                    className="text-btn"
                    onClick={handleAddCustomField}
                    style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                  >
                    <i className="fa-solid fa-plus"></i> Add Field
                  </button>
                )}
              </div>

              {customFields.length === 0 ? (
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                  No custom fields added yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {customFields.map((field) => (
                    <div key={field.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Field Name (e.g. Netbanking Password)"
                        value={field.name}
                        onChange={(e) => handleCustomFieldChange(field.id, "name", e.target.value)}
                        style={{ flex: 1, padding: "8px 12px", fontSize: "12px" }}
                        disabled={isView}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Field Value"
                        value={field.value}
                        onChange={(e) => handleCustomFieldChange(field.id, "value", e.target.value)}
                        style={{ flex: 2, padding: "8px 12px", fontSize: "12px" }}
                        disabled={isView}
                        required
                      />
                      {!isView && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(field.id)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            border: "none",
                            borderRadius: "4px",
                            width: "28px",
                            height: "28px",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center"
                          }}
                          title="Remove Field"
                        >
                          <i className="fa-solid fa-trash" style={{ fontSize: "11px" }}></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            {isView ? (
              <button type="button" className="btn-save" onClick={onClose} style={{ width: "100%" }}>
                Close
              </button>
            ) : (
              <>
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Save Item
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemModal;
