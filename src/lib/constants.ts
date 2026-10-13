// Client-safe enum values and labels. The string literals mirror the Prisma
// enums exactly, so these types are assignable to/from the generated ones
// without importing Prisma into client bundles.

export const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABEL: Record<WorkMode, string> = { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "On-site" };

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "FREELANCE", "INTERNSHIP"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
};

export const EXPERIENCE_LEVELS = ["INTERNSHIP", "ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  INTERNSHIP: "Internship",
  ENTRY: "Entry level",
  MID: "Mid level",
  SENIOR: "Senior",
  LEAD: "Lead / Principal",
  EXECUTIVE: "Executive",
};

export const EDUCATION_LEVELS = ["NONE", "HIGH_SCHOOL", "VOCATIONAL", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORATE"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LEVEL_LABEL: Record<EducationLevel, string> = {
  NONE: "No requirement",
  HIGH_SCHOOL: "High school",
  VOCATIONAL: "Vocational / Diploma",
  ASSOCIATE: "Associate degree",
  BACHELOR: "Bachelor's degree",
  MASTER: "Master's degree",
  DOCTORATE: "Doctorate",
};
export const EDUCATION_RANK: Record<EducationLevel, number> = {
  NONE: 0,
  HIGH_SCHOOL: 1,
  VOCATIONAL: 2,
  ASSOCIATE: 3,
  BACHELOR: 4,
  MASTER: 5,
  DOCTORATE: 6,
};

export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};
export const SKILL_RANK: Record<SkillLevel, number> = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };

export const LANGUAGE_PROFICIENCIES = ["BASIC", "CONVERSATIONAL", "PROFESSIONAL", "FLUENT", "NATIVE"] as const;
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];
export const LANGUAGE_PROFICIENCY_LABEL: Record<LanguageProficiency, string> = {
  BASIC: "Basic",
  CONVERSATIONAL: "Conversational",
  PROFESSIONAL: "Professional",
  FLUENT: "Fluent",
  NATIVE: "Native",
};
export const PROFICIENCY_RANK: Record<LanguageProficiency, number> = {
  BASIC: 1,
  CONVERSATIONAL: 2,
  PROFESSIONAL: 3,
  FLUENT: 4,
  NATIVE: 5,
};

export const AVAILABILITIES = ["IMMEDIATELY", "TWO_WEEKS", "ONE_MONTH", "THREE_MONTHS", "NOT_LOOKING"] as const;
export type Availability = (typeof AVAILABILITIES)[number];
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  IMMEDIATELY: "Available now",
  TWO_WEEKS: "Within 2 weeks",
  ONE_MONTH: "Within a month",
  THREE_MONTHS: "Within 3 months",
  NOT_LOOKING: "Not looking",
};

export const SALARY_PERIODS = ["YEAR", "MONTH", "HOUR"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export const SALARY_PERIOD_LABEL: Record<SalaryPeriod, string> = { YEAR: "per year", MONTH: "per month", HOUR: "per hour" };

export const COMPANY_SIZES = [
  "SIZE_1_10",
  "SIZE_11_50",
  "SIZE_51_200",
  "SIZE_201_500",
  "SIZE_501_1000",
  "SIZE_1001_5000",
  "SIZE_5000_PLUS",
] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];
export const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  SIZE_1_10: "1–10 employees",
  SIZE_11_50: "11–50 employees",
  SIZE_51_200: "51–200 employees",
  SIZE_201_500: "201–500 employees",
  SIZE_501_1000: "501–1,000 employees",
  SIZE_1001_5000: "1,001–5,000 employees",
  SIZE_5000_PLUS: "5,000+ employees",
};

export const JOB_STATUSES = ["DRAFT", "OPEN", "PAUSED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABEL: Record<JobStatus, string> = { DRAFT: "Draft", OPEN: "Open", PAUSED: "Paused", CLOSED: "Closed" };

export const APPLICATION_STATUSES = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};
/** The happy path the candidate sees, in order. */
export const APPLICATION_TRACK: ApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"];

export const PIPELINE_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "FINAL", "HIRED"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** The application status a candidate gets when moved into each pipeline stage. */
export const STATUS_FOR_STAGE: Record<PipelineStage, ApplicationStatus> = {
  APPLIED: "VIEWED",
  SCREENING: "SHORTLISTED",
  INTERVIEW: "INTERVIEW",
  FINAL: "INTERVIEW",
  HIRED: "HIRED",
};
export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL: "Final",
  HIRED: "Hired",
};

export const INTERVIEW_TYPES = ["VIDEO", "PHONE", "ONSITE"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = { VIDEO: "Video call", PHONE: "Phone call", ONSITE: "On-site" };

export const PROFILE_VISIBILITIES = ["PUBLIC", "MEMBERS", "CONNECTIONS"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
export const PROFILE_VISIBILITY_LABEL: Record<ProfileVisibility, string> = {
  PUBLIC: "Everyone",
  MEMBERS: "JOBLIO members only",
  CONNECTIONS: "My connections only",
};

export const MESSAGE_PERMISSIONS = ["EVERYONE", "RECRUITERS_AND_CONNECTIONS", "CONNECTIONS"] as const;
export type MessagePermission = (typeof MESSAGE_PERMISSIONS)[number];
export const MESSAGE_PERMISSION_LABEL: Record<MessagePermission, string> = {
  EVERYONE: "Anyone on JOBLIO",
  RECRUITERS_AND_CONNECTIONS: "Recruiters and connections",
  CONNECTIONS: "Connections only",
};

export const USER_INTENTS = ["SEEKER", "RECRUITER", "BOTH"] as const;
export type UserIntent = (typeof USER_INTENTS)[number];

export const SOCIAL_PLATFORMS = ["github", "linkedin", "x", "dribbble", "behance", "medium", "youtube", "website"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  x: "X",
  dribbble: "Dribbble",
  behance: "Behance",
  medium: "Medium",
  youtube: "YouTube",
  website: "Website",
};

/** Usernames that collide with top-level routes (portfolio lives at /<username>). */
export const RESERVED_USERNAMES = new Set([
  "api", "app", "admin", "auth", "login", "register", "signup", "sign-up", "logout", "onboarding", "home", "feed", "jobs",
  "job", "in", "p", "profile", "network", "messages", "notifications", "companies", "company", "recruiter", "applications",
  "interviews", "settings", "premium", "billing", "professionals", "about", "help", "terms", "privacy", "forgot-password",
  "reset-password", "verify-email", "joblio", "support", "static", "_next", "favicon.ico", "robots.txt", "sitemap.xml",
  "contact", "search", "people", "legal", "dev-mailbox",
]);
