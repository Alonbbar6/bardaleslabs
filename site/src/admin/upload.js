// Admin upload helpers. Photos are resized in the browser (phone photos are 3-12 MB) and re-encoded as JPEG,
// which also drops EXIF metadata such as the GPS position where the photo was taken.
// Product files go up in 10 MiB parts so size isn't capped by the Worker's 100 MB request limit.

const FULL = 1600, THUMB = 640, CHUNK = 10 * 1024 * 1024;

/** XMLHttpRequest instead of fetch: it reports upload progress. Rejects with err.status set. */
export function xhr(method, url, body, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (body && !(body instanceof FormData) && !(body instanceof Blob)) { x.setRequestHeader("content-type", "application/json"); body = JSON.stringify(body); }
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) { try { return resolve(JSON.parse(x.responseText)); } catch { return reject(new Error("Unexpected response from the server.")); } }
      let msg = x.responseText; try { msg = JSON.parse(msg).error || msg; } catch {}
      reject(Object.assign(new Error(msg || `Upload failed (${x.status})`), { status: x.status }));
    };
    x.onerror = () => reject(Object.assign(new Error("Network error. Check your connection and try again."), { status: 0 }));
    x.send(body);
  });
}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try { const b = await createImageBitmap(file, { imageOrientation: "from-image" }); return { src: b, w: b.width, h: b.height, done: () => b.close() }; } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file), img = new Image();
  img.src = url;
  try { await img.decode(); } catch { URL.revokeObjectURL(url); throw new Error(`Can't read "${file.name}". Use a JPEG or PNG (iPhone converts HEIC automatically when you pick from Photos).`); }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

function toJpeg(src, w, h, max, quality) {
  const s = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("Couldn't process this photo."))), "image/jpeg", quality));
}

export async function resizePhoto(file) {
  const { src, w, h, done } = await decode(file);
  try { return { full: await toJpeg(src, w, h, FULL, 0.82), thumb: await toJpeg(src, w, h, THUMB, 0.78) }; } finally { done(); }
}

/** Resize + upload one photo. kind: "cars" | "products". Resolves to the photo id. */
export async function uploadPhoto(file, kind, { onPreview = () => {}, onProgress = () => {} } = {}) {
  const { full, thumb } = await resizePhoto(file);
  onPreview(URL.createObjectURL(thumb));
  const fd = new FormData();
  fd.append("kind", kind); fd.append("full", full, "full.jpg"); fd.append("thumb", thumb, "thumb.jpg");
  return (await xhr("POST", "/api/admin/upload", fd, onProgress)).id;
}

/** Upload any file to R2 in parts. Resolves to { key, size, name, type }. */
export async function uploadFile(file, onProgress = () => {}) {
  if (!file.size) throw new Error("That file is empty.");
  const { key, uploadId } = await xhr("POST", "/api/admin/file?action=create", { name: file.name, type: file.type });
  const q = (extra) => `/api/admin/file?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&${extra}`;
  const count = Math.ceil(file.size / CHUNK), parts = [];
  try {
    for (let n = 1; n <= count; n++) {
      const start = (n - 1) * CHUNK, blob = file.slice(start, start + CHUNK);
      for (let attempt = 1; ; attempt++) { // phones drop connections; retry each part a few times
        try { parts.push(await xhr("PUT", q(`action=part&part=${n}`), blob, (p) => onProgress((start + p * blob.size) / file.size))); break; }
        catch (e) { if (attempt >= 3 || e.status === 401 || e.status === 422) throw e; await new Promise(r => setTimeout(r, 1500 * attempt)); }
      }
    }
    const done = await xhr("POST", "/api/admin/file?action=complete", { key, uploadId, parts });
    return { key: done.key, size: done.size, name: file.name, type: file.type || "application/octet-stream" };
  } catch (e) {
    xhr("POST", "/api/admin/file?action=abort", { key, uploadId }).catch(() => {});
    throw e;
  }
}
