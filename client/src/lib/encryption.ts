/**
 * End-to-End Encryption Utilities for Daynotes
 * 
 * This module provides a comprehensive set of functions for client-side
 * encryption and decryption of user data using TweetNaCl.js.
 * 
 * Important considerations:
 * - Data is encrypted locally before being sent to the server
 * - The encryption key is derived from the user's password but never transmitted
 * - Existing unencrypted data is preserved during migration
 * - All functions handle both encrypted and unencrypted data safely
 */

import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import CryptoJS from 'crypto-js';

// Cache the derived key to avoid re-computation
let cachedDerivedKey: Uint8Array | null = null;

/**
 * Constants for encryption
 */
const ENCRYPTION_VERSION = 'v1'; // Used for future migration
const KEY_SIZE = nacl.secretbox.keyLength;
const NONCE_SIZE = nacl.secretbox.nonceLength;
const SALT_SIZE = 16;
const ENCRYPTION_MARKER = '###ENCRYPTED###:';
const KEY_DERIVATION_ROUNDS = 10000;

/**
 * Generate a secure key from user password
 * @param password The user's password
 * @param salt Salt used for key derivation (optional - will generate if not provided)
 * @returns An object containing the derived key and salt used
 */
export function deriveKeyFromPassword(
  password: string, 
  salt?: string
): { key: Uint8Array; salt: string } {
  // Create or use provided salt
  const usedSalt = salt || CryptoJS.lib.WordArray.random(SALT_SIZE).toString();
  
  // Generate key using PBKDF2
  const derivedKeyWordArray = CryptoJS.PBKDF2(
    password, 
    usedSalt, 
    { 
      keySize: KEY_SIZE / 4, // keySize is in 32-bit words
      iterations: KEY_DERIVATION_ROUNDS,
      hasher: CryptoJS.algo.SHA256 
    }
  );
  
  // Convert WordArray to Uint8Array expected by NaCl
  const keyBase64 = derivedKeyWordArray.toString(CryptoJS.enc.Base64);
  const key = decodeBase64(keyBase64);
  
  return { key, salt: usedSalt };
}

/**
 * Set the encryption key to use for all operations
 * This should be called at login and when password changes
 * @param password User's password to derive key from
 * @param salt Optional salt value (for existing users)
 */
export function setEncryptionKey(password: string, salt?: string): void {
  const { key } = deriveKeyFromPassword(password, salt);
  cachedDerivedKey = key;
  
  // Store indicator that encryption is enabled (but not the key itself)
  localStorage.setItem('encryption_enabled', 'true');
}

/**
 * Check if encryption is currently enabled
 */
export function isEncryptionEnabled(): boolean {
  return localStorage.getItem('encryption_enabled') === 'true' && cachedDerivedKey !== null;
}

/**
 * Clear the encryption key from memory
 * Call this when user logs out
 */
export function clearEncryptionKey(): void {
  cachedDerivedKey = null;
  localStorage.removeItem('encryption_enabled');
}

/**
 * Generate a random nonce for encryption
 * @returns Random nonce as Uint8Array
 */
function generateNonce(): Uint8Array {
  return nacl.randomBytes(NONCE_SIZE);
}

/**
 * Encrypt data using the cached encryption key
 * @param data The string data to encrypt
 * @returns Encrypted data string with version and nonce information
 */
export function encryptData(data: string): string {
  // Safety check - if encryption not enabled, return unencrypted
  if (!isEncryptionEnabled() || !cachedDerivedKey) {
    console.warn('Attempted to encrypt without an available key');
    return data;
  }

  try {
    // Generate a random nonce
    const nonce = generateNonce();
    
    // Encrypt the data
    const messageUint8 = decodeUTF8(data);
    const encrypted = nacl.secretbox(messageUint8, nonce, cachedDerivedKey);
    
    // Encode the encrypted data and nonce to base64 for storage
    const encryptedBase64 = encodeBase64(encrypted);
    const nonceBase64 = encodeBase64(nonce);
    
    // Format with version and nonce for future-proofing
    return `${ENCRYPTION_MARKER}${ENCRYPTION_VERSION}:${nonceBase64}:${encryptedBase64}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    // Safety fallback - return original data if encryption fails
    return data;
  }
}

/**
 * Decrypt data using the cached encryption key
 * @param data The encrypted string to decrypt
 * @returns Decrypted data string or original if not encrypted/decryption fails
 */
export function decryptData(data: string): string {
  // If not encrypted or encryption not enabled, return as is
  if (!data.startsWith(ENCRYPTION_MARKER) || !isEncryptionEnabled() || !cachedDerivedKey) {
    return data;
  }

  try {
    // Extract components from encrypted string
    const parts = data.substring(ENCRYPTION_MARKER.length).split(':');
    
    // Ensure format is valid
    if (parts.length !== 3) {
      console.warn('Invalid encrypted data format');
      return data;
    }
    
    const [version, nonceBase64, encryptedBase64] = parts;
    
    // Version check for future migration support
    if (version !== ENCRYPTION_VERSION) {
      console.warn(`Unknown encryption version: ${version}`);
      return data;
    }
    
    // Decode from base64
    const nonce = decodeBase64(nonceBase64);
    const encrypted = decodeBase64(encryptedBase64);
    
    // Decrypt the data
    const decrypted = nacl.secretbox.open(encrypted, nonce, cachedDerivedKey);
    
    // Safety check
    if (!decrypted) {
      console.error('Decryption failed - corrupted data or wrong key');
      return `[Decryption failed] Original encrypted content preserved`;
    }
    
    // Convert from Uint8Array to string
    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    // Safety fallback - return original data if decryption fails
    return `[Decryption error] ${data}`;
  }
}

/**
 * Check if a string is encrypted
 * @param data The string to check
 * @returns boolean indicating if the string is encrypted
 */
export function isEncrypted(data: string): boolean {
  return typeof data === 'string' && data.startsWith(ENCRYPTION_MARKER);
}

/**
 * Safe encryption that handles null/undefined values
 * @param data Data to encrypt (can be null/undefined)
 * @returns Encrypted string or original value if null/undefined
 */
export function safeEncrypt(data: string | null | undefined): string | null | undefined {
  if (data === null || data === undefined) {
    return data;
  }
  return encryptData(data);
}

/**
 * Safe decryption that handles null/undefined values
 * @param data Data to decrypt (can be null/undefined)
 * @returns Decrypted string or original value if null/undefined
 */
export function safeDecrypt(data: string | null | undefined): string | null | undefined {
  if (data === null || data === undefined) {
    return data;
  }
  return decryptData(data);
}

/**
 * Generate a salt for a new user
 * @returns A new salt string
 */
export function generateNewUserSalt(): string {
  return CryptoJS.lib.WordArray.random(SALT_SIZE).toString();
}

/**
 * Test if the password can decrypt the given data
 * This is useful for password verification without server check
 * @param password The password to test
 * @param encryptedSample An encrypted sample to try decrypting
 * @param salt The salt used for key derivation
 * @returns True if decryption succeeded
 */
export function testDecryption(
  password: string, 
  encryptedSample: string, 
  salt: string
): boolean {
  if (!encryptedSample.startsWith(ENCRYPTION_MARKER)) {
    return false;
  }
  
  try {
    const { key } = deriveKeyFromPassword(password, salt);
    
    // Extract components from encrypted string
    const parts = encryptedSample.substring(ENCRYPTION_MARKER.length).split(':');
    if (parts.length !== 3) return false;
    
    const [version, nonceBase64, encryptedBase64] = parts;
    if (version !== ENCRYPTION_VERSION) return false;
    
    // Decode from base64
    const nonce = decodeBase64(nonceBase64);
    const encrypted = decodeBase64(encryptedBase64);
    
    // Attempt decryption
    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    
    // If we got something back, decryption succeeded
    return decrypted !== null;
  } catch (error) {
    return false;
  }
}