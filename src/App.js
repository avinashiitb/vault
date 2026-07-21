import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import LockScreen from "./components/LockScreen";
import VaultDashboard from "./components/VaultDashboard";
import ItemModal from "./components/ItemModal";
import EnvEditor from "./components/EnvEditor";
import CategorySelectorModal from "./components/CategorySelectorModal";
import Toast from "./components/Toast";
import { encryptText, decryptText, hashMasterPassword } from "./utils/crypto";
import { copyToClipboard } from "./utils/clipboard";

// Unique ID Generator
const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9);

function App() {
  const [theme, setTheme] = useState("light");
  const [fileName, setFileName] = useState("Untitled Vault");
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  
  // Vault Auth states
  const [masterPasswordHash, setMasterPasswordHash] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(true);
  const [rawPassword, setRawPassword] = useState(""); // Kept only in memory while unlocked

  // Data states
  const [contentDoc, setContentDoc] = useState(null);
  const [encryptedItems, setEncryptedItems] = useState([]); // Loaded directly from DB (contains ciphertexts)
  const [previews, setPreviews] = useState({}); // Map of ID -> fieldNamePreview -> plaintext preview (e.g., last 4 digits)
  const [revealedSecrets, setRevealedSecrets] = useState({}); // Map of ID -> fieldName -> decrypted plaintext

  // UI overlays
  const [modalState, setModalState] = useState(null); // { type: 'add'|'edit', item?: obj }
  const [envEditorState, setEnvEditorState] = useState(null); // { type: 'add'|'edit'|'view', item?: obj }
  const [showAddSelector, setShowAddSelector] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const [isReady, setIsReady] = useState(false);

  // Get fileId from context or search parameters
  const getFileId = () => {
    let id = window.pluginAPI?.context?.fileId;
    if (id) return id;

    try {
      const url = new URL(window.location.href);
      id = url.searchParams.get("fileId");
      if (!id && window.location.hash.includes("?")) {
        const hashParams = new URLSearchParams(window.location.hash.split("?")[1]);
        id = hashParams.get("fileId");
      }
    } catch (e) {}
    return id;
  };

  const fileId = getFileId() || "standalone-vault";

  // 1. Initial Theme Mode Sync
  useEffect(() => {
    // Initial theme check
    const preloadTheme = window.pluginAPI?.context?.theme;
    if (preloadTheme === "dark" || preloadTheme === "light") {
      setTheme(preloadTheme);
    } else {
      const urlTheme = new URLSearchParams(window.location.search).get("theme");
      if (urlTheme === "dark" || urlTheme === "light") {
        setTheme(urlTheme);
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.className = theme + "-theme";
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Sync theme changes from host container
  useEffect(() => {
    const handleThemeChange = (e) => {
      const newTheme = e.detail?.theme || e.theme;
      if (newTheme === "dark" || newTheme === "light") setTheme(newTheme);
    };

    const handleMessage = (e) => {
      if (e.data && e.data.type === "theme-changed") {
        setTheme(e.data.theme);
      }
    };

    window.addEventListener("theme-changed", handleThemeChange);
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("theme-changed", handleThemeChange);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Show inline Toast notification
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  // Copy text helper
  const handleCopyText = async (text, fieldName) => {
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      showToast(`Copied ${fieldName} to clipboard!`, "success");
      // Also notify via DevScribe toast if available
      window.pluginAPI?.notify?.(`Copied ${fieldName} to clipboard!`, "success");
    } else {
      showToast(`Failed to copy ${fieldName}`, "error");
    }
  };

  // Revealed Secrets Management
  const handleRevealField = async (itemId, fieldKey, ciphertext) => {
    if (!ciphertext || !rawPassword) return;
    try {
      const plaintext = await decryptText(ciphertext, rawPassword);
      setRevealedSecrets((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [fieldKey]: plaintext,
        },
      }));
    } catch (e) {
      showToast("Decryption failed", "error");
    }
  };

  const handleHideField = (itemId, fieldKey) => {
    setRevealedSecrets((prev) => {
      const copy = { ...prev };
      if (copy[itemId]) {
        delete copy[itemId][fieldKey];
        if (Object.keys(copy[itemId]).length === 0) {
          delete copy[itemId];
        }
      }
      return copy;
    });
  };

  // 2. Load data from DevScribe or LocalStorage fallback
  useEffect(() => {
    const loadInitialData = async () => {
      if (window.pluginAPI && fileId && fileId !== "standalone-vault") {
        try {
          // A. Fetch file name
          const fileInfo = await window.pluginAPI.getFileDetailsById(fileId);
          if (fileInfo && fileInfo.title) {
            setFileName(fileInfo.title);
          }

          // B. Fetch breadcrumbs
          if (window.pluginAPI.getNestedPath) {
            const result = await window.pluginAPI.getNestedPath({ fileId });
            if (result) {
              const segs = [
                ...result.folders.map((f) => ({ label: f.name, isFile: false })),
                ...(result.file ? [{ label: result.file.title, isFile: true }] : []),
              ];
              setBreadcrumbs(segs);
            }
          }

          // C. Fetch document
          const data = await window.pluginAPI.getDocumentsByParentFile(fileId);
          if (data && data.length > 0) {
            const documentObj = data[0];
            setContentDoc(documentObj);

            // Find block matching vault
            const vaultBlock = documentObj.blocks?.find((b) => b.type === "vault");
            if (vaultBlock && vaultBlock.data) {
              let savedData = vaultBlock.data;
              if (typeof savedData === "string") {
                savedData = JSON.parse(savedData);
              }

              if (savedData.masterPasswordHash) {
                setMasterPasswordHash(savedData.masterPasswordHash);
                setIsSetup(false);
              } else {
                setIsSetup(true);
              }

              setEncryptedItems(savedData.items || []);
            } else {
              setIsSetup(true);
              setEncryptedItems([]);
            }
          } else {
            setIsSetup(true);
            setEncryptedItems([]);
          }
        } catch (err) {
          console.error("Failed to load initial DevScribe data:", err);
          setIsSetup(true);
        } finally {
          setIsReady(true);
        }
      } else {
        // LocalStorage fallback for standalone development
        try {
          const storedVault = localStorage.getItem(`devscribe-vault-${fileId}`);
          if (storedVault) {
            const parsed = JSON.parse(storedVault);
            if (parsed.masterPasswordHash) {
              setMasterPasswordHash(parsed.masterPasswordHash);
              setIsSetup(false);
            } else {
              setIsSetup(true);
            }
            setEncryptedItems(parsed.items || []);
          } else {
            setIsSetup(true);
            setEncryptedItems([]);
          }
        } catch (e) {
          console.warn("LocalStorage load fallback failed", e);
        }
        setIsReady(true);
      }
    };

    setTimeout(loadInitialData, 100);
  }, [fileId]);

  // 3. Save database state updates
  const saveStateToDatabase = async (newEncryptedItems, newHash = null) => {
    const hashToSave = newHash || masterPasswordHash;
    const payloadData = {
      masterPasswordHash: hashToSave,
      items: newEncryptedItems,
    };

    if (window.pluginAPI && window.pluginAPI.updateDocument && fileId && fileId !== "standalone-vault") {
      const updatedContents = {
        version: contentDoc?.version || 1,
        time: Date.now(),
        blocks: [{ type: "vault", data: payloadData }],
        parent_file: fileId,
        _id: contentDoc?._id,
      };

      try {
        await window.pluginAPI.updateDocument(fileId, [updatedContents]);
        console.log("Saved to DevScribe successfully");
      } catch (err) {
        console.error("DevScribe save failed:", err);
        showToast("Failed to save updates to workspace.", "error");
      }
    } else {
      // LocalStorage fallback
      try {
        localStorage.setItem(
          `devscribe-vault-${fileId}`,
          JSON.stringify(payloadData)
        );
      } catch (e) {
        console.warn("LocalStorage save fallback failed", e);
      }
    }
  };

  // 4. Setup Master Password
  const handleSetupMasterPassword = async (password) => {
    try {
      const hash = await hashMasterPassword(password);
      setMasterPasswordHash(hash);
      setRawPassword(password);
      setIsSetup(false);
      setIsAuthenticated(true);
      
      // Save empty database initialized with master password hash
      await saveStateToDatabase([], hash);
      setEncryptedItems([]);
      setPreviews({});
      showToast("Vault initialized successfully!", "success");
    } catch (e) {
      showToast("Setup failed. Please try again.", "error");
    }
  };

  // 5. Unlock Vault (decrypts previews on-the-fly and drops full plaintexts)
  const handleUnlock = async (password) => {
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const isLocalAdmin = isLocalhost && password === "admin";
      const hash = await hashMasterPassword(password);
      
      if (hash === masterPasswordHash || isLocalAdmin) {
        let currentEncryptedItems = encryptedItems;

        // If running locally, entering "admin" will unlock and load/save the demo items automatically
        if (isLocalAdmin && hash !== masterPasswordHash) {
          const demoItems = [
            {
              id: "demo-web-1",
              category: "website",
              title: "Google Workspace Account",
              fields: {
                username: "admin@devscribe.io",
                password: await encryptText("SuperSecretGooglePass123!", password),
                url: "https://accounts.google.com"
              }
            },
            {
              id: "demo-card-1",
              category: "card",
              title: "Business Credit Card (Visa)",
              fields: {
                cardholder: "AVINASH KUMAR ANSHU",
                cardNumber: await encryptText("4111 2222 3333 4242", password),
                cardNumberPreview: "4242",
                cardExpiry: await encryptText("12/28", password),
                cardExpiryPreview: "12/28",
                cardCvv: await encryptText("123", password),
                cardPin: await encryptText("8899", password)
              }
            },
            {
              id: "demo-bank-1",
              category: "bank",
              title: "HDFC Savings Account",
              fields: {
                accountHolder: "AVINASH KUMAR ANSHU",
                accountNumber: await encryptText("50100412346641", password),
                accountNumberPreview: "6641",
                ifscCode: await encryptText("HDFC0000240", password),
                ifscCodePreview: "HDFC••••",
                customerId: await encryptText("10293847", password),
                customerIdPreview: "••••847"
              }
            },
            {
              id: "demo-key-1",
              category: "apikey",
              title: "GitHub Personal Access Token",
              fields: {
                keyScope: "repo, write:packages",
                apiKeyValue: await encryptText("ghp_1234567890abcdefghijklmnopqr", password),
                apiKeyValuePreview: "ghp_1234••••"
              }
            },
            {
              id: "demo-id-1",
              category: "identity",
              title: "National Passport",
              fields: {
                idSub: "Passport",
                idNumber: await encryptText("Z12345693", password),
                idNumberPreview: "Z••••••93"
              }
            }
          ];

          await saveStateToDatabase(demoItems, hash);
          setEncryptedItems(demoItems);
          currentEncryptedItems = demoItems;
          setMasterPasswordHash(hash);
          setIsSetup(false);
        }

        setRawPassword(password);
        
        // Decrypt previews only (to render card ends, account ends, etc.)
        const previewsMap = {};

        for (const item of currentEncryptedItems) {
          previewsMap[item.id] = {};

          if (item.category === "card") {
            let pNum = item.fields.cardNumberPreview;
            if (!pNum && item.fields.cardNumber) {
              try {
                const plain = await decryptText(item.fields.cardNumber, password);
                pNum = plain.replace(/\s/g, "").slice(-4);
              } catch (e) {}
            }
            previewsMap[item.id].cardNumberPreview = pNum || "4242";

            let pExp = item.fields.cardExpiryPreview || item.fields.cardExpiry;
            if (item.fields.cardExpiry && !item.fields.cardExpiry.includes("/")) {
              try {
                pExp = await decryptText(item.fields.cardExpiry, password);
              } catch (e) {}
            }
            previewsMap[item.id].cardExpiryPreview = pExp || "09/27";
          } else if (item.category === "bank") {
            let pNum = item.fields.accountNumberPreview;
            if (!pNum && item.fields.accountNumber) {
              try {
                const plain = await decryptText(item.fields.accountNumber, password);
                pNum = plain.slice(-4);
              } catch (e) {}
            }
            previewsMap[item.id].accountNumberPreview = pNum || "6641";

            let pIfsc = item.fields.ifscCodePreview;
            if (!pIfsc && item.fields.ifscCode) {
              try {
                const plain = await decryptText(item.fields.ifscCode, password);
                pIfsc = plain.slice(0, 4) + "••••";
              } catch (e) {}
            }
            previewsMap[item.id].ifscCodePreview = pIfsc || "HDFC000••••";

            let pCust = item.fields.customerIdPreview;
            if (!pCust && item.fields.customerId) {
              try {
                const plain = await decryptText(item.fields.customerId, password);
                pCust = plain.length > 4 ? "••••" + plain.slice(-4) : "••••";
              } catch (e) {}
            }
            previewsMap[item.id].customerIdPreview = pCust || "••••";
          } else if (item.category === "apikey") {
            let pKey = item.fields.apiKeyValuePreview;
            if (!pKey && item.fields.apiKeyValue) {
              try {
                const plain = await decryptText(item.fields.apiKeyValue, password);
                pKey = plain.substring(0, 8) + "••••";
              } catch (e) {}
            }
            previewsMap[item.id].apiKeyValuePreview = pKey || "ghp_••••••••••••";
          } else if (item.category === "identity") {
            let pId = item.fields.idNumberPreview;
            if (!pId && item.fields.idNumber) {
              try {
                const plain = await decryptText(item.fields.idNumber, password);
                pId = plain.charAt(0) + "••••" + plain.slice(-2);
              } catch (e) {}
            }
            previewsMap[item.id].idNumberPreview = pId || "Z1••••••93";
          }
        }

        setPreviews(previewsMap);
        setIsAuthenticated(true);
        showToast("Vault unlocked!", "success");
        return true;
      }
      return false;
    } catch (e) {
      console.error("Unlock failed", e);
      return false;
    }
  };

  // 6. Lock Vault (clear memory)
  const handleLock = useCallback(() => {
    setRawPassword("");
    setPreviews({});
    setRevealedSecrets({});
    setIsAuthenticated(false);
    showToast("Vault locked.", "info");
  }, []);

  // Just-in-time decryption for editing an item
  const handleEditClick = async (item) => {
    const decryptedFields = { ...item.fields };
    
    const sensitiveFieldsMap = {
      website: ["password"],
      app: ["password"],
      card: ["cardNumber", "cardExpiry", "cardCvv", "cardPin"],
      bank: ["accountNumber", "ifscCode", "customerId"],
      apikey: ["apiKeyValue"],
      identity: ["idNumber"],
      env: ["envContent"],
    };

    const sensitives = sensitiveFieldsMap[item.category] || [];
    for (const key of Object.keys(item.fields)) {
      if (sensitives.includes(key)) {
        const cipher = item.fields[key];
        if (cipher) {
          try {
            decryptedFields[key] = await decryptText(cipher, rawPassword);
          } catch (e) {
            decryptedFields[key] = "";
          }
        }
      }
    }

    // Decrypt custom fields for editing
    if (item.fields.customFields) {
      const decryptedCustomFields = [];
      for (const field of item.fields.customFields) {
        if (field.value) {
          try {
            const dec = await decryptText(field.value, rawPassword);
            decryptedCustomFields.push({
              id: field.id,
              name: field.name,
              value: dec
            });
          } catch (e) {
            decryptedCustomFields.push({
              id: field.id,
              name: field.name,
              value: ""
            });
          }
        } else {
          decryptedCustomFields.push({
            id: field.id,
            name: field.name,
            value: ""
          });
        }
      }
      decryptedFields.customFields = decryptedCustomFields;
    }

    if (item.category === "env") {
      setEnvEditorState({
        type: "edit",
        item: {
          ...item,
          fields: decryptedFields
        }
      });
      return;
    }

    setModalState({
      type: "edit",
      item: {
        ...item,
        fields: decryptedFields
      }
    });
  };

  // Just-in-time decryption for viewing an item in read-only mode
  const handleViewClick = async (item) => {
    const decryptedFields = { ...item.fields };
    
    const sensitiveFieldsMap = {
      website: ["password"],
      app: ["password"],
      card: ["cardNumber", "cardExpiry", "cardCvv", "cardPin"],
      bank: ["accountNumber", "ifscCode", "customerId"],
      apikey: ["apiKeyValue"],
      identity: ["idNumber"],
      env: ["envContent"],
    };

    const sensitives = sensitiveFieldsMap[item.category] || [];
    for (const key of Object.keys(item.fields)) {
      if (sensitives.includes(key)) {
        const cipher = item.fields[key];
        if (cipher) {
          try {
            decryptedFields[key] = await decryptText(cipher, rawPassword);
          } catch (e) {
            decryptedFields[key] = "";
          }
        }
      }
    }

    // Decrypt custom fields for viewing
    if (item.fields.customFields) {
      const decryptedCustomFields = [];
      for (const field of item.fields.customFields) {
        if (field.value) {
          try {
            const dec = await decryptText(field.value, rawPassword);
            decryptedCustomFields.push({
              id: field.id,
              name: field.name,
              value: dec
            });
          } catch (e) {
            decryptedCustomFields.push({
              id: field.id,
              name: field.name,
              value: ""
            });
          }
        } else {
          decryptedCustomFields.push({
            id: field.id,
            name: field.name,
            value: ""
          });
        }
      }
      decryptedFields.customFields = decryptedCustomFields;
    }

    if (item.category === "env") {
      setEnvEditorState({
        type: "view",
        item: {
          ...item,
          fields: decryptedFields
        }
      });
      return;
    }

    setModalState({
      type: "view",
      item: {
        ...item,
        fields: decryptedFields
      }
    });
  };

  // 7. Add / Edit Save Item callback
  const handleSaveItem = async (modalData, silent = false) => {
    const isNew = !modalData.id;
    const itemId = modalData.id || uid();

    // Prepare fields by encrypting secrets
    const encryptedFields = { ...modalData.fields };

    const sensitiveFieldsMap = {
      website: ["password"],
      app: ["password"],
      card: ["cardNumber", "cardExpiry", "cardCvv", "cardPin"],
      bank: ["accountNumber", "ifscCode", "customerId"],
      apikey: ["apiKeyValue"],
      identity: ["idNumber"],
      env: ["envContent"],
    };

    const sensitives = sensitiveFieldsMap[modalData.category] || [];

    // Encrypt sensitive values
    for (const key of Object.keys(modalData.fields)) {
      if (sensitives.includes(key)) {
        const val = modalData.fields[key];
        if (val) {
          const cipher = await encryptText(val, rawPassword);
          encryptedFields[key] = cipher;
        } else {
          encryptedFields[key] = "";
        }
      }
    }

    // Encrypt custom fields
    if (modalData.fields.customFields) {
      const encryptedCustomFields = [];
      for (const field of modalData.fields.customFields) {
        if (field.value) {
          const cipher = await encryptText(field.value, rawPassword);
          encryptedCustomFields.push({
            id: field.id,
            name: field.name,
            value: cipher
          });
        } else {
          encryptedCustomFields.push({
            id: field.id,
            name: field.name,
            value: ""
          });
        }
      }
      encryptedFields.customFields = encryptedCustomFields;
    }

    // Compute and save unencrypted previews as metadata
    const itemPreviews = {};
    if (modalData.category === "card") {
      const pNum = modalData.fields.cardNumber.replace(/\s/g, "").slice(-4);
      encryptedFields.cardNumberPreview = pNum;
      itemPreviews.cardNumberPreview = pNum;

      const pExp = modalData.fields.cardExpiry;
      encryptedFields.cardExpiryPreview = pExp;
      itemPreviews.cardExpiryPreview = pExp;
    } else if (modalData.category === "bank") {
      const pNum = modalData.fields.accountNumber.slice(-4);
      encryptedFields.accountNumberPreview = pNum;
      itemPreviews.accountNumberPreview = pNum;

      const pIfsc = modalData.fields.ifscCode ? modalData.fields.ifscCode.slice(0, 4) + "••••" : "";
      encryptedFields.ifscCodePreview = pIfsc;
      itemPreviews.ifscCodePreview = pIfsc;

      const pCust = modalData.fields.customerId ? "••••" + modalData.fields.customerId.slice(-4) : "";
      encryptedFields.customerIdPreview = pCust;
      itemPreviews.customerIdPreview = pCust;
    } else if (modalData.category === "apikey") {
      const pKey = modalData.fields.apiKeyValue ? modalData.fields.apiKeyValue.substring(0, 8) + "••••" : "";
      encryptedFields.apiKeyValuePreview = pKey;
      itemPreviews.apiKeyValuePreview = pKey;
    } else if (modalData.category === "identity") {
      const pId = modalData.fields.idNumber ? modalData.fields.idNumber.charAt(0) + "••••" + modalData.fields.idNumber.slice(-2) : "";
      encryptedFields.idNumberPreview = pId;
      itemPreviews.idNumberPreview = pId;
    } else if (modalData.category === "env") {
      const pEnv = modalData.fields.envContent ? modalData.fields.envContent.substring(0, 10).replace(/\r?\n/g, " ") + "••••" : "";
      encryptedFields.envContentPreview = pEnv;
      itemPreviews.envContentPreview = pEnv;
    }

    const newItemEncryptedObj = {
      id: itemId,
      category: modalData.category,
      title: modalData.title,
      fields: encryptedFields,
    };

    let updatedEncryptedItems;
    if (isNew) {
      updatedEncryptedItems = [...encryptedItems, newItemEncryptedObj];
    } else {
      updatedEncryptedItems = encryptedItems.map((it) => (it.id === itemId ? newItemEncryptedObj : it));
    }

    // Update States
    setEncryptedItems(updatedEncryptedItems);
    setPreviews((prev) => ({
      ...prev,
      [itemId]: itemPreviews,
    }));

    setModalState(null);
    if (!silent) {
      showToast(isNew ? "Credential added!" : "Credential updated!", "success");
    }

    // Save to file
    await saveStateToDatabase(updatedEncryptedItems);
    return itemId;
  };

  // 8. Delete Vault Item callback
  const handleDeleteItem = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this credential?")) {
      const updatedEncryptedItems = encryptedItems.filter((it) => it.id !== itemId);

      setEncryptedItems(updatedEncryptedItems);
      setPreviews((prev) => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });

      showToast("Credential deleted.", "info");
      await saveStateToDatabase(updatedEncryptedItems);
    }
  };

  // 9. Export Vault callback (.ds encrypted format)
  const handleExportVault = async () => {
    try {
      const payload = JSON.stringify({
        _id: contentDoc?._id || `doc-${Date.now()}`,
        version: "1.0.0",
        time: Date.now(),
        parent_file: fileId || "standalone-export",
        blocks: [{ type: "vault", data: { masterPasswordHash, items: encryptedItems } }],
        createdAt: contentDoc?.createdAt || Date.now(),
        updatedAt: Date.now(),
        fileType: "vault"
      }, null, 2);

      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = fileName ? fileName.split('.')[0] : 'vault';
      a.download = `${safeName}.ds`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("Exported vault successfully!", "success");
      if (window.pluginAPI?.notify) {
        window.pluginAPI.notify("Exported vault successfully", "success");
      }
    } catch (err) {
      console.error("Export failed:", err);
      showToast("Failed to export vault.", "error");
    }
  };

  // Loading indicator
  if (!isReady) {
    return (
      <div className="vault-app-loading">
        <div className="spinner"></div>
        <span>Securing environment...</span>
      </div>
    );
  }

  // Render Lock screen if unauthorized
  if (!isAuthenticated) {
    return (
      <div className={`App ${theme}-theme`}>
        <LockScreen
          isSetup={isSetup}
          onUnlock={handleUnlock}
          onSetup={handleSetupMasterPassword}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  // Render Vault Dashboard
  return (
    <div className={`App ${theme}-theme`}>
      <VaultDashboard
        items={encryptedItems}
        onAddItem={() => setShowAddSelector(true)}
        onAddEnv={() => setEnvEditorState({ type: "add" })}
        onEditItem={handleEditClick}
        onViewItem={handleViewClick}
        onDeleteItem={handleDeleteItem}
        onLock={handleLock}
        onCopyText={handleCopyText}
        onExport={handleExportVault}
        fileName={fileName}
        breadcrumbs={breadcrumbs}
        revealedSecrets={revealedSecrets}
        previews={previews}
        onRevealField={handleRevealField}
        onHideField={handleHideField}
      />

      {modalState && (
        <ItemModal
          mode={modalState.type}
          item={modalState.item}
          onSave={handleSaveItem}
          onClose={() => setModalState(null)}
        />
      )}

      {envEditorState && (
        <EnvEditor
          mode={envEditorState.type}
          item={envEditorState.item}
          theme={theme}
          onSave={async (data) => {
            return await handleSaveItem(data, true);
          }}
          onClose={() => setEnvEditorState(null)}
        />
      )}

      {showAddSelector && (
        <CategorySelectorModal
          onClose={() => setShowAddSelector(false)}
          onSelect={(category) => {
            setShowAddSelector(false);
            if (category === "env") {
              setEnvEditorState({ type: "add" });
            } else {
              setModalState({ type: "add", item: { category } });
            }
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
