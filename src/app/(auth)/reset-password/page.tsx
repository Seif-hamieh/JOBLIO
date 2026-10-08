import { pageTitle } from "@/i18n/server";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const generateMetadata = pageTitle("auth.newPasswordTitle");

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : null} invalid={!!error} />;
}
