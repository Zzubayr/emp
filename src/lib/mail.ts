import nodemailer from "nodemailer";
import { db } from "./db";

let transport: ReturnType<typeof nodemailer.createTransport> | null | undefined;
function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  transport = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transport;
}

export const mailConfigured = () => Boolean(process.env.SMTP_HOST);
const base = () =>
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "http://localhost:3000";
export const appUrl = (path = "") => `${base().replace(/\/$/, "")}${path}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(subject: string, body: string, cta?: { label: string; href: string }) {
  const paras = esc(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${cta.href}" style="background:#182346;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;border:2px solid #3ed9d9;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<div style="background:#f5f6f8;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#182346"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e1e4eb;overflow:hidden"><div style="background:#182346;color:#fff;padding:18px 32px;font-weight:700;font-size:14px;letter-spacing:.02em;border-bottom:3px solid #3ed9d9">EMSS MENTORSHIP</div><div style="padding:32px"><h1 style="font-size:20px;margin:0 0 16px">${esc(subject)}</h1>${paras}${button}<p style="margin:24px 0 0;font-size:12px;color:#5b6278">You are receiving this because you are part of the EMSS Mentorship Programme.</p></div></div></div>`;
}

/** Sends an email if SMTP is configured; always writes it to the outbox for the admin log. */
export async function sendMail(opts: { to: string; subject: string; body: string; type: string; cta?: { label: string; href: string } }) {
  const t = getTransport();
  const text = opts.cta ? `${opts.body}\n\n${opts.cta.label}: ${opts.cta.href}` : opts.body;
  const row = await db.emailMessage.create({
    data: { to: opts.to, subject: opts.subject, body: text, type: opts.type, status: "LOGGED" },
  });
  if (!t) return row;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM || "EMP <no-reply@emp.local>",
        to: opts.to, subject: opts.subject, text, html: render(opts.subject, opts.body, opts.cta),
      });
      return db.emailMessage.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), attempts: attempt } });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return db.emailMessage.update({ where: { id: row.id }, data: { status: "FAILED", error: lastError.slice(0, 500), attempts: 3 } });
}
