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
    amount: 4900,
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
