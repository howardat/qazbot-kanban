// Profile photo limits, shared by the server (validation, the Storage bucket) and the browser, which
// crops and shrinks the picked image to a PHOTO_SIZE square before uploading it.

export const PHOTO_SIZE = 256;
export const MAX_PHOTO_BYTES = 512 * 1024;
export const PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"];
