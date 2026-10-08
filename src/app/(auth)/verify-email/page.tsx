import { pageTitle } from "@/i18n/server";
import { ResendVerification } from "@/components/auth/password-forms";
import { devMailboxEnabled } from "@/server/mail";

export const generateMetadata = pageTitle("auth.verifyTitle");

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { email, error } = await searchParams;
  return <ResendVerification email={typeof email === "string" ? email : ""} error={!!error} devMailbox={devMailboxEnabled()} />;
}
