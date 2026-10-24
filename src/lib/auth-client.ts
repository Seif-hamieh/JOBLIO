"use client";

import type { T } from "@/i18n/translate";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

/** Maps Better Auth error codes to friendly, non-enumerating messages. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined, t: T) {
  if (!error) return t("common.somethingWrong");
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t("auth.errInvalid");
    case "EMAIL_NOT_VERIFIED":
      return t("auth.errUnverified");
    case "ACCOUNT_BANNED":
      return t("auth.errBanned");
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return t("auth.errExists");
    case "WEAK_PASSWORD_COMMON":
      return t("auth.weak.common");
    case "WEAK_PASSWORD_REPEATED":
      return t("auth.weak.repeated");
    case "WEAK_PASSWORD_SEQUENCE":
      return t("auth.weak.sequence");
    case "WEAK_PASSWORD_PERSONAL":
      return t("auth.weak.personal");
    case "PASSWORD_TOO_SHORT":
      return t("auth.errShort");
    case "PASSWORD_TOO_LONG":
      return t("auth.errLong");
    case "INVALID_TOKEN":
      return t("auth.errToken");
  }
  if (error.status === 429) return t("auth.errRate");
  return t("common.somethingWrong");
}