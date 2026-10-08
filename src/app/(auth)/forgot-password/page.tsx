import { pageTitle } from "@/i18n/server";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { devMailboxEnabled } from "@/server/mail";

export const generateMetadata = pageTitle("auth.forgotTitle");

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm devMailbox={devMailboxEnabled()} />;
}
