import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import "./EnvEditor.css";

const EnvEditor = ({ mode, item, theme, onSave, onClose }) => {
  const [editorMode, setEditorMode] = useState(mode); // "add", "edit", "view"
  const [title, setTitle] = useState(item?.title || "Untitled Env");
  const [content, setContent] = useState(item?.fields?.envContent || "");
  const [copied, setCopied] = useState(false);

  const isView = editorMode === "view";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: item?.id, // undefined for new items
      category: "env",
      title: title.trim(),
      fields: {
        envContent: content
      }
    });
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

          {/* Save Button */}
          {!isView && (
            <button className="action-btn-styled save-btn" onClick={handleSave}>
              <i className="fa-solid fa-save"></i> Save Env
            </button>
          )}
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
