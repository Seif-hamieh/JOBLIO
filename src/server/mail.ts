import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { createT } from "@/i18n/translate";
import { fromAcceptLanguage, isLocale, LOCALE_COOKIE, LOCALE_META, type Locale } from "@/i18n/config";

type Email = { to: string; subject: string; text: string; html: string };

let transporter: Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export type DevEmail = Email & { id: string; at: Date };

/** Development without SMTP: emails are kept in memory and shown at /dev-mailbox. */
export function devMailboxEnabled() {
  return process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST;
}

const store = globalThis as unknown as { __joblioMailbox?: DevEmail[] };

export function devMailbox(): DevEmail[] {
  return devMailboxEnabled() ? (store.__joblioMailbox ?? []) : [];
}

/**
 * Sends a transactional email. Without SMTP configured (local development),
 * the message is printed to the server console and kept in the test inbox.
 */
export async function sendEmail(email: Email) {
  const t = getTransporter();
  if (!t) {
    console.info(`\n✉️  [dev email] to=${email.to}\n   subject: ${email.subject}\n   ${email.text.replace(/\n/g, "\n   ")}\n`);
    if (devMailboxEnabled()) {
      store.__joblioMailbox = [{ ...email, id: crypto.randomUUID(), at: new Date() }, ...(store.__joblioMailbox ?? [])].slice(0, 50);
    }
    return;
  }
  await t.sendMail({ from: process.env.EMAIL_FROM ?? "JOBLIO <no-reply@joblio.com>", ...email });
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The language for an auth email: the request's language cookie, else the browser's preference. */
export function localeFromRequest(request?: Request): Locale {
  if (!request) return "en";
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
  return isLocale(cookie) ? cookie : fromAcceptLanguage(request.headers.get("accept-language"));
}

function layout(locale: Locale, title: string, body: string, cta: { label: string; url: string }) {
  const t = createT(locale);
  const dir = LOCALE_META[locale].dir;
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f4f5fb;font-family:Inter,'Segoe UI',Tahoma,Arial,sans-serif;color:#1b1d2e">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" dir="${dir}" style="background:#fff;border-radius:16px;padding:40px;border:1px solid #e6e8f2;text-align:${dir === "rtl" ? "right" : "left"}">
  <tr><td style="font-weight:700;font-size:20px;color:#5b4ee8">JOBLIO</td></tr>
  <tr><td style="padding-top:24px;font-size:22px;font-weight:600">${escapeHtml(title)}</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.7;color:#4a4e66">${escapeHtml(body)}</td></tr>
  <tr><td style="padding-top:28px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#5b4ee8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(cta.label)}</a></td></tr>
  <tr><td style="padding-top:28px;font-size:12px;color:#8a8ea8">${escapeHtml(t("email.ignore"))}</td></tr>
  </table></td></tr></table></body></html>`;
}

function authEmail(locale: Locale, kind: "verify" | "reset", name: string, url: string): Omit<Email, "to"> {
  const t = createT(locale);
  const body = t(`email.${kind}Body`, { name });
  const title = t(`email.${kind}Title`);
  return {
    subject: t(`email.${kind}Subject`),
    text: `${body}\n\n${url}\n\n${t("email.ignore")}`,
    html: layout(locale, title, body, { label: t(`email.${kind}Cta`), url }),
  };
}

export const emails = {
  verify: (name: string, url: string, locale: Locale = "en") => authEmail(locale, "verify", name, url),
  resetPassword: (name: string, url: string, locale: Locale = "en") => authEmail(locale, "reset", name, url),
};

