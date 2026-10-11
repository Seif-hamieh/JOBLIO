// Reference data built into the app: the skill taxonomy and industries.
// When a fresh database (e.g. a new Neon branch) has no skills or industries,
// the server inserts these lists once (see src/server/services/reference-data.ts),
// so pickers work without running the seed. The seed uses the same lists.
//
// Names are stored in English — that is what the matcher and search compare —
// and translated for display: industries and skill categories through the
// `industries` / `skillCategories` dictionaries, and Arabic skill names are
// added as search aliases so typing the Arabic word finds the skill.
//
// Languages, education levels and experience levels are not database tables:
// they are fixed lists, re-exported here so all reference data has one entry point.

export { EDUCATION_LEVELS, EXPERIENCE_LEVELS, LANGUAGE_PROFICIENCIES, SKILL_LEVELS } from "@/lib/constants";
export { LANGUAGE_CODES, LANGUAGES } from "@/lib/geo";

/** Skills grouped by category (category names match the `skillCategories` dictionary). */
export const SKILLS: Record<string, string[]> = {
  Engineering: [
    "JavaScript", "TypeScript", "React", "Next.js", "Vue.js", "Angular", "Svelte", "HTML", "CSS", "Tailwind CSS",
    "Node.js", "Express", "Python", "Django", "FastAPI", "Java", "Spring Boot", "Kotlin", "Swift", "Go", "Rust",
    "C#", ".NET", "PHP", "Laravel", "Ruby on Rails", "C++", "GraphQL", "REST APIs", "Microservices", "System Design",
    "Testing", "Cypress", "Playwright", "React Native", "Flutter", "iOS Development", "Android Development", "Git",
    "Accessibility", "Web Performance", "WebSockets", "Three.js",
  ],
  "Cloud & DevOps": [
    "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "Terraform", "CI/CD", "Linux", "Observability",
    "Site Reliability", "Networking", "Cybersecurity", "Bash",
  ],
  Data: [
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Data Analysis", "Excel", "Power BI", "Tableau", "Statistics",
    "R", "Pandas", "Data Engineering", "Apache Spark", "Airflow", "dbt", "Machine Learning", "Data Visualization", "ETL",
  ],
  Design: [
    "Figma", "UI Design", "UX Research", "Prototyping", "Design Systems", "Interaction Design", "Visual Design",
    "Illustration", "Adobe Photoshop", "Adobe Illustrator", "Motion Design", "Usability Testing", "Information Architecture",
  ],
  Product: ["Product Management", "Product Strategy", "Roadmapping", "Agile", "Scrum", "Jira", "User Stories", "A/B Testing", "Product Analytics", "Discovery"],
  Marketing: [
    "SEO", "Content Marketing", "Copywriting", "Social Media", "Google Ads", "Email Marketing", "Brand Strategy",
    "Growth Marketing", "Marketing Analytics", "Performance Marketing", "Public Relations",
  ],
  Sales: ["B2B Sales", "Account Management", "CRM", "Salesforce", "HubSpot", "Negotiation", "Lead Generation", "Customer Success"],
  Business: [
    "Project Management", "Business Analysis", "Financial Modeling", "Accounting", "Budgeting", "Operations",
    "Supply Chain", "Procurement", "Strategy", "Consulting", "Risk Management", "Compliance", "Logistics",
  ],
  People: ["Recruiting", "Talent Acquisition", "HR Operations", "Employee Relations", "Payroll", "Learning & Development", "Employer Branding"],
  Healthcare: ["Patient Care", "Clinical Research", "Nursing", "Healthcare Administration", "Medical Coding", "Pharmacy", "Public Health"],
  Education: ["Teaching", "Curriculum Design", "E-learning", "Instructional Design", "Tutoring"],
  "Professional skills": [
    "Communication", "Leadership", "Teamwork", "Problem Solving", "Public Speaking", "Mentoring", "Time Management",
    "Stakeholder Management", "Customer Service", "Critical Thinking", "Microsoft Office", "Translation",
  ],
};

/** Industries (names match the `industries` dictionary, which has the Arabic). */
export const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "E-commerce & Retail", "Media & Entertainment", "Manufacturing",
  "Consulting", "Logistics", "Energy", "Telecommunications", "Government & Nonprofit", "Hospitality & Travel",
  "Real Estate", "Marketing & Advertising", "Gaming", "Banking", "Insurance", "Legal Services", "Construction",
  "Automotive", "Aerospace & Defense", "Agriculture", "Food & Beverage", "Pharmaceuticals", "Biotechnology",
  "Oil & Gas", "Transportation", "Fashion & Apparel", "Sports & Fitness", "Architecture & Design", "Human Resources & Staffing",
];

/** Arabic names for skills that have a common Arabic term, used as search aliases. */
export const SKILL_ALIASES_AR: Record<string, string[]> = {
  "Testing": ["اختبار البرمجيات"],
  "Accessibility": ["إمكانية الوصول"],
  "Networking": ["الشبكات"],
  "Cybersecurity": ["الأمن السيبراني"],
  "Data Analysis": ["تحليل البيانات"],
  "Statistics": ["الإحصاء"],
  "Machine Learning": ["تعلم الآلة"],
  "Data Visualization": ["تصور البيانات"],
  "UI Design": ["تصميم واجهات المستخدم"],
  "UX Research": ["أبحاث تجربة المستخدم"],
  "Visual Design": ["التصميم البصري"],
  "Illustration": ["الرسم التوضيحي"],
  "Motion Design": ["تصميم الحركة"],
  "Product Management": ["إدارة المنتجات"],
  "Product Strategy": ["استراتيجية المنتج"],
  "SEO": ["تحسين محركات البحث"],
  "Content Marketing": ["تسويق المحتوى"],
  "Copywriting": ["كتابة الإعلانات", "كتابة المحتوى"],
  "Social Media": ["وسائل التواصل الاجتماعي"],
  "Email Marketing": ["التسويق عبر البريد الإلكتروني"],
  "Brand Strategy": ["استراتيجية العلامة التجارية"],
  "Growth Marketing": ["تسويق النمو"],
  "Performance Marketing": ["التسويق بالأداء"],
  "Public Relations": ["العلاقات العامة"],
  "B2B Sales": ["المبيعات", "مبيعات الشركات"],
  "Account Management": ["إدارة الحسابات"],
  "Negotiation": ["التفاوض"],
  "Lead Generation": ["توليد العملاء المحتملين"],
  "Customer Success": ["نجاح العملاء"],
  "Project Management": ["إدارة المشاريع"],
  "Business Analysis": ["تحليل الأعمال"],
  "Financial Modeling": ["النمذجة المالية"],
  "Accounting": ["المحاسبة"],
  "Budgeting": ["إعداد الميزانية"],
  "Operations": ["العمليات"],
  "Supply Chain": ["سلسلة الإمداد"],
  "Procurement": ["المشتريات"],
  "Strategy": ["الاستراتيجية"],
  "Consulting": ["الاستشارات"],
  "Risk Management": ["إدارة المخاطر"],
  "Compliance": ["الامتثال"],
  "Logistics": ["الخدمات اللوجستية"],
  "Recruiting": ["التوظيف"],
  "Talent Acquisition": ["استقطاب المواهب"],
  "HR Operations": ["الموارد البشرية"],
  "Employee Relations": ["علاقات الموظفين"],
  "Payroll": ["الرواتب"],
  "Learning & Development": ["التعلم والتطوير", "التدريب"],
  "Employer Branding": ["العلامة التجارية لصاحب العمل"],
  "Patient Care": ["رعاية المرضى"],
  "Clinical Research": ["البحث السريري"],
  "Nursing": ["التمريض"],
  "Healthcare Administration": ["إدارة الرعاية الصحية"],
  "Medical Coding": ["الترميز الطبي"],
  "Pharmacy": ["الصيدلة"],
  "Public Health": ["الصحة العامة"],
  "Teaching": ["التدريس"],
  "Curriculum Design": ["تصميم المناهج"],
  "E-learning": ["التعليم الإلكتروني"],
  "Instructional Design": ["التصميم التعليمي"],
  "Tutoring": ["الدروس الخصوصية"],
  "Communication": ["التواصل"],
  "Leadership": ["القيادة"],
  "Teamwork": ["العمل الجماعي"],
  "Problem Solving": ["حل المشكلات"],
  "Public Speaking": ["التحدث أمام الجمهور"],
  "Mentoring": ["الإرشاد"],
  "Time Management": ["إدارة الوقت"],
  "Stakeholder Management": ["إدارة أصحاب المصلحة"],
  "Customer Service": ["خدمة العملاء"],
  "Critical Thinking": ["التفكير النقدي"],
  "Translation": ["الترجمة"],
};

/** URL-safe slug for a skill or industry name (C++ → cpp, C# → csharp, .NET → dotnet). */
export function referenceSlug(name: string) {
  return name
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/^\./, "dot")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rows ready to insert into the `skills` table. */
export function skillRows() {
  return Object.entries(SKILLS).flatMap(([category, names]) =>
    names.map((name) => ({ name, slug: referenceSlug(name), category, aliases: SKILL_ALIASES_AR[name] ?? [] })),
  );
}

/** Rows ready to insert into the `industries` table. */
export function industryRows() {
  return INDUSTRIES.map((name) => ({ name, slug: referenceSlug(name) }));
}
