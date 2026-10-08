// Rule-based profile strength. Weights sum to 100.

export type CompletenessInput = {
  hasPhoto: boolean;
  headline: string | null;
  about: string | null;
  city: string | null;
  skillCount: number;
  experienceCount: number;
  educationCount: number;
  projectCount: number;
  languageCount: number;
  desiredTitles: string[];
  preferredWorkModes: string[];
  socialLinkCount: number;
};

export type CompletenessItem = { key: string; label: string; weight: number; done: boolean; href: string };

export function profileCompleteness(p: CompletenessInput) {
  const items: CompletenessItem[] = [
    { key: "photo", label: "Add a profile photo", weight: 10, done: p.hasPhoto, href: "/profile/edit#basics" },
    { key: "headline", label: "Write a headline", weight: 10, done: !!p.headline?.trim(), href: "/profile/edit#basics" },
    { key: "about", label: "Tell your story in About", weight: 10, done: (p.about?.trim().length ?? 0) >= 80, href: "/profile/edit#basics" },
    { key: "location", label: "Set your location", weight: 5, done: !!p.city, href: "/profile/edit#basics" },
    { key: "skills", label: "Add at least 5 skills", weight: 15, done: p.skillCount >= 5, href: "/profile/skills" },
    { key: "experience", label: "Add your experience", weight: 15, done: p.experienceCount > 0, href: "/profile/edit#experience" },
    { key: "education", label: "Add your education", weight: 10, done: p.educationCount > 0, href: "/profile/edit#education" },
    { key: "projects", label: "Showcase a project", weight: 10, done: p.projectCount > 0, href: "/profile/projects" },
    { key: "languages", label: "List your languages", weight: 5, done: p.languageCount > 0, href: "/profile/edit#languages" },
    {
      key: "preferences",
      label: "Set career preferences",
      weight: 5,
      done: p.desiredTitles.length > 0 && p.preferredWorkModes.length > 0,
      href: "/profile/edit#preferences",
    },
    { key: "links", label: "Add a portfolio or social link", weight: 5, done: p.socialLinkCount > 0, href: "/profile/edit#links" },
  ];
  const score = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  return { score, items };
}
