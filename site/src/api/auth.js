import { json, text, readJson, hmac, safeEqual, cookie } from "./util.js";

const NAME = "bl_admin", DAYS = 30;

export async function login(request, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD secret is not set" }, 503);
  const b = await readJson(request);
  if (!b?.password || !safeEqual(String(b.password), env.ADMIN_PASSWORD)) { await new Promise(r => setTimeout(r, 600)); return json({ error: "wrong password" }, 401); }
  const exp = Date.now() + DAYS * 864e5, sig = await hmac(env.ADMIN_PASSWORD, "admin:" + exp);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json({ ok: true }, 200, { "set-cookie": `${NAME}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}` });
}
export const logout = () => json({ ok: true }, 200, { "set-cookie": `${NAME}=; Path=/; HttpOnly; Max-Age=0` });

export async function isAdmin(request, env) {
  const c = cookie(request, NAME); if (!c || !env.ADMIN_PASSWORD) return false;
  const [exp, sig] = c.split("."); if (!exp || !sig || +exp < Date.now()) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, "admin:" + exp));
}
export const unauthorized = () => text("unauthorized", 401);
