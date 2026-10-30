import { pageTitle } from "@/i18n/server";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { enabledSocialProviders } from "@/server/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { devMailboxEnabled } from "@/server/mail";
import { USER_INTENTS, type UserIntent } from "@/lib/constants";

export const generateMetadata = pageTitle("auth.createAccount");

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  if (await getViewer()) redirect("/feed");
  const { intent } = await searchParams;
  const initial = typeof intent === "string" && USER_INTENTS.includes(intent as UserIntent) ? (intent as UserIntent) : null;
  return <RegisterForm initialIntent={initial} providers={enabledSocialProviders} devMailbox={devMailboxEnabled()} />;
}
