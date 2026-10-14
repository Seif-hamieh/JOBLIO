// Paid products. Core features (profile, search, apply, connect, message)
// are always free — paid products only add visibility and pro tools.

export type ProductCode =
  | "CAREER_BOOST_7"
  | "CAREER_BOOST_30"
  | "PREMIUM_PORTFOLIO"
  | "FEATURED_JOB"
  | "SPONSORED_JOB"
  | "COMPANY_PREMIUM"
  | "RECRUITER_PRO"
  | "PROFILE_BOOST"
  | "URGENT_HIRE"
  | "PRIORITY_APPLICATION"
  | "JOB_SEEKER_PRO";

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
  JOB_SEEKER_PRO: {
    code: "JOB_SEEKER_PRO",
    name: "Job Seeker Pro",
    amount: 700,
    currency: "usd",
    mode: "subscription",
    audience: "member",
    tagline: "Tools to stand out and get hired faster.",
    features: ["Everything in Free", "Profile Boost included", "Early access to new jobs", "See who viewed your profile"],
  },
  PROFILE_BOOST: {
    code: "PROFILE_BOOST",
    name: "Profile Boost",
    amount: 500,
    currency: "usd",
    mode: "payment",
    days: 30,
    audience: "member",
    tagline: "Stand out to recruiters for a month.",
    features: ["Priority in recruiter search", "Boosted profile badge", "Higher placement in search results"],
  },
  URGENT_HIRE: {
    code: "URGENT_HIRE",
    name: "Urgent Hire",
    amount: 1200,
    currency: "usd",
    mode: "payment",
    days: 30,
    audience: "recruiter",
    needsTarget: "job",
    tagline: "Fill this role fast — flag it as urgent.",
    features: ["“Urgent” badge on the job card", "Priority in recruiter search", "Highlighted in job listings"],
  },
  PRIORITY_APPLICATION: {
    code: "PRIORITY_APPLICATION",
    name: "Priority Application",
    amount: 100,
    currency: "usd",
    mode: "payment",
    audience: "member",
    tagline: "Put your application at the top of the list.",
    features: ["Your application appears first", "Highlighted for the recruiter", "Never missed in the pile"],
  },
};

export const MEMBER_PRODUCTS: ProductCode[] = ["CAREER_BOOST_7", "CAREER_BOOST_30", "PREMIUM_PORTFOLIO", "PROFILE_BOOST", "PRIORITY_APPLICATION"];
export const BUSINESS_PRODUCTS: ProductCode[] = ["RECRUITER_PRO", "COMPANY_PREMIUM", "FEATURED_JOB", "SPONSORED_JOB", "URGENT_HIRE"];

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

// ── Profile Boost plans (Paddle) ──────────────────────────────
export type ProfileBoostPlanCode = "PROFILE_BOOST_7D" | "PROFILE_BOOST_14D" | "PROFILE_BOOST_30D";

export type ProfileBoostPlan = {
  code: ProfileBoostPlanCode;
  priceId: string | undefined;
  durationDays: number;
  /** Minor units (cents), USD — what Paddle charges for this price. */
  amount: number;
};

/** Ascending by price. */
export const PROFILE_BOOST_PLANS: ProfileBoostPlan[] = [
  { code: "PROFILE_BOOST_7D", priceId: process.env.PADDLE_PRICE_PROFILE_BOOST_7D, durationDays: 7, amount: 200 },
  { code: "PROFILE_BOOST_14D", priceId: process.env.PADDLE_PRICE_PROFILE_BOOST_14D, durationDays: 14, amount: 300 },
  { code: "PROFILE_BOOST_30D", priceId: process.env.PADDLE_PRICE_PROFILE_BOOST_30D, durationDays: 30, amount: 500 },
];

export const PROFILE_BOOST_PLAN_CODES = PROFILE_BOOST_PLANS.map((p) => p.code) as [ProfileBoostPlanCode, ...ProfileBoostPlanCode[]];

// ── Urgent Hire plans (Paddle) ──────────────────────────────
export type UrgentHirePlanCode = "URGENT_HIRE_7D" | "URGENT_HIRE_14D" | "URGENT_HIRE_30D";

export type UrgentHirePlan = {
  code: UrgentHirePlanCode;
  priceId: string | undefined;
  durationDays: number;
  /** Minor units (cents), USD — what Paddle charges for this price. */
  amount: number;
};

/** Ascending by price. */
export const URGENT_HIRE_PLANS: UrgentHirePlan[] = [
  { code: "URGENT_HIRE_7D", priceId: process.env.PADDLE_PRICE_URGENT_HIRE_7D, durationDays: 7, amount: 500 },
  { code: "URGENT_HIRE_14D", priceId: process.env.PADDLE_PRICE_URGENT_HIRE_14D, durationDays: 14, amount: 800 },
  { code: "URGENT_HIRE_30D", priceId: process.env.PADDLE_PRICE_URGENT_HIRE_30D, durationDays: 30, amount: 1200 },
];

export const URGENT_HIRE_PLAN_CODES = URGENT_HIRE_PLANS.map((p) => p.code) as [UrgentHirePlanCode, ...UrgentHirePlanCode[]];

// ── Priority Application credit packs (Paddle) ──────────────
export type PriorityApplicationPlanCode = "PRIORITY_APPLICATION_1" | "PRIORITY_APPLICATION_5" | "PRIORITY_APPLICATION_10";

export type PriorityApplicationPlan = {
  code: PriorityApplicationPlanCode;
  priceId: string | undefined;
  /** How many priority credits the buyer receives. */
  credits: number;
  /** Minor units (cents), USD — what Paddle charges for this price. */
  amount: number;
};

/** Ascending by price. */
export const PRIORITY_APPLICATION_PLANS: PriorityApplicationPlan[] = [
  { code: "PRIORITY_APPLICATION_1", priceId: process.env.PADDLE_PRICE_PRIORITY_APPLICATION_1, credits: 1, amount: 100 },
  { code: "PRIORITY_APPLICATION_5", priceId: process.env.PADDLE_PRICE_PRIORITY_APPLICATION_5, credits: 5, amount: 400 },
  { code: "PRIORITY_APPLICATION_10", priceId: process.env.PADDLE_PRICE_PRIORITY_APPLICATION_10, credits: 10, amount: 700 },
];

export const PRIORITY_APPLICATION_PLAN_CODES = PRIORITY_APPLICATION_PLANS.map((p) => p.code) as [PriorityApplicationPlanCode, ...PriorityApplicationPlanCode[]];

/** Days of a Featured Job payment, from its description ("Featured Job · 14 days"). */
export function featuredJobDays(payment: { product: string; description: string }) {
  if (payment.product !== "FEATURED_JOB") return null;
  const days = Number(/(\d+)\s*days?/i.exec(payment.description)?.[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}

/** Days of a Profile Boost payment, from its description ("Profile Boost · 14 days"). */
export function profileBoostDays(payment: { product: string; description: string }) {
  if (payment.product !== "PROFILE_BOOST") return null;
  const days = Number(/(\d+)\s*days?/i.exec(payment.description)?.[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}

/** Days of an Urgent Hire payment, from its description ("Urgent Hire · 14 days"). */
export function urgentHireDays(payment: { product: string; description: string }) {
  if (payment.product !== "URGENT_HIRE") return null;
  const days = Number(/(\d+)\s*days?/i.exec(payment.description)?.[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
}

/** Credits of a Priority Application payment, from its plan or description. */
export function priorityApplicationCredits(payment: { product: string; description: string }) {
  if (payment.product !== "PRIORITY_APPLICATION") return null;
  // From description like "Priority Application · 5 pack".
  const m = /(\d+)\s*pack/i.exec(payment.description);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

// ── Subscription plans (Paddle, recurring) ──
export type SubscriptionProductCode = "JOB_SEEKER_PRO" | "COMPANY_PREMIUM";
export type SubscriptionPlanCode = "JOB_SEEKER_PRO_MONTHLY" | "JOB_SEEKER_PRO_YEARLY" | "COMPANY_PREMIUM_MONTHLY" | "COMPANY_PREMIUM_YEARLY";

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  product: SubscriptionProductCode;
  priceId: string | undefined;
  interval: "month" | "year";
  amount: number;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { code: "JOB_SEEKER_PRO_MONTHLY", product: "JOB_SEEKER_PRO", priceId: process.env.PADDLE_PRICE_JOB_SEEKER_PRO_MONTHLY, interval: "month", amount: 700 },
  { code: "JOB_SEEKER_PRO_YEARLY", product: "JOB_SEEKER_PRO", priceId: process.env.PADDLE_PRICE_JOB_SEEKER_PRO_YEARLY, interval: "year", amount: 7000 },
  { code: "COMPANY_PREMIUM_MONTHLY", product: "COMPANY_PREMIUM", priceId: process.env.PADDLE_PRICE_COMPANY_PREMIUM_MONTHLY, interval: "month", amount: 2500 },
  { code: "COMPANY_PREMIUM_YEARLY", product: "COMPANY_PREMIUM", priceId: process.env.PADDLE_PRICE_COMPANY_PREMIUM_YEARLY, interval: "year", amount: 25000 },
];

export const SUBSCRIPTION_PLAN_CODES = SUBSCRIPTION_PLANS.map((p) => p.code) as [SubscriptionPlanCode, ...SubscriptionPlanCode[]];

export function findSubscriptionPlan(code: SubscriptionPlanCode): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.code === code);
}
