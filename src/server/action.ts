import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getViewer, type RecruiterViewer, type Viewer } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { getI18n } from "@/i18n/server";
import { k, resolveMessage } from "@/i18n/message";
import type { T } from "@/i18n/translate";

export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type ActionState<T = undefined> = { ok: true; message?: string; data?: T } | ActionFailure | null;

/** A user-facing failure; its message (usually an encoded key, see `k()`) is safe to show. */
export class ActionError extends Error {}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionFailure {
  return { ok: false, error, fieldErrors };
}

/** Translates encoded message keys in a result into the reader's language. */
export function localizeState<S extends ActionState<unknown>>(t: T, state: S): S {
  if (!state) return state;
  if (state.ok) return state.message ? { ...state, message: resolveMessage(t, state.message) } : state;
  const fieldErrors = state.fieldErrors
    ? Object.fromEntries(Object.entries(state.fieldErrors).map(([f, errs]) => [f, errs?.map((e) => resolveMessage(t, e))]))
    : undefined;
  return { ...state, error: resolveMessage(t, state.error), fieldErrors };
}

/**
 * Wraps a server action body: enforces sign-in, applies a per-user rate limit,
 * and converts thrown errors into a serialisable, translated result. Next.js
 * control-flow errors (redirect, notFound) are re-thrown untouched.
 */
export async function withViewer<R>(
  opts: { limit?: { key: string; max: number; windowMs: number } },
  fn: (viewer: Viewer) => Promise<ActionState<R>>,
): Promise<ActionState<R>> {
  const { t } = await getI18n();
  try {
    const viewer = await getViewer();
    if (!viewer) return localizeState(t, fail(k("msg.signIn")));
    if (opts.limit) {
      const res = rateLimit(`${opts.limit.key}:${viewer.id}`, opts.limit.max, opts.limit.windowMs);
      if (!res.ok) return localizeState(t, fail(k("msg.tooOften", { s: res.retryAfterSeconds })));
    }
    return localizeState(t, await fn(viewer));
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ActionError) return localizeState(t, fail(err.message));
    console.error("[action]", err);
    return localizeState(t, fail(k("msg.error")));
  }
}

export async function withRecruiter<R>(
  opts: { limit?: { key: string; max: number; windowMs: number } },
  fn: (viewer: RecruiterViewer) => Promise<ActionState<R>>,
): Promise<ActionState<R>> {
  return withViewer(opts, async (viewer) => {
    if (!viewer.company) return fail(k("msg.needWorkspace"));
    return fn(viewer as RecruiterViewer);
  });
}

/**
 * Language-neutral zod messages: built-in issues become encoded `v.*` keys,
 * custom schema messages (already `@v.*` keys) are kept as written.
 */
const keyedErrors: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null || issue.input === "" ? k("v.required") : k("v.invalid");
    case "too_small": {
      const n = Number(issue.minimum);
      if (issue.origin === "string") return n <= 1 ? k("v.required") : k("v.tooShort", { n });
      if (issue.origin === "array" || issue.origin === "set") return k("v.tooFew", { n });
      return k("v.min", { n });
    }
    case "too_big": {
      const n = Number(issue.maximum);
      if (issue.origin === "string") return k("v.tooLong", { n });
      if (issue.origin === "array" || issue.origin === "set") return k("v.tooMany", { n });
      return k("v.max", { n });
    }
    case "invalid_format":
      if (issue.format === "email") return k("v.email");
      if (issue.format === "url") return k("v.url");
      return k("v.invalid");
    default:
      return k("v.invalid");
  }
};

/** Parses FormData (or a plain object) with a zod schema into an ActionState error on failure. */
export function parse<S extends z.ZodType>(schema: S, input: unknown):
  | { success: true; data: z.infer<S> }
  | { success: false; state: ActionFailure } {
  const result = schema.safeParse(input, { error: keyedErrors });
  if (result.success) return { success: true, data: result.data };
  const flat = z.flattenError(result.error);
  const first = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0];
  return {
    success: false,
    state: fail(typeof first === "string" ? first : k("msg.checkFields"), flat.fieldErrors as Record<string, string[]>),
  };
}

/** FormData → plain object; repeated keys become arrays. */
export function formToObject(form: FormData) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (out[k] ??= [] as unknown[]);
      (out[k] as unknown[]).push(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
