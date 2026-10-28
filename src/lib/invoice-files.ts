// Invoice upload limits, shared by the server (validation, the Storage bucket) and the browser (checks
// before uploading, so an oversized file is refused at once with a clear message).

export const MAX_INVOICE_BYTES = 1024 * 1024;
export const MAX_INVOICE_MB = 1;
export const INVOICE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
