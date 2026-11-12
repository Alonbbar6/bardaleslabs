// Transactional email through Resend (same account and sender as the contact form).
export async function sendEmail(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY || !to) return { skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.CONTACT_FROM || "BardalesLabs <site@bardaleslabs.com>", to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
  return { ok: true };
}
