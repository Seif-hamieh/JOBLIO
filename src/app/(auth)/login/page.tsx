import { pageTitle } from "@/i18n/server";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { enabledSocialProviders } from "@/server/auth";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-redirect";

export const generateMetadata = pageTitle("auth.signIn");

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  if (await getViewer()) redirect(dest);
  return <LoginForm next={dest} providers={enabledSocialProviders} />;
}
