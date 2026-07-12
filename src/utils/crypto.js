// Secure cryptographic utility using Web Crypto API (AES-GCM 256)

const deriveKey = async (password, salt) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts a plaintext string using the master password
 * Returns a Base64 encoded string representing salt + iv + ciphertext
 */
export const encryptText = async (text, password) => {
  if (!text) return "";
  try {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(text)
    );
    
    // Combine salt, iv, and encrypted data into a single array
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64
    let binary = "";
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("Encryption failed:", e);
    throw e;
  }
};

/**
 * Decrypts a Base64 encoded string using the master password
 * Returns the decoded plaintext string
 */
export const decryptText = async (ciphertext, password) => {
  if (!ciphertext) return "";
  try {
    const binaryStr = atob(ciphertext);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const encrypted = bytes.slice(28);
    
    const key = await deriveKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed:", e);
    throw e;
  }
};

/**
 * Hashes a master password to check its validity on unlock
 */
export const hashMasterPassword = async (password) => {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
