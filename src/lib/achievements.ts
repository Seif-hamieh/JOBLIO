// Professional achievements — awarded by explicit, documented rules.

export const ACHIEVEMENTS = {
  PROFILE_COMPLETE: {
    title: "Profile Complete",
    description: "Completed every section of your professional profile.",
    rule: "Profile strength reaches 100%.",
  },
  VERIFIED_PROFESSIONAL: {
    title: "Verified Professional",
    description: "Verified email address and a substantially complete profile.",
    rule: "Email verified and profile strength of 80% or more.",
  },
  TOP_SKILL: {
    title: "Top Skill",
    description: "One of your skills has been endorsed by at least 5 professionals.",
    rule: "Any skill with 5 or more endorsements.",
  },
  RISING_TALENT: {
    title: "Rising Talent",
    description: "Your profile is drawing attention from the network.",
    rule: "25 or more profile views in the last 30 days.",
  },
  FAST_APPLICANT: {
    title: "Fast Applicant",
    description: "Applied to a role within 24 hours of it being posted.",
    rule: "An application submitted less than 24h after the job was published.",
  },
  TOP_CANDIDATE: {
    title: "Top Candidate",
    description: "Shortlisted by a recruiter for a role.",
    rule: "An application reaches the Shortlisted stage or beyond.",
  },
  CAREER_EXPLORER: {
    title: "Career Explorer",
    description: "Actively exploring opportunities across companies.",
    rule: "10 saved jobs or 5 followed companies.",
  },
  NETWORK_BUILDER: {
    title: "Network Builder",
    description: "Built a meaningful professional network.",
    rule: "25 accepted connections.",
  },
} as const;

export type AchievementCode = keyof typeof ACHIEVEMENTS;
export const ACHIEVEMENT_CODES = Object.keys(ACHIEVEMENTS) as AchievementCode[];
