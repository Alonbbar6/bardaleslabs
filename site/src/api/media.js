// R2 storage (binding MEDIA).
//   media/cars/<id>.jpg, media/cars/<id>-t.jpg          car photos (full + thumbnail), public at /media/...
//   media/products/<id>.jpg, media/products/<id>-t.jpg  product covers, public at /media/...
//   files/<random>/<name>                               paid downloads; never public, only via a download token
import { json, text, readJson, rid } from "./util.js";

const PUBLIC_KEY = /^(cars|products)\/[a-z0-9]{6,32}(-t)?\.jpg$/;
export const PHOTO_ID = /^[a-z0-9]{6,32}$/;
export const FILE_KEY = /^files\/[a-z0-9]{12}\/[^/]{1,180}$/;
const MAX_IMAGE = 15 * 1024 * 1024;
const NO_BUCKET = "R2 bucket isn't bound. Create it with `npx wrangler r2 bucket create bardaleslabs-media`, then deploy.";

/** GET /media/<cars|products>/<id>[-t].jpg */
export async function serveMedia(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return text("method not allowed", 405);
  const rest = new URL(request.url).pathname.slice("/media/".length);
  if (!PUBLIC_KEY.test(rest) || !env.MEDIA) return text("not found", 404);
  const obj = await env.MEDIA.get(`media/${rest}`);
  if (!obj) return text("not found", 404);
  return new Response(request.method === "HEAD" ? null : obj.body, {
    headers: { "content-type": obj.httpMetadata?.contentType || "image/jpeg", "content-length": String(obj.size), etag: obj.httpEtag, "cache-control": "public, max-age=31536000, immutable" },
  });
}

/** POST /api/admin/upload  multipart: kind=cars|products, full=<jpeg>, thumb=<jpeg>. The browser resizes and strips EXIF/GPS first. */
export async function uploadImage(request, env) {
  if (request.method !== "POST") return text("method not allowed", 405);
  if (!env.MEDIA) return json({ error: NO_BUCKET }, 503);
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind"), full = form?.get("full"), thumb = form?.get("thumb");
  if (!["cars", "products"].includes(kind) || !(full instanceof File) || !(thumb instanceof File)) return text("expected kind, full and thumb", 422);
  for (const f of [full, thumb]) if (f.type !== "image/jpeg" || !f.size || f.size > MAX_IMAGE) return text("photos must be JPEG and under 15 MB", 422);
  const id = rid(12), opts = { httpMetadata: { contentType: "image/jpeg" } };
  await Promise.all([env.MEDIA.put(`media/${kind}/${id}.jpg`, full, opts), env.MEDIA.put(`media/${kind}/${id}-t.jpg`, thumb, opts)]);
  return json({ id });
}

export function deleteImages(env, kind, ids) {
  const keys = ids.filter(id => PHOTO_ID.test(id)).flatMap(id => [`media/${kind}/${id}.jpg`, `media/${kind}/${id}-t.jpg`]);
  return keys.length && env.MEDIA ? env.MEDIA.delete(keys) : Promise.resolve();
}

/**
 * Product files of any size, uploaded in parts (Workers cap a request body at 100 MB).
 *   POST /api/admin/file?action=create   {name, type}                -> {key, uploadId}
 *   PUT  /api/admin/file?action=part&key=&uploadId=&part=N  <bytes>  -> {partNumber, etag}
 *   POST /api/admin/file?action=complete {key, uploadId, parts}      -> {key, size}
 *   POST /api/admin/file?action=abort    {key, uploadId}
 * Every part except the last must be the same size (R2 rule); the admin sends 10 MiB parts.
 */
export async function fileUpload(request, env) {
  if (!env.MEDIA) return json({ error: NO_BUCKET }, 503);
  const u = new URL(request.url), action = u.searchParams.get("action");
  if (action === "part" && request.method === "PUT") {
    const key = u.searchParams.get("key") || "", uploadId = u.searchParams.get("uploadId"), n = +u.searchParams.get("part");
    if (!FILE_KEY.test(key) || !uploadId || !(n >= 1 && n <= 10000)) return text("bad part", 422);
    const part = await env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(n, await request.arrayBuffer());
    return json({ partNumber: part.partNumber, etag: part.etag });
  }
  if (request.method !== "POST") return text("method not allowed", 405);
  const b = await readJson(request) || {};
  if (action === "create") {
    const name = String(b.name || "file").replace(/[\\/\x00-\x1f\x7f]/g, "_").trim().slice(-180) || "file";
    const up = await env.MEDIA.createMultipartUpload(`files/${rid(12)}/${name}`, { httpMetadata: { contentType: String(b.type || "application/octet-stream").slice(0, 120) } });
    return json({ key: up.key, uploadId: up.uploadId });
  }
  if (!FILE_KEY.test(b.key || "") || !b.uploadId) return text("bad upload", 422);
  const up = env.MEDIA.resumeMultipartUpload(b.key, b.uploadId);
  if (action === "complete") {
    if (!Array.isArray(b.parts) || !b.parts.length) return text("no parts", 422);
    const obj = await up.complete(b.parts.map(p => ({ partNumber: +p.partNumber, etag: String(p.etag) })));
    return json({ key: obj.key, size: obj.size });
  }
  if (action === "abort") { await up.abort(); return json({ ok: true }); }
  return text("unknown action", 400);
}
