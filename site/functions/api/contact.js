// Cloudflare Pages Function: POST /api/contact -> email via Resend.
// Env vars (Pages > Settings > Variables): RESEND_API_KEY, CONTACT_TO (default alonso@bardaleslabs.com), CONTACT_FROM (verified sender).
export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
  const { name = "", email = "", company = "", message = "", interest = "", website = "", page = "" } = data;
  if (website) return new Response("ok", { status: 200 }); // honeypot: pretend success
  if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message.trim()) return new Response("missing fields", { status: 422 });
  // always keep a copy in the admin inbox, even when email isn't configured
  if (env.DB) await env.DB.prepare("INSERT INTO inbox (ts, name, email, company, interest, message, page) VALUES (?,?,?,?,?,?,?)").bind(Date.now(), name, email, company, interest, message, page).run().catch(() => {});
  if (!env.RESEND_API_KEY) return Response.json({ ok: true, stored: true, mailed: false });

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const html = `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt;${company ? ` · ${esc(company)}` : ""}</p>
<p><b>Interest:</b> ${esc(interest || "-")}<br><b>Page:</b> ${esc(page)}</p>
<pre style="font:14px/1.5 system-ui;white-space:pre-wrap">${esc(message)}</pre>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.CONTACT_FROM || "BardalesLabs <site@bardaleslabs.com>",
      to: [env.CONTACT_TO || "alonso@bardaleslabs.com"],
      reply_to: email,
      subject: `Call request — ${company || name}`,
      html,
    }),
  });
  if (!r.ok) return new Response(await r.text(), { status: 502 });
  return Response.json({ ok: true });
}
