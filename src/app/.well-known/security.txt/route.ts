import { APP_URL } from "@/lib/utils";

// RFC 9116 security contact. "Expires" must be in the future, so it is computed (one year ahead).
const CONTACT = process.env.SECURITY_EMAIL || process.env.CONTACT_EMAIL || "support@getjoblio.app";

export function GET() {
  const expires = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const body = [
    `Contact: mailto:${CONTACT}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, ar",
    `Canonical: ${APP_URL}/.well-known/security.txt`,
    `Policy: ${APP_URL}/contact`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
