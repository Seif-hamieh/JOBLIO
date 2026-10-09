# JOBLIO architecture

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, React Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS v4 (design tokens in `src/app/globals.css`), Radix primitives, Motion, dnd-kit |
| 3D | React Three Fiber (landing network scene, with an SVG fallback) |
| Data | PostgreSQL + Prisma 7 (`prisma/schema.prisma`) |
| Auth | Better Auth (email + password with scrypt, email verification, password reset, optional Google/GitHub) |
| Payments | Stripe Checkout + webhooks (no card data ever touches the app) |
| Realtime | Server-Sent Events over an in-process event hub (`src/server/realtime.ts`) |

## Folders

```
src/app/            routes: (marketing) landing, (auth) sign-in flows, (app) the product, [username] portfolios, api/*
src/components/     UI by feature (jobs, recruiter, profile, messages, …) plus ui/ primitives
src/server/         server-only code: actions/ (Server Actions), services/ (data access + rules), auth, billing, mail, storage
src/lib/            shared pure code: matching engine, validation schemas, constants, utilities
src/i18n/           languages: config, dictionaries, translator, formatters, message keys
prisma/             schema, migrations, deterministic seed
```

## Rule-based matching (no AI)

`src/lib/matching/engine.ts` scores a candidate against a job with fixed weights — skills 35 (level-aware), experience 20, location and work mode 12, job type 8, salary 7, education 6, languages 5, industry 4, and availability 3 for recruiter rankings. Criteria that don't apply are left out, and the score is points earned ÷ points possible. Each criterion returns **reason codes** (`{ key, vars }`), not sentences, so the same result can be explained in any language (`src/lib/matching/describe.ts`). Applications store a snapshot of the match at apply time.

## Internationalisation

- **Locale**: `getLocale()` reads the `joblio-locale` cookie, then `Accept-Language`. The root layout sets `<html lang dir>`. Members' choice is also saved in `UserSettings.locale`.
- **Dictionaries**: `en.ts` defines the keys, and `ar.ts` is typed against it, so a missing Arabic string is a type error. Plurals use `one|other` forms in English and `zero|one|two|few|many|other` forms in Arabic (chosen with `Intl.PluralRules`).
- **Rendering**: server components call `getI18n()`; client components call `useI18n()`. Both return `t()` plus locale-aware formatters `f` (dates, relative time, money, salaries, countries, languages). Components that render in both trees use `<Msg k="…" />`.
- **Messages from the server**: actions and services return encoded keys from `k(key, vars)`. `withViewer()` translates every result, including field errors, before it reaches the browser. Zod's built-in errors are mapped to `v.*` keys.
- **Notifications** are stored as `titleKey`/`bodyKey`/`vars` (plus an English copy) and rendered in each reader's language. Live notifications and emails use the recipient's saved language.
- **Data stored in English** (industries, skill categories) is translated at display time through `industryName()` / `categoryName()`. Member-written text keeps its own direction (`dir="auto"`).
- **RTL**: layouts use logical utilities (`ms-*`, `ps-*`, `start-*`, `text-start`), directional icons are mirrored in CSS, and motion that slides sideways checks `dir`.

## Security

- Passwords are hashed with scrypt by Better Auth; sessions are httpOnly cookies. `src/proxy.ts` only does an optimistic redirect — every page and action re-checks the session on the server (`requireViewer`, `requireRecruiter`, `canManageCompany`).
- All input is validated with Zod in Server Actions; every action is rate-limited per user (`src/server/rate-limit.ts`), and auth endpoints use Better Auth's rate limiting.
- Uploads are checked by magic bytes, size-limited, and private files (CVs, attachments) are only served to people with access.
- Profile visibility, recruiter searchability, private browsing, message permissions and blocking are enforced in queries, not only in the UI.

## Payments

`src/server/billing.ts` creates a `Payment` row and a Stripe Checkout session. Fulfilment (boosts, featured or sponsored jobs, subscriptions) happens only from the signed webhook, is idempotent (`WebhookEvent`), and is recorded as an invoice. Subscriptions can be cancelled at period end or managed in Stripe's billing portal.

## Scaling notes

- **Realtime**: the SSE hub is in-process. With more than one server instance, replace `publish`/`subscribe` in `src/server/realtime.ts` with Redis pub/sub or a managed service; the event shapes stay the same.
- **Rate limiting** is in memory; move it to Redis behind the same `rateLimit()` function for multi-instance deployments.
- **Storage**: see "File storage" below.
- **Search** uses indexed Postgres queries. Postgres full-text search or a dedicated engine can sit behind `searchJobs()` / `searchCandidates()` without changing callers.
- **Adding a language**: see below.

## File storage

`src/server/storage.ts` has two drivers, chosen with `STORAGE_DRIVER`:

| Driver | Where files live | Use for |
| --- | --- | --- |
| `local` | `./storage` on disk | Development. Refuses uploads on Vercel, whose filesystem is read-only and short-lived. |
| `supabase` | Supabase Storage | Production (Vercel serverless). Needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`. |

- **Names**: every file is stored under a random UUID (`public/<scope>/<uuid>.<ext>` or `private/<scope>/<owner>/<uuid>.<ext>`), so names never collide or reveal the original filename. The type is checked from the file's bytes, not the browser's claim.
- **Two buckets**: images go to the public bucket (`SUPABASE_BUCKET`). CVs and message attachments go to a private bucket (`SUPABASE_PRIVATE_BUCKET`, default `<bucket>-private`). Both are created on the first upload if missing.
- **URLs**: the database always stores `/api/v1/files/<key>`, whichever driver is used. That route checks access for private files (the candidate, or recruiters at a company they applied to; conversation members for attachments). Then:
  - `local` streams the file;
  - `supabase` redirects to the bucket's public URL (public files) or to a signed URL that expires after 5 minutes (private files). File bytes never pass through the serverless function.
- **Deleting**: replacing or removing an avatar, cover, company logo/cover/photo or project image, and deleting a post or project, also deletes the old file (`deleteStored`). Deletion is best effort: a storage error is logged and never fails the user's action.
- **Upload size**: Vercel caps request bodies at 4.5 MB, so set `UPLOAD_MAX_BYTES=4194304` there.
- The service role key is used only on the server; browsers never receive it.

## Adding a language

Add it to `LOCALES` in `src/i18n/config.ts`, create a dictionary typed as `Dictionary`, and run the i18n tests.
