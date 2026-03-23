import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plain object into a single base64 string (iv + ciphertext + authTag).
 */
export function encryptCredentials(
  plain: Record<string, string>
): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const json = JSON.stringify(plain);
  const encrypted = Buffer.concat([
    cipher.update(json, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64 string back into the original credential object.
 */
export function decryptCredentials(
  encoded: string
): Record<string, string> {
  const key = getEncryptionKey();
  const packed = Buffer.from(encoded, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Check if a credential value looks like it's already encrypted (base64 blob).
 * Used to avoid double-encryption.
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // Encrypted values are base64 with minimum length (iv + authTag = 28 bytes = ~38 base64 chars)
  return value.length > 38 && /^[A-Za-z0-9+/]+=*$/.test(value);
}
