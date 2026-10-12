// Skill autocomplete matching, done in memory over the (small, cached) skill
// table. Names and aliases are normalised so "nodejs", "Node.js" and "node js"
// are the same, common abbreviations work ("js", "k8s"), and Arabic matches
// regardless of hamza/alef forms, taa marbuta or diacritics.

export type SearchableSkill = { id: string; name: string; slug: string; category: string; aliases: string[]; usageCount: number };

/** Common English abbreviations and spellings, keyed by the stored skill name. */
export const SKILL_ALIASES_EN: Record<string, string[]> = {
  JavaScript: ["js", "ecmascript", "es6"],
  TypeScript: ["ts"],
  "Node.js": ["node", "nodejs"],
  "Next.js": ["nextjs"],
  "Vue.js": ["vue", "vuejs"],
  "React Native": ["rn"],
  "C#": ["csharp", "c sharp"],
  ".NET": ["dotnet", "net core", "asp.net"],
  "C++": ["cpp", "cplusplus"],
  Go: ["golang"],
  "Ruby on Rails": ["rails", "ror"],
  "REST APIs": ["rest", "api", "restful"],
  "CI/CD": ["cicd", "continuous integration"],
  Kubernetes: ["k8s"],
  "Google Cloud": ["gcp"],
  AWS: ["amazon web services"],
  Azure: ["microsoft azure"],
  PostgreSQL: ["postgres", "psql"],
  MongoDB: ["mongo"],
  "Machine Learning": ["ml"],
  "Data Visualization": ["dataviz"],
  "UI Design": ["ui"],
  "UX Research": ["ux"],
  SEO: ["search engine optimization"],
  "Google Ads": ["adwords", "sem"],
  CRM: ["customer relationship management"],
  "Microsoft Office": ["ms office", "word", "powerpoint"],
  Excel: ["ms excel", "spreadsheets"],
  "Adobe Photoshop": ["photoshop"],
  "Adobe Illustrator": ["illustrator"],
  "Project Management": ["pm", "pmp"],
  "Product Management": ["product manager"],
  "HR Operations": ["hr", "human resources"],
};

/** Lower-cases and strips everything that shouldn't affect a match. */
export function normalizeSkill(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/^ال(?=\S{3,})/, "") // a leading definite article
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/[\s._\-/'’()&,]+/g, "");
}

/**
 * Best matches for `query`: exact name/alias first, then prefix, then
 * substring; ties go to the most used skill. Duplicate names (after
 * normalising) are collapsed. An empty query returns the most used skills.
 */
export function searchSkills(skills: SearchableSkill[], query: string, limit = 10) {
  const q = normalizeSkill(query);
  const seen = new Set<string>();
  const scored: { skill: SearchableSkill; rank: number }[] = [];
  for (const skill of skills) {
    const key = normalizeSkill(skill.name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!q) {
      scored.push({ skill, rank: 0 });
      continue;
    }
    const terms = [key, ...[...skill.aliases, ...(SKILL_ALIASES_EN[skill.name] ?? [])].map(normalizeSkill)].filter(Boolean);
    let rank = Infinity;
    for (const term of terms) {
      if (term === q) rank = Math.min(rank, term === key ? 0 : 1);
      else if (term.startsWith(q)) rank = Math.min(rank, 2);
      else if (q.length >= 2 && term.includes(q)) rank = Math.min(rank, 3);
    }
    if (rank !== Infinity) scored.push({ skill, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || b.skill.usageCount - a.skill.usageCount || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit)
    .map(({ skill }) => ({ id: skill.id, name: skill.name, slug: skill.slug, category: skill.category }));
}
