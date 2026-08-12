/**
 * utils/encryption.js — AES-256-GCM field-level encryption for HIPAA PII
 *
 * WHICH FIELDS ARE ENCRYPTED:
 *  ✅  name          — directly identifies a person
 *  ✅  gender        — PII when combined with other data
 *  ✅  patient_id    — the hospital's own patient identifier (could link records)
 *
 * WHICH FIELDS ARE NOT ENCRYPTED (rule engine needs raw values):
 *  ❌  age, heart_rate, blood_pressure_sys/dia, visit_count, admission_count, price
 *
 * STORAGE FORMAT:
 *  Every encrypted column stores: "ivHex:ciphertextHex:authTagHex"
 *  Example: "a1b2c3...:deadbeef...:f00dba..."
 *  Each encryption call produces a unique IV → same plaintext → different ciphertext.
 *
 * KEY REQUIREMENTS:
 *  - Exactly 32 hex characters (= 16 raw bytes = 128-bit key for AES-256... wait)
 *  - Actually for AES-256-GCM Node.js expects a 32-BYTE key.
 *  - Generate a 32-byte hex string (64 hex chars):
 *      $ node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *  - Store in .env as ENCRYPTION_KEY=<64 hex chars>
 *  - NEVER commit to git. Add .env to .gitignore.
 *
 * KEY ROTATION (future):
 *  Run a migration script that decrypts each row with the OLD key,
 *  re-encrypts with the NEW key, and saves. The format is self-contained
 *  (IV + authTag embedded) so each cell can be rotated independently.
 */

"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 16;
const KEY_HEX = process.env.ENCRYPTION_KEY;

// ── Validate key at module load time ─────────────────────────────────────────
if (!KEY_HEX) {
  throw new Error(
    "[encryption] ENCRYPTION_KEY is not set in environment.\n" +
      "Generate one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      "Then add ENCRYPTION_KEY=<result> to your .env file.",
  );
}

const KEY_BUFFER = Buffer.from(KEY_HEX, "hex");

if (KEY_BUFFER.length !== 32) {
  throw new Error(
    `[encryption] ENCRYPTION_KEY must be 64 hex chars (32 bytes). ` +
      `Got ${KEY_HEX.length} hex chars = ${KEY_BUFFER.length} bytes.`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// encryptField(plaintext) → "ivHex:ciphertextHex:authTagHex"
// ══════════════════════════════════════════════════════════════════════════════
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return null;
  }

  const text = String(plaintext);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag(); // 16-byte GCM auth tag

  return [
    iv.toString("hex"),
    encrypted.toString("hex"),
    authTag.toString("hex"),
  ].join(":");
}

// ══════════════════════════════════════════════════════════════════════════════
// decryptField("ivHex:ciphertextHex:authTagHex") → plaintext string
// ══════════════════════════════════════════════════════════════════════════════
function decryptField(stored) {
  if (!stored) return null;

  const parts = stored.split(":");
  if (parts.length !== 3) {
    // Not in our format — return as-is so old plaintext rows don't crash
    console.warn(
      "[encryption] decryptField: unexpected format, returning raw value",
    );
    return stored;
  }

  const [ivHex, ciphertextHex, authTagHex] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    // Auth tag mismatch = tampered data. Log and return null — never throw
    // in a getter (Sequelize will swallow it silently anyway).
    console.error(
      "[encryption] decryptField: auth tag mismatch or corrupt data:",
      err.message,
    );
    return null;
  }
}

module.exports = { encryptField, decryptField };
