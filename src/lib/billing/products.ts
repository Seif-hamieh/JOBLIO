// Paid products. Core features (profile, search, apply, connect, message)
// are always free — paid products only add visibility and pro tools.

export type ProductCode =
  | "CAREER_BOOST_7"
  | "CAREER_BOOST_30"
  | "PREMIUM_PORTFOLIO"
  | "FEATURED_JOB"
  | "SPONSORED_JOB"
  | "COMPANY_PREMIUM"
  | "RECRUITER_PRO";

export type Product = {
  code: ProductCode;
  name: string;
  /** Minor units (cents). */
  amount: number;
  currency: "usd";
  mode: "payment" | "subscription";
  /** Duration for one-time products. */
  days?: number;
  audience: "member" | "recruiter" | "company-admin";
  needsTarget?: "job";
  tagline: string;
  features: string[];
};

export const PRODUCTS: Record<ProductCode, Product> = {
  CAREER_BOOST_7: {
    code: "CAREER_BOOST_7",
    name: "Career Boost · 7 days",
    amount: 299,
    currency: "usd",
    mode: "payment",
    days: 7,
    audience: "member",
    tagline: "A week of extra visibility.",
    features: ["Featured placement in recruiter search", "Featured Professionals listing", "Premium profile badge", "“Looking for Opportunities” badge"],
  },
  CAREER_BOOST_30: {
    code: "CAREER_BOOST_30",
    name: "Career Boost · 30 days",
    amount: 799,
    currency: "usd",
    mode: "payment",
    days: 30,
    audience: "member",
    tagline: "A month of extra visibility.",
    features: ["Everything in the 7-day boost", "Best value per day"],
  },
  PREMIUM_PORTFOLIO: {
    code: "PREMIUM_PORTFOLIO",
    name: "Premium Portfolio",
    amount: 499,
    currency: "usd",
    mode: "subscription",
    audience: "member",
    tagline: "Your own page at getjoblio.app/username.",
    features: ["Personal portfolio site", "About, skills, experience, projects & certificates", "Custom accent colour", "Contact section"],
  },
  FEATURED_JOB: {
    code: "FEATURED_JOB",
    name: "Featured Job · 30 days",
    amount: 2000,
    currency: "usd",
    mode: "payment",
    days: 30,
    audience: "recruiter",
    needsTarget: "job",
    tagline: "Rank higher in relevant search results.",
    features: ["Top of relevant search results", "Featured Jobs page", "“Featured” label"],
  },
  SPONSORED_JOB: {
    code: "SPONSORED_JOB",
    name: "Sponsored Job · 14 days",
    amount: 9900,
    currency: "usd",
    mode: "payment",
    days: 14,
    audience: "recruiter",
    needsTarget: "job",
    tagline: "Prominent placement across JOBLIO.",
    features: ["Sponsored slot above search results", "Clearly labelled “Sponsored”", "Shown only when it matches the search"],
  },
  COMPANY_PREMIUM: {
    code: "COMPANY_PREMIUM",
    name: "Premium Company Page",
    amount: 9900,
    currency: "usd",
    mode: "subscription",
    audience: "company-admin",
    tagline: "Make your employer brand shine.",
    features: ["Brand colours across your page", "Up to 30 photos & videos", "Priority in company search", "Job analytics: saves & conversion"],
  },
  RECRUITER_PRO: {
    code: "RECRUITER_PRO",
    name: "Recruiter Pro",
    amount: 4900,
    currency: "usd",
    mode: "subscription",
    audience: "recruiter",
    tagline: "Advanced tools for serious hiring.",
    features: ["Advanced candidate filters", "Unlimited search results", "300 new candidate contacts / month", "Saved searches & unlimited talent lists", "Recruitment analytics"],
  },
};

export const MEMBER_PRODUCTS: ProductCode[] = ["CAREER_BOOST_7", "CAREER_BOOST_30", "PREMIUM_PORTFOLIO"];
export const BUSINESS_PRODUCTS: ProductCode[] = ["RECRUITER_PRO", "COMPANY_PREMIUM", "FEATURED_JOB", "SPONSORED_JOB"];

// ── Featured Job plans (Paddle) ─────────────────────────────────────────────
// One purchase = one plan. All are recorded as FEATURED_JOB payments; the plan
// decides how many days the job is featured. Price IDs come from the environment
// and are only read on the server (they are undefined in the browser bundle).

export type FeaturedJobPlanCode = "FEATURED_JOB_7D" | "FEATURED_JOB_14D" | "FEATURED_JOB_30D";

export type FeaturedJobPlan = {
  code: FeaturedJobPlanCode;
  priceId: string | undefined;
  durationDays: number;
  /** Minor units (cents), USD — what Paddle charges for this price. */
  amount: number;
};

/** Ascending by price. */
export const FEATURED_JOB_PLANS: FeaturedJobPlan[] = [
  { code: "FEATURED_JOB_7D", priceId: process.env.PADDLE_PRICE_FEATURED_JOB_7D, durationDays: 7, amount: 300 },
  { code: "FEATURED_JOB_14D", priceId: process.env.PADDLE_PRICE_FEATURED_JOB_14D, durationDays: 14, amount: 500 },
  { code: "FEATURED_JOB_30D", priceId: process.env.PADDLE_PRICE_FEATURED_JOB_30D, durationDays: 30, amount: 800 },
];

export const FEATURED_JOB_PLAN_CODES = FEATURED_JOB_PLANS.map((p) => p.code) as [FeaturedJobPlanCode, ...FeaturedJobPlanCode[]];

/** Days of a Featured Job payment, from its description ("Featured Job · 14 days"). */
export function featuredJobDays(payment: { product: string; description: string }) {
  if (payment.product !== "FEATURED_JOB") return null;
  const days = Number(/(\d+)\s*days?/i.exec(payment.description)?.[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}
