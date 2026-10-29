import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INVOICE_TYPES, MAX_INVOICE_BYTES } from "@/lib/invoice-files";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/photo-files";

// Supabase Storage for expense invoices and profile photos, from the server with the secret key (Storage RLS doesn't apply).
// Callers check the signed-in user first. The bucket is private: files are only reachable through
// short-lived signed URLs handed out by /api/expenses/invoices/[id].

export const INVOICE_BUCKET = "invoices";
export { INVOICE_TYPES, MAX_INVOICE_BYTES } from "@/lib/invoice-files";

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set, so invoices can't be stored.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let bucketReady: Promise<void> | null = null;

/** Creates the private invoices bucket, or brings an existing one's limits up to date, once per server process. */
function ensureBucket(client: SupabaseClient) {
  bucketReady ??= (async () => {
    const options = { public: false, fileSizeLimit: MAX_INVOICE_BYTES, allowedMimeTypes: INVOICE_TYPES };
    if (!(await client.storage.getBucket(INVOICE_BUCKET)).error) {
      const { error } = await client.storage.updateBucket(INVOICE_BUCKET, options);
      if (error) throw error;
      return;
    }
    const { error } = await client.storage.createBucket(INVOICE_BUCKET, options);
    if (error && !/exists/i.test(error.message)) throw error;
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

/** A one-time token the browser uses to upload a file straight to `path` (skips the server's body size limit). */
export async function invoiceUploadToken(path: string) {
  const client = admin();
  await ensureBucket(client);
  const { data, error } = await client.storage.from(INVOICE_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

/** Whether an uploaded file is really there, so a row is never saved for a failed upload. */
export async function invoiceExists(path: string) {
  const { data } = await admin().storage.from(INVOICE_BUCKET).exists(path);
  return !!data;
}

/** A link to the file that works for one minute. */
export async function invoiceSignedUrl(path: string) {
  const { data, error } = await admin().storage.from(INVOICE_BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeInvoiceFiles(paths: string[]) {
  if (paths.length) await admin().storage.from(INVOICE_BUCKET).remove(paths);
}

// Profile photos live in a public bucket: they show next to names everywhere, so a plain URL is
// stored in profile.image. Each upload gets a new file name, so browsers never show a stale photo.

export const PHOTO_BUCKET = "avatars";

let photoBucketReady: Promise<void> | null = null;

function ensurePhotoBucket(client: SupabaseClient) {
  photoBucketReady ??= (async () => {
    const options = { public: true, fileSizeLimit: MAX_PHOTO_BYTES, allowedMimeTypes: PHOTO_TYPES };
    if (!(await client.storage.getBucket(PHOTO_BUCKET)).error) {
      const { error } = await client.storage.updateBucket(PHOTO_BUCKET, options);
      if (error) throw error;
      return;
    }
    const { error } = await client.storage.createBucket(PHOTO_BUCKET, options);
    if (error && !/exists/i.test(error.message)) throw error;
  })().catch((e) => {
    photoBucketReady = null;
    throw e;
  });
  return photoBucketReady;
}

/** Stores a person's photo, removes their earlier ones, and returns its public URL. */
export async function savePhoto(userId: string, file: File) {
  const client = admin();
  await ensurePhotoBucket(client);
  const bucket = client.storage.from(PHOTO_BUCKET);
  const name = `${Date.now()}.${file.type.split("/")[1]}`;
  const { error } = await bucket.upload(`${userId}/${name}`, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  await removePhotos(userId, name);
  return bucket.getPublicUrl(`${userId}/${name}`).data.publicUrl;
}

/** Removes a person's photo files, except `keep`. */
export async function removePhotos(userId: string, keep?: string) {
  const bucket = admin().storage.from(PHOTO_BUCKET);
  const { data } = await bucket.list(userId);
  const old = (data ?? []).filter((f) => f.name !== keep).map((f) => `${userId}/${f.name}`);
  if (old.length) await bucket.remove(old);
}
