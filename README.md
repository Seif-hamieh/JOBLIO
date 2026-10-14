# JOBLIO

**Your Career. Your Network. Your Future.** — a professional network and hiring platform in **English and Arabic**, with transparent, rule-based job matching. There is **no AI** anywhere in the product: every match percentage comes from published rules and every point is explained.

## Quick start

Requirements: Node.js 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env          # then fill BETTER_AUTH_SECRET (any long random string)
npm run db:local              # starts a local Postgres (Prisma dev) — copy its URL into DATABASE_URL
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000. The seed creates demo accounts; their emails and the shared demo password are listed at the top of `prisma/seed/index.ts` (job seeker Maya, recruiter Omar with Recruiter Pro).

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` / `test` / `lint` | TypeScript, Vitest unit tests, ESLint |
| `npm run db:seed` / `db:reset` | Reload demo data / reset the database |
| `npm run media` | Regenerate the illustrative SVGs in `public/media` |

## Languages (English · العربية)

- The whole interface, emails, notifications, validation errors and match explanations are translated. The language toggle sits in every header; signed-in members also find it in the account menu and in **Settings → Appearance**.
- The choice is stored in the `joblio-locale` cookie (falling back to the browser's `Accept-Language`) and, for members, in their settings so emails use the same language.
- Arabic switches the page to right-to-left (`<html dir="rtl">`), uses Noto Sans Arabic, and keeps Latin digits for numbers, salaries and scores.
- Dictionaries live in `src/i18n/dictionaries/` — `en.ts` is the source of truth, and `ar.ts` must have the same keys (enforced by TypeScript and by `src/i18n/i18n.test.ts`, which also checks placeholders match).
- Server code never formats text for a reader. It returns encoded keys (`k("msg.saved")`), and they are translated where the reader is known: server actions, notifications, and emails.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Payments

Payments use **Paddle** (merchant of record). Card details are entered on Paddle's hosted page and never reach JOBLIO; only Paddle IDs are stored.

**Products available:**
- **One-time payments:** Featured Job, Profile Boost, Urgent Hire
- **Credit packs:** Priority Application (1/5/10)
- **Subscriptions:** Job Seeker Pro, Company Premium (monthly/yearly)

**Environment variables:**
- `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENVIRONMENT` (`sandbox` or `production`)
- `PADDLE_CLIENT_TOKEN` — Paddle's client-side token; the server passes it to the browser to open the checkout
- `PADDLE_PRICE_*` — one variable per Paddle price ID (see `.env.example` for the full list)

**Webhook:** point Paddle to `/api/webhooks/paddle`. Events handled: `transaction.completed`, `transaction.payment_failed`, `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.canceled`.

**Customer portal:** the "Manage subscription" button on `/settings/billing` opens Paddle's hosted portal for updating payment methods or canceling.

In development, without `PADDLE_API_KEY`, purchases are simulated automatically in any non-production environment.

## File uploads

Locally, uploads are saved in `./storage` (`STORAGE_DRIVER=local`). On Vercel, use Supabase Storage: set `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=uploads` and `UPLOAD_MAX_BYTES=4194304`. Images go to the public bucket; CVs and message attachments go to a private bucket and are opened through links that expire after 5 minutes. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#file-storage).

## Email

Without `SMTP_HOST`, emails (verification, password reset, important updates) are printed to the server console so you can click the links locally.
