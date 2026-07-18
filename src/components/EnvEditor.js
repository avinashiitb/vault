import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import "./EnvEditor.css";

const EnvEditor = ({ mode, item, theme, onSave, onClose }) => {
  const [editorMode, setEditorMode] = useState(mode); // "add", "edit", "view"
  const [title, setTitle] = useState(item?.title || "Untitled Env");
  const [content, setContent] = useState(item?.fields?.envContent || "");
  const [copied, setCopied] = useState(false);

  const [currentItemId, setCurrentItemId] = useState(item?.id);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const isView = editorMode === "view";

  // Prevent parent re-renders from triggering save loops by referencing onSave via a ref
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Keep track of the last saved state to prevent initial mount saves and loops
  const lastSavedTitle = useRef(item?.title || "Untitled Env");
  const lastSavedContent = useRef(item?.fields?.envContent || "");

  // Debounced Auto-saving
  useEffect(() => {
    if (isView) return;

    // If title and content match the last saved state, we are already synced
    if (title === lastSavedTitle.current && content === lastSavedContent.current) {
      setSaveStatus("Saved");
      return;
    }

    setSaveStatus("Saving");

    const delayDebounceFn = setTimeout(async () => {
      try {
        const savedId = await onSaveRef.current({
          id: currentItemId,
          category: "env",
          title: title.trim() || "Untitled Env",
          fields: {
            envContent: content
          }
        });
        if (savedId) {
          setCurrentItemId(savedId);
        }
        // Update refs to reflect the newly saved state
        lastSavedTitle.current = title;
        lastSavedContent.current = content;
        setSaveStatus("Saved");
      } catch (err) {
        setSaveStatus("Error saving");
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(delayDebounceFn);
  }, [title, content, isView, currentItemId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`env-editor-page ${theme}-theme`}>
      {/* Top Header Bar */}
      <div className="env-editor-header">
        <div className="header-left">
          <button className="back-btn" onClick={onClose}>
            <i className="fa-solid fa-arrow-left"></i> Back to Vault
          </button>
          
          <div className="title-container">
            {isView ? (
              <span className="env-title-text">{title}</span>
            ) : (
              <input
                type="text"
                className="env-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Env Title (e.g. Production Database)"
              />
            )}
          </div>

          {/* Auto-save Status Indicator */}
          {!isView && (
            <div className={`save-status-indicator ${saveStatus === "Saving" ? "saving" : "saved"}`}>
              {saveStatus === "Saving" ? (
                <>
                  <span className="status-dot pulse-amber">●</span> Auto saving...
                </>
              ) : (
                <>
                  <span className="status-dot green">✓</span> Auto saved
                </>
              )}
            </div>
          )}
        </div>

        {/* Mode Selector & Control Panel */}
        <div className="header-actions">
          {/* Mode Switcher */}
          <div className="mode-toggle-pill">
            <button
              className={`mode-pill-btn ${isView ? "active" : ""}`}
              onClick={() => setEditorMode("view")}
            >
              View Mode
            </button>
            <button
              className={`mode-pill-btn ${!isView ? "active" : ""}`}
              onClick={() => setEditorMode("edit")}
            >
              Edit Mode
            </button>
          </div>

          {/* Copy Button */}
          <button
            className={`action-btn-styled ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="Copy entire block"
          >
            {copied ? (
              <>
                <i className="fa-solid fa-check"></i> Copied
              </>
            ) : (
              <>
                <i className="fa-solid fa-copy"></i> Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="env-editor-body">
        <Editor
          height="100%"
          defaultLanguage="ini"
          theme={theme === "dark" ? "vs-dark" : "vs"}
          value={content}
          onChange={(val) => setContent(val || "")}
          options={{
            readOnly: isView,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "var(--font-mono, 'Fira Code', Consolas, monospace)",
            lineHeight: 22,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 16 },
            renderLineHighlight: isView ? "none" : "all",
            cursorStyle: isView ? "line" : "line",
            contextmenu: !isView
          }}
        />
      </div>
    </div>
  );
};

export default EnvEditor;
