import nodemailer from 'nodemailer';

const env = (k) => process.env[k]?.trim() || undefined;

let transport;
function getTransport() {
  const host = env('SMTP_HOST');
  if (!host) return null;
  transport ??= nodemailer.createTransport({
    host,
    port: Number(env('SMTP_PORT') ?? 587),
    secure: env('SMTP_SECURE') === 'true',
    auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
  });
  return transport;
}

export const mailEnabled = () => Boolean(getTransport());
const from = () => env('MAIL_FROM') ?? env('SMTP_USER') ?? 'no-reply@akruti.local';
export const notifyRecipients = () => (env('DEMO_NOTIFY_EMAIL') ?? '').split(/[,;\s]+/).filter(Boolean);

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function send(message) {
  const t = getTransport();
  if (!t) {
    console.warn(`[mail] SMTP_HOST not set; skipped "${message.subject}" to ${message.to}`);
    return false;
  }
  await t.sendMail({ from: from(), ...message });
  return true;
}

/** "Confirm your email" link mail: the first step of every new requester. */
export function sendVerification(r, url) {
  const first = esc(r.name.split(/\s+/)[0]);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#0c0a09">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0c0a09;padding:28px 40px;color:#fafaf9;font-size:18px;letter-spacing:.2em;text-transform:uppercase;font-weight:300">Akruti.</td></tr>
<tr><td style="padding:40px">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:500">One quick step, ${first}.</h1>
<p style="margin:0 0 24px;line-height:1.6;color:#44403c">Please confirm your email address so we can process your demo request.</p>
<p style="margin:0 0 28px"><a href="${esc(url)}" style="display:inline-block;background:#0c0a09;color:#fafaf9;text-decoration:none;padding:14px 32px;border-radius:999px;font-size:14px">Confirm my email</a></p>
<p style="margin:0 0 8px;color:#78716c;font-size:13px;line-height:1.5">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(url)}</span></p>
<p style="margin:16px 0 0;color:#a8a29e;font-size:12px">This link is valid for 72 hours. If you didn't ask for a demo, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${r.name.split(/\s+/)[0]},

Please confirm your email to process your Akruti demo request:
${url}

The link is valid for 72 hours. If you didn't ask for a demo, ignore this email.`;
  return send({ to: r.email, subject: 'Confirm your email to request your Akruti demo', text, html });
}

/** Branded "we received your request" mail to the requester. */
export function sendConfirmation(r) {
  const first = esc(r.name.split(/\s+/)[0]);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#0c0a09">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0c0a09;padding:28px 40px;color:#fafaf9;font-size:18px;letter-spacing:.2em;text-transform:uppercase;font-weight:300">Akruti.</td></tr>
<tr><td style="padding:40px">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:500">Thank you, ${first}.</h1>
<p style="margin:0 0 16px;line-height:1.6;color:#44403c">We've received your demo request${r.company ? ` for <strong>${esc(r.company)}</strong>` : ''} and our team is already looking into it.</p>
<p style="margin:0 0 24px;line-height:1.6;color:#44403c">Expect a personal reply from us shortly to schedule your exclusive walkthrough of the Akruti platform.</p>
${r.interest ? `<p style="margin:0 0 24px;padding:14px 16px;background:#f5f5f4;border-radius:10px;font-size:14px;color:#57534e">Your area of interest: <strong>${esc(r.interest)}</strong></p>` : ''}
<p style="margin:0;color:#78716c;font-size:13px">No need to reply to this email. We'll be in touch.</p>
</td></tr>
<tr><td style="padding:20px 40px;background:#fafaf9;color:#a8a29e;font-size:12px">Akruti Platform &middot; Spatial commerce, made tangible.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Thank you, ${r.name.split(/\s+/)[0]}.\n\nWe've received your demo request and our team is looking into it. Expect a personal reply from us shortly.\n\n— Akruti`;
  return send({ to: r.email, subject: 'We received your demo request', text, html });
}

/** Plain internal alert to the configured team address(es). */
export function sendTeamNotification(r, { repeat }) {
  const to = notifyRecipients();
  if (!to.length) {
    console.warn('[mail] DEMO_NOTIFY_EMAIL not set; team notification skipped');
    return false;
  }
  const rows = [['Name', r.name], ['Email', r.email], ['Company', r.company], ['Phone', r.phone], ['Role', r.role], ['Interest', r.interest], ['Message', r.message]]
    .filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0c0a09">
<h2 style="margin:0 0 12px">New demo request${repeat ? ' (repeat)' : ''}</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#78716c;vertical-align:top">${k}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table></div>`;
  return send({
    to,
    replyTo: r.email,
    subject: `${repeat ? '[Repeat] ' : ''}Demo request: ${r.name} (${r.company})`,
    text,
    html,
  });
}
