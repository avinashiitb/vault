/**
 * Robust utility to copy text to clipboard.
 * Falls back to document.execCommand if navigator.clipboard is unavailable/blocked (e.g. in Electron file:// contexts).
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API if available
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback: ", err);
    }
  }

  // 2. Fallback using document.execCommand
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Prevent scrolling and position off-screen
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return !!successful;
  } catch (err) {
    console.error("Fallback copy method failed: ", err);
    return false;
  }
};
