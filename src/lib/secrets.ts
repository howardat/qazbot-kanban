import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encryption for secrets people hand us (their OpenRouter keys), so the database alone never holds
// them in the clear. AES-256-GCM with SECRETS_KEY: 32 random bytes, base64. Generate one with
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

function key() {
  const raw = process.env.SECRETS_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new Error("SECRETS_KEY is missing or not 32 bytes of base64.");
  return buf;
}

export const secretsConfigured = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

/** "v1.<iv>.<tag>.<ciphertext>", each part base64url. */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(sealed: string) {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
