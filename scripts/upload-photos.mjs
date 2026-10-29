// Sets profile photos in bulk from a folder of images named after people, e.g. "Aidar.jpg".
//
//   node --env-file=.env.production.local scripts/upload-photos.mjs "<folder>"          # dry run
//   node --env-file=.env.production.local scripts/upload-photos.mjs "<folder>" --apply  # upload
//
// A file matches the one profile whose first name (or, without a name, email before the @) starts
// with the file name, ignoring case. Files with no match or several matches are listed and skipped;
// match those by hand with --as, e.g. --as Shamuel=shamil@example.com (repeatable).
// Needs DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Uploads go to the public
// "avatars" bucket the same way the /avatar page does (lib/storage savePhoto), replacing older photos.

import { readdir, readFile } from "node:fs/promises";
import { extname, join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const folder = process.argv[2];
const apply = process.argv.includes("--apply");
const by = Object.fromEntries(
  process.argv.flatMap((a, i) => (process.argv[i - 1] === "--as" ? [a.split("=")] : [])).map(([f, e]) => [f.toLowerCase(), e.toLowerCase()]),
);
if (!folder) throw new Error('Usage: upload-photos.mjs "<folder>" [--apply]');

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const MAX_BYTES = 512 * 1024;
const BUCKET = "avatars";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const people = await sql`select id, name, email, image from profile`;
const firstName = (p) => (p.name?.trim().split(/\s+/)[0] ?? p.email.split("@")[0]).toLowerCase();

const plan = [];
for (const file of (await readdir(folder)).sort()) {
  const type = TYPES[extname(file).toLowerCase()];
  if (!type) continue;
  const key = basename(file, extname(file)).toLowerCase();
  const matches = people.filter((p) => (by[key] ? p.email === by[key] : firstName(p).startsWith(key)));
  if (matches.length !== 1) {
    console.log(`skip  ${file}: ${matches.length ? `matches ${matches.map((p) => p.email).join(", ")}` : "no matching profile"}`);
    continue;
  }
  const bytes = await readFile(join(folder, file));
  if (bytes.length > MAX_BYTES) {
    console.log(`skip  ${file}: ${Math.round(bytes.length / 1024)} KB is over ${MAX_BYTES / 1024} KB`);
    continue;
  }
  const [p] = matches;
  console.log(`${apply ? "set " : "would set"}  ${file} -> ${p.name ?? "(no name)"} <${p.email}>${p.image ? " (replaces a photo)" : ""}`);
  plan.push({ person: p, bytes, type });
}

if (apply && plan.length) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const options = { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"] };
  if ((await client.storage.getBucket(BUCKET)).error) {
    const { error } = await client.storage.createBucket(BUCKET, options);
    if (error && !/exists/i.test(error.message)) throw error;
  }
  const bucket = client.storage.from(BUCKET);
  for (const { person, bytes, type } of plan) {
    const name = `${Date.now()}.${type.split("/")[1]}`;
    const { error } = await bucket.upload(`${person.id}/${name}`, bytes, { contentType: type, cacheControl: "31536000" });
    if (error) throw error;
    const url = bucket.getPublicUrl(`${person.id}/${name}`).data.publicUrl;
    await sql`update profile set image = ${url} where id = ${person.id}`;
    const { data } = await bucket.list(person.id);
    const old = (data ?? []).filter((f) => f.name !== name).map((f) => `${person.id}/${f.name}`);
    if (old.length) await bucket.remove(old);
  }
  console.log(`Done: ${plan.length} photos set.`);
} else if (!apply) {
  console.log(`\nDry run. Re-run with --apply to upload ${plan.length} photos.`);
}
await sql.end();
