import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INVOICE_TYPES, MAX_INVOICE_BYTES } from "@/lib/invoice-files";

// Supabase Storage for expense invoices, from the server with the secret key (Storage RLS doesn't apply).
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
