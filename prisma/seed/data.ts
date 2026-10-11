// Seed catalogue: skill taxonomy, industries, companies, role templates, people.

// The skill taxonomy and industries live in the app (fresh databases get them automatically).
export { INDUSTRIES, SKILLS, SKILL_ALIASES_AR, referenceSlug } from "../../src/lib/reference-data";

export type CompanySeed = {
  slug: string;
  name: string;
  tagline: string;
  industry: string;
  size: "SIZE_1_10" | "SIZE_11_50" | "SIZE_51_200" | "SIZE_201_500" | "SIZE_501_1000" | "SIZE_1001_5000" | "SIZE_5000_PLUS";
  founded: number;
  city: string;
  country: string;
  color: string;
  currency: string;
  roles: string[];
  verified?: boolean;
  premium?: boolean;
  recruiter: [string, string];
};

export const COMPANIES: CompanySeed[] = [
  { slug: "aurora-labs", name: "Aurora Labs", tagline: "Developer tools for teams that ship every day.", industry: "Technology", size: "SIZE_201_500", founded: 2016, city: "Berlin", country: "DE", color: "#6a4cf0", currency: "EUR", roles: ["frontend", "backend", "devops", "product-designer", "product-manager"], verified: true, premium: true, recruiter: ["Omar Khalil", "Head of Talent"] },
  { slug: "northwind", name: "Northwind", tagline: "Commerce infrastructure for independent brands.", industry: "E-commerce & Retail", size: "SIZE_501_1000", founded: 2012, city: "Toronto", country: "CA", color: "#2f9fd3", currency: "USD", roles: ["frontend", "fullstack", "data-analyst", "marketing"], verified: true, recruiter: ["Grace Okafor", "Senior Recruiter"] },
  { slug: "helix-health", name: "Helix Health", tagline: "Making care coordination effortless.", industry: "Healthcare", size: "SIZE_1001_5000", founded: 2009, city: "Boston", country: "US", color: "#1fb489", currency: "USD", roles: ["backend", "data-engineer", "nurse", "project-manager"], verified: true, recruiter: ["Daniel Kim", "Talent Partner"] },
  { slug: "meridian-bank", name: "Meridian Bank", tagline: "Banking built around people.", industry: "Finance", size: "SIZE_5000_PLUS", founded: 1987, city: "London", country: "GB", color: "#1d3557", currency: "GBP", roles: ["frontend", "backend", "finance-analyst", "data-analyst"], verified: true, recruiter: ["Charlotte Evans", "Recruitment Lead"] },
  { slug: "sahara-commerce", name: "Sahara Commerce", tagline: "The region's favourite marketplace.", industry: "E-commerce & Retail", size: "SIZE_1001_5000", founded: 2014, city: "Dubai", country: "AE", color: "#f0a032", currency: "USD", roles: ["mobile", "fullstack", "marketing", "sales"], verified: true, premium: true, recruiter: ["Layla Mansour", "Talent Acquisition Manager"] },
  { slug: "kumo-games", name: "Kumo Games", tagline: "Cozy games for curious players.", industry: "Gaming", size: "SIZE_51_200", founded: 2018, city: "Tokyo", country: "JP", color: "#f72585", currency: "USD", roles: ["frontend", "product-designer", "backend"], recruiter: ["Haruto Sato", "People Lead"] },
  { slug: "verde-energy", name: "Verde Energy", tagline: "Clean power for every home.", industry: "Energy", size: "SIZE_201_500", founded: 2011, city: "Madrid", country: "ES", color: "#2a9d8f", currency: "EUR", roles: ["data-analyst", "project-manager", "sales"], recruiter: ["Lucía Romero", "Talent Partner"] },
  { slug: "atlas-logistics", name: "Atlas Logistics", tagline: "Moving the world's goods, smarter.", industry: "Logistics", size: "SIZE_1001_5000", founded: 2003, city: "Rotterdam", country: "NL", color: "#264653", currency: "EUR", roles: ["data-engineer", "project-manager", "backend", "operations"], recruiter: ["Pieter de Vries", "Recruiter"] },
  { slug: "lumen-learning", name: "Lumen Learning", tagline: "Learning that adapts to every student.", industry: "Education", size: "SIZE_201_500", founded: 2015, city: "Bangalore", country: "IN", color: "#4cc9f0", currency: "USD", roles: ["fullstack", "teacher", "product-manager", "product-designer"], recruiter: ["Ananya Iyer", "Talent Lead"] },
  { slug: "nimbus-cloud", name: "Nimbus Cloud", tagline: "Cloud hosting without the complexity.", industry: "Technology", size: "SIZE_501_1000", founded: 2013, city: "Singapore", country: "SG", color: "#457b9d", currency: "USD", roles: ["frontend", "devops", "backend", "sales"], verified: true, recruiter: ["Wei Ling Tan", "Technical Recruiter"] },
  { slug: "cedar-consulting", name: "Cedar Consulting", tagline: "Strategy and operations partners.", industry: "Consulting", size: "SIZE_51_200", founded: 2008, city: "Amman", country: "JO", color: "#8a2be2", currency: "USD", roles: ["finance-analyst", "project-manager", "hr"], recruiter: ["Rami Haddad", "HR Manager"] },
  { slug: "orbit-media", name: "Orbit Media", tagline: "Stories that move culture.", industry: "Media & Entertainment", size: "SIZE_201_500", founded: 2010, city: "São Paulo", country: "BR", color: "#ff7a59", currency: "USD", roles: ["marketing", "product-designer", "frontend"], recruiter: ["Beatriz Costa", "Talent Partner"] },
  { slug: "pulse-fintech", name: "Pulse Fintech", tagline: "Payments for Africa's builders.", industry: "Finance", size: "SIZE_51_200", founded: 2019, city: "Lagos", country: "NG", color: "#3a0ca3", currency: "USD", roles: ["frontend", "backend", "mobile", "finance-analyst"], recruiter: ["Chidi Nwosu", "Head of People"] },
  { slug: "fjord-design", name: "Fjord Design Studio", tagline: "Product design for ambitious teams.", industry: "Marketing & Advertising", size: "SIZE_11_50", founded: 2017, city: "Oslo", country: "NO", color: "#14213d", currency: "EUR", roles: ["product-designer", "frontend"], recruiter: ["Ingrid Larsen", "Studio Manager"] },
  { slug: "zenith-telecom", name: "Zenith Telecom", tagline: "Connecting a nation.", industry: "Telecommunications", size: "SIZE_5000_PLUS", founded: 1998, city: "Riyadh", country: "SA", color: "#0e7c86", currency: "USD", roles: ["devops", "project-manager", "sales", "data-analyst"], verified: true, recruiter: ["Faisal Al-Harbi", "Talent Acquisition"] },
  { slug: "kite-travel", name: "Kite Travel", tagline: "Trips planned in minutes.", industry: "Hospitality & Travel", size: "SIZE_201_500", founded: 2015, city: "Sydney", country: "AU", color: "#e76f51", currency: "USD", roles: ["mobile", "marketing", "fullstack", "data-analyst"], recruiter: ["Olivia Brown", "Recruiter"] },
];

type Lvl = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export type RoleTemplate = {
  key: string;
  titles: [string, string, string]; // junior, mid, senior
  required: string[];
  preferred: string[];
  candidateSkills: [string, Lvl][];
  degree: string;
  field: string;
  baseSalary: number; // USD yearly, mid level
  summary: string;
  responsibilities: string[];
  requirements: string[];
};

export const ROLES: Record<string, RoleTemplate> = {
  frontend: {
    key: "frontend",
    titles: ["Junior Frontend Developer", "Frontend Engineer", "Senior Frontend Engineer"],
    required: ["JavaScript", "TypeScript", "React"],
    preferred: ["Next.js", "Testing", "Accessibility"],
    candidateSkills: [["JavaScript", "ADVANCED"], ["TypeScript", "ADVANCED"], ["React", "ADVANCED"], ["CSS", "ADVANCED"], ["Next.js", "INTERMEDIATE"], ["Testing", "INTERMEDIATE"], ["Git", "ADVANCED"]],
    degree: "BSc", field: "Computer Science",
    baseSalary: 85000,
    summary: "Build fast, accessible interfaces used by millions of people every day.",
    responsibilities: ["Build and ship user-facing features end to end", "Own the quality and performance of our web app", "Collaborate closely with design on interaction details", "Contribute to our component library and design system", "Review code and mentor teammates"],
    requirements: ["Strong JavaScript and TypeScript fundamentals", "Production experience with React", "Care for accessibility and performance", "Clear written communication", "Comfort working in small, autonomous teams"],
  },
  backend: {
    key: "backend",
    titles: ["Junior Backend Developer", "Backend Engineer", "Senior Backend Engineer"],
    required: ["Node.js", "PostgreSQL", "REST APIs"],
    preferred: ["Docker", "Redis", "System Design"],
    candidateSkills: [["Node.js", "ADVANCED"], ["PostgreSQL", "ADVANCED"], ["REST APIs", "ADVANCED"], ["Docker", "INTERMEDIATE"], ["TypeScript", "ADVANCED"], ["SQL", "ADVANCED"]],
    degree: "BSc", field: "Software Engineering",
    baseSalary: 90000,
    summary: "Design reliable services and APIs that power our products.",
    responsibilities: ["Design, build and operate backend services", "Model data and write efficient queries", "Improve reliability, observability and performance", "Partner with product on technical trade-offs", "Participate in on-call rotation"],
    requirements: ["Experience building APIs in production", "Solid SQL and data modelling skills", "Understanding of distributed systems basics", "Ownership mindset", "Experience with containers is a plus"],
  },
  fullstack: {
    key: "fullstack",
    titles: ["Junior Full-Stack Developer", "Full-Stack Engineer", "Senior Full-Stack Engineer"],
    required: ["TypeScript", "React", "Node.js"],
    preferred: ["PostgreSQL", "GraphQL", "AWS"],
    candidateSkills: [["TypeScript", "ADVANCED"], ["React", "ADVANCED"], ["Node.js", "ADVANCED"], ["PostgreSQL", "INTERMEDIATE"], ["GraphQL", "INTERMEDIATE"]],
    degree: "BSc", field: "Computer Science",
    baseSalary: 88000,
    summary: "Ship complete features across the stack, from database to pixels.",
    responsibilities: ["Deliver features across frontend and backend", "Write maintainable, tested code", "Improve developer experience and tooling", "Work with customers to understand problems", "Help shape our technical roadmap"],
    requirements: ["Experience with React and Node.js", "Comfortable with relational databases", "Pragmatic approach to architecture", "Strong collaboration skills", "Curiosity and a bias for action"],
  },
  mobile: {
    key: "mobile",
    titles: ["Junior Mobile Developer", "Mobile Engineer", "Senior Mobile Engineer"],
    required: ["React Native", "TypeScript"],
    preferred: ["iOS Development", "Android Development", "Testing"],
    candidateSkills: [["React Native", "ADVANCED"], ["TypeScript", "ADVANCED"], ["iOS Development", "INTERMEDIATE"], ["Android Development", "INTERMEDIATE"]],
    degree: "BSc", field: "Computer Engineering",
    baseSalary: 87000,
    summary: "Craft delightful mobile experiences for iOS and Android.",
    responsibilities: ["Build features for our iOS and Android apps", "Own app performance and stability", "Ship releases with confidence", "Collaborate with designers on motion and polish", "Improve our mobile architecture"],
    requirements: ["Shipped apps with React Native or native stacks", "Strong TypeScript skills", "Eye for detail in UI", "Experience with app store releases", "Good communication"],
  },
  devops: {
    key: "devops",
    titles: ["Junior DevOps Engineer", "DevOps Engineer", "Senior Site Reliability Engineer"],
    required: ["Kubernetes", "AWS", "Terraform"],
    preferred: ["Observability", "CI/CD", "Linux"],
    candidateSkills: [["Kubernetes", "ADVANCED"], ["AWS", "ADVANCED"], ["Terraform", "ADVANCED"], ["Linux", "ADVANCED"], ["CI/CD", "ADVANCED"], ["Docker", "EXPERT"]],
    degree: "BSc", field: "Information Technology",
    baseSalary: 95000,
    summary: "Keep our platform fast, safe and always on.",
    responsibilities: ["Operate and scale our cloud infrastructure", "Automate everything with infrastructure as code", "Improve monitoring and incident response", "Harden security across environments", "Support teams with self-service tooling"],
    requirements: ["Production Kubernetes experience", "Infrastructure as code with Terraform", "Solid Linux and networking fundamentals", "Calm under pressure", "Clear documentation habits"],
  },
  "data-analyst": {
    key: "data-analyst",
    titles: ["Junior Data Analyst", "Data Analyst", "Senior Data Analyst"],
    required: ["SQL", "Data Analysis", "Excel"],
    preferred: ["Power BI", "Python", "Statistics"],
    candidateSkills: [["SQL", "ADVANCED"], ["Data Analysis", "ADVANCED"], ["Excel", "EXPERT"], ["Power BI", "INTERMEDIATE"], ["Statistics", "INTERMEDIATE"], ["Python", "INTERMEDIATE"]],
    degree: "BSc", field: "Statistics",
    baseSalary: 70000,
    summary: "Turn data into decisions that move the business.",
    responsibilities: ["Build dashboards and recurring reports", "Answer business questions with data", "Define and maintain key metrics", "Partner with teams on experiments", "Present findings clearly"],
    requirements: ["Strong SQL", "Experience with BI tools", "Comfort with statistics", "Great storytelling with data", "Attention to detail"],
  },
  "data-engineer": {
    key: "data-engineer",
    titles: ["Junior Data Engineer", "Data Engineer", "Senior Data Engineer"],
    required: ["Python", "SQL", "Data Engineering"],
    preferred: ["Apache Spark", "Airflow", "dbt"],
    candidateSkills: [["Python", "ADVANCED"], ["SQL", "EXPERT"], ["Data Engineering", "ADVANCED"], ["Airflow", "INTERMEDIATE"], ["dbt", "INTERMEDIATE"]],
    degree: "MSc", field: "Data Science",
    baseSalary: 95000,
    summary: "Build the pipelines and models every team relies on.",
    responsibilities: ["Design and maintain data pipelines", "Model data for analytics", "Ensure data quality and lineage", "Optimise warehouse performance", "Support analysts and engineers"],
    requirements: ["Strong Python and SQL", "Experience with orchestration tools", "Understanding of data modelling", "Reliability mindset", "Collaborative attitude"],
  },
  "product-designer": {
    key: "product-designer",
    titles: ["Junior Product Designer", "Product Designer", "Senior Product Designer"],
    required: ["Figma", "UI Design", "UX Research"],
    preferred: ["Design Systems", "Prototyping", "Interaction Design"],
    candidateSkills: [["Figma", "EXPERT"], ["UI Design", "ADVANCED"], ["UX Research", "ADVANCED"], ["Prototyping", "ADVANCED"], ["Design Systems", "INTERMEDIATE"]],
    degree: "BA", field: "Interaction Design",
    baseSalary: 80000,
    summary: "Design clear, humane products from research to polish.",
    responsibilities: ["Lead design for a product area", "Run research and usability tests", "Prototype and iterate quickly", "Evolve our design system", "Partner with engineering through delivery"],
    requirements: ["A portfolio of shipped product work", "Mastery of Figma", "Research and synthesis skills", "Strong visual craft", "Clear communication"],
  },
  "product-manager": {
    key: "product-manager",
    titles: ["Associate Product Manager", "Product Manager", "Senior Product Manager"],
    required: ["Product Management", "Roadmapping", "Stakeholder Management"],
    preferred: ["Product Analytics", "A/B Testing", "Agile"],
    candidateSkills: [["Product Management", "ADVANCED"], ["Roadmapping", "ADVANCED"], ["Stakeholder Management", "ADVANCED"], ["Agile", "ADVANCED"], ["Product Analytics", "INTERMEDIATE"]],
    degree: "MBA", field: "Business Administration",
    baseSalary: 100000,
    summary: "Define what we build next and why.",
    responsibilities: ["Own the roadmap for a product area", "Talk to customers every week", "Define success metrics", "Align stakeholders around priorities", "Ship iteratively with engineering and design"],
    requirements: ["Product management experience", "Analytical, data-informed thinking", "Excellent communication", "Customer empathy", "Technical curiosity"],
  },
  marketing: {
    key: "marketing",
    titles: ["Marketing Coordinator", "Marketing Manager", "Senior Growth Marketing Manager"],
    required: ["Content Marketing", "SEO", "Marketing Analytics"],
    preferred: ["Google Ads", "Email Marketing", "Copywriting"],
    candidateSkills: [["Content Marketing", "ADVANCED"], ["SEO", "ADVANCED"], ["Marketing Analytics", "INTERMEDIATE"], ["Copywriting", "ADVANCED"], ["Social Media", "ADVANCED"]],
    degree: "BA", field: "Marketing",
    baseSalary: 65000,
    summary: "Grow our audience with campaigns people actually want to see.",
    responsibilities: ["Plan and run multi-channel campaigns", "Own content and SEO strategy", "Measure and report on performance", "Work with sales on pipeline", "Experiment relentlessly"],
    requirements: ["Experience running campaigns", "Strong writing skills", "Comfort with analytics tools", "Creativity with discipline", "Organised and proactive"],
  },
  sales: {
    key: "sales",
    titles: ["Sales Development Representative", "Account Executive", "Senior Account Executive"],
    required: ["B2B Sales", "CRM", "Negotiation"],
    preferred: ["Salesforce", "Lead Generation", "Account Management"],
    candidateSkills: [["B2B Sales", "ADVANCED"], ["CRM", "ADVANCED"], ["Negotiation", "ADVANCED"], ["Salesforce", "INTERMEDIATE"]],
    degree: "BA", field: "Business",
    baseSalary: 60000,
    summary: "Help customers discover how we can transform their business.",
    responsibilities: ["Manage a full sales cycle", "Build relationships with decision makers", "Forecast accurately in the CRM", "Collaborate with marketing and product", "Exceed quarterly targets"],
    requirements: ["B2B sales experience", "Excellent negotiation skills", "Comfort with CRM tools", "Resilience and drive", "Strong presentation skills"],
  },
  "finance-analyst": {
    key: "finance-analyst",
    titles: ["Junior Financial Analyst", "Financial Analyst", "Senior Financial Analyst"],
    required: ["Financial Modeling", "Excel", "Accounting"],
    preferred: ["Budgeting", "Power BI", "Risk Management"],
    candidateSkills: [["Financial Modeling", "ADVANCED"], ["Excel", "EXPERT"], ["Accounting", "ADVANCED"], ["Budgeting", "ADVANCED"]],
    degree: "BSc", field: "Finance",
    baseSalary: 72000,
    summary: "Shape financial planning and decision-making.",
    responsibilities: ["Build and maintain financial models", "Prepare budgets and forecasts", "Analyse performance against plan", "Support strategic decisions", "Improve reporting processes"],
    requirements: ["Strong financial modelling skills", "Advanced Excel", "Accounting fundamentals", "Analytical mindset", "Clear communication"],
  },
  "project-manager": {
    key: "project-manager",
    titles: ["Project Coordinator", "Project Manager", "Senior Program Manager"],
    required: ["Project Management", "Stakeholder Management", "Agile"],
    preferred: ["Jira", "Budgeting", "Risk Management"],
    candidateSkills: [["Project Management", "ADVANCED"], ["Stakeholder Management", "ADVANCED"], ["Agile", "ADVANCED"], ["Jira", "ADVANCED"]],
    degree: "BSc", field: "Business Administration",
    baseSalary: 78000,
    summary: "Lead complex projects to on-time, on-budget delivery.",
    responsibilities: ["Plan and run cross-functional projects", "Manage scope, risks and timelines", "Keep stakeholders aligned", "Report progress transparently", "Improve delivery processes"],
    requirements: ["Project management experience", "Strong organisation skills", "Stakeholder communication", "Comfort with ambiguity", "PMP or similar is a plus"],
  },
  nurse: {
    key: "nurse",
    titles: ["Registered Nurse", "Senior Registered Nurse", "Nurse Manager"],
    required: ["Patient Care", "Nursing"],
    preferred: ["Healthcare Administration", "Communication"],
    candidateSkills: [["Patient Care", "EXPERT"], ["Nursing", "EXPERT"], ["Communication", "ADVANCED"]],
    degree: "BSc", field: "Nursing",
    baseSalary: 75000,
    summary: "Deliver compassionate, high-quality patient care.",
    responsibilities: ["Provide direct patient care", "Coordinate with physicians and specialists", "Maintain accurate records", "Educate patients and families", "Uphold safety standards"],
    requirements: ["Registered nursing licence", "Clinical experience", "Empathy and resilience", "Teamwork", "Attention to detail"],
  },
  teacher: {
    key: "teacher",
    titles: ["Teaching Assistant", "Curriculum Designer", "Lead Instructional Designer"],
    required: ["Teaching", "Curriculum Design"],
    preferred: ["E-learning", "Instructional Design"],
    candidateSkills: [["Teaching", "EXPERT"], ["Curriculum Design", "ADVANCED"], ["E-learning", "INTERMEDIATE"]],
    degree: "MA", field: "Education",
    baseSalary: 45000,
    summary: "Design learning experiences that help every student thrive.",
    responsibilities: ["Design engaging courses", "Collaborate with subject experts", "Measure learning outcomes", "Iterate on content", "Support teachers using our platform"],
    requirements: ["Teaching or curriculum experience", "Strong writing", "Learner empathy", "Comfort with digital tools", "Organised approach"],
  },
  hr: {
    key: "hr",
    titles: ["HR Coordinator", "HR Business Partner", "Senior Talent Acquisition Partner"],
    required: ["Recruiting", "HR Operations", "Employee Relations"],
    preferred: ["Employer Branding", "Payroll"],
    candidateSkills: [["Recruiting", "ADVANCED"], ["HR Operations", "ADVANCED"], ["Employee Relations", "ADVANCED"]],
    degree: "BA", field: "Human Resources",
    baseSalary: 60000,
    summary: "Build a workplace people love.",
    responsibilities: ["Partner with leaders on people topics", "Run recruitment processes", "Support employee relations", "Improve HR operations", "Champion culture and inclusion"],
    requirements: ["HR experience", "Discretion and judgement", "Strong communication", "Organisation skills", "Knowledge of labour law basics"],
  },
  operations: {
    key: "operations",
    titles: ["Operations Associate", "Operations Manager", "Senior Supply Chain Manager"],
    required: ["Operations", "Supply Chain", "Logistics"],
    preferred: ["Excel", "Project Management"],
    candidateSkills: [["Operations", "ADVANCED"], ["Supply Chain", "ADVANCED"], ["Logistics", "ADVANCED"], ["Excel", "ADVANCED"]],
    degree: "BSc", field: "Supply Chain Management",
    baseSalary: 70000,
    summary: "Keep our operations efficient and resilient.",
    responsibilities: ["Optimise operational processes", "Manage supplier relationships", "Track KPIs and costs", "Lead continuous improvement", "Coordinate across teams"],
    requirements: ["Operations or supply chain experience", "Analytical skills", "Leadership", "Process orientation", "Excellent organisation"],
  },
};

export const BENEFITS = [
  "Flexible working hours", "Remote-friendly culture", "Private health insurance", "Annual learning budget",
  "Home office stipend", "Parental leave", "Wellness allowance", "Stock options", "25 days paid leave", "Team offsites",
];

export const VALUES = ["Ownership", "Craft", "Kindness", "Curiosity", "Transparency", "Customer obsession", "Bias for action", "Inclusion"];

// [name, roleKey, city, country, years, languages]
export const PEOPLE: [string, string, string, string, number, string[]][] = [
  ["Lina Haddad", "product-designer", "Beirut", "LB", 7, ["ar", "en", "fr"]],
  ["Jonas Weber", "backend", "Berlin", "DE", 5, ["de", "en"]],
  ["Aisha Bello", "frontend", "Lagos", "NG", 3, ["en", "yo"]],
  ["Diego Fernández", "fullstack", "Madrid", "ES", 6, ["es", "en"]],
  ["Priya Sharma", "data-analyst", "Bangalore", "IN", 4, ["en", "hi"]],
  ["Lucas Silva", "mobile", "São Paulo", "BR", 5, ["pt", "en"]],
  ["Emma Johansson", "product-manager", "Stockholm", "SE", 8, ["sv", "en"]],
  ["Yuki Tanaka", "frontend", "Tokyo", "JP", 2, ["ja", "en"]],
  ["Noah Williams", "devops", "Austin", "US", 9, ["en"]],
  ["Fatima Zahra", "marketing", "Casablanca", "MA", 4, ["ar", "fr", "en"]],
  ["Ethan Brooks", "sales", "Chicago", "US", 6, ["en"]],
  ["Chen Wei", "data-engineer", "Singapore", "SG", 7, ["zh", "en"]],
  ["Sara Rossi", "project-manager", "Milan", "IT", 10, ["it", "en"]],
  ["Ahmed Hassan", "backend", "Cairo", "EG", 4, ["ar", "en"]],
  ["Hannah Müller", "product-designer", "Munich", "DE", 3, ["de", "en"]],
  ["Kwame Mensah", "fullstack", "Accra", "GH", 5, ["en"]],
  ["Isabella Garcia", "finance-analyst", "Mexico City", "MX", 6, ["es", "en"]],
  ["Ravi Patel", "devops", "London", "GB", 6, ["en", "hi"]],
  ["Mei Lin", "frontend", "Taipei", "TW", 7, ["zh", "en"]],
  ["Olga Petrova", "data-analyst", "Warsaw", "PL", 3, ["pl", "en", "ru"]],
  ["Tom Becker", "frontend", "Lisbon", "PT", 4, ["en", "pt"]],
  ["Nadia Karimi", "hr", "Amman", "JO", 8, ["ar", "en"]],
  ["Samuel Osei", "mobile", "Nairobi", "KE", 4, ["en", "sw"]],
  ["Clara Dubois", "marketing", "Paris", "FR", 5, ["fr", "en"]],
  ["Mateo López", "project-manager", "Buenos Aires", "AR", 7, ["es", "en"]],
  ["Grace Lee", "product-manager", "Seoul", "KR", 6, ["ko", "en"]],
  ["Youssef Benali", "frontend", "Dubai", "AE", 5, ["ar", "en", "fr"]],
  ["Anna Kowalska", "teacher", "Kraków", "PL", 9, ["pl", "en"]],
  ["Marcus Johnson", "nurse", "Boston", "US", 11, ["en"]],
  ["Leila Nasser", "finance-analyst", "Riyadh", "SA", 5, ["ar", "en"]],
  ["Ivan Novak", "backend", "Prague", "CZ", 8, ["cs", "en"]],
  ["Zara Ahmed", "data-engineer", "Toronto", "CA", 4, ["en", "ur"]],
  ["Ben Carter", "sales", "Sydney", "AU", 3, ["en"]],
  ["Elif Yılmaz", "product-designer", "Istanbul", "TR", 5, ["tr", "en"]],
  ["Hugo Martin", "operations", "Rotterdam", "NL", 9, ["nl", "en", "fr"]],
  ["Amara Diallo", "fullstack", "Dakar", "SN", 2, ["fr", "en"]],
  ["Sofia Andersson", "frontend", "Oslo", "NO", 6, ["no", "en"]],
  ["Karim Saleh", "devops", "Doha", "QA", 7, ["ar", "en"]],
  ["Julia Santos", "data-analyst", "Lisbon", "PT", 2, ["pt", "en"]],
  ["Daniel Cohen", "product-manager", "Tel Aviv", "IL", 9, ["he", "en"]],
];

export const SCHOOLS: Record<string, string> = {
  DE: "Technical University of Munich", LB: "American University of Beirut", NG: "University of Lagos", ES: "Universidad Complutense de Madrid",
  IN: "Indian Institute of Science", BR: "Universidade de São Paulo", SE: "KTH Royal Institute of Technology", JP: "University of Tokyo",
  US: "University of Texas at Austin", MA: "Mohammed V University", SG: "National University of Singapore", IT: "Politecnico di Milano",
  EG: "Cairo University", GH: "University of Ghana", MX: "UNAM", GB: "University of Manchester", TW: "National Taiwan University",
  PL: "University of Warsaw", PT: "University of Porto", JO: "University of Jordan", KE: "University of Nairobi", FR: "Sorbonne University",
  AR: "Universidad de Buenos Aires", KR: "Seoul National University", AE: "Khalifa University", SA: "King Saud University",
  CZ: "Czech Technical University", CA: "University of Toronto", AU: "University of Sydney", TR: "Boğaziçi University",
  NL: "Erasmus University Rotterdam", SN: "Cheikh Anta Diop University", NO: "University of Oslo", QA: "Qatar University", IL: "Tel Aviv University",
};

export const PAST_EMPLOYERS = ["Pixel & Co", "Brightside", "Bluebird Systems", "Copperline", "Waveform", "Hearth Studio", "Polar Labs", "Quarry", "Signal Path", "Tidewater"];

export const POSTS: { type: "UPDATE" | "ACHIEVEMENT" | "PROJECT"; content: string }[] = [
  { type: "ACHIEVEMENT", content: "Thrilled to share that I've just been promoted to Senior Engineer! Huge thanks to my team for three years of trust, feedback and great code reviews." },
  { type: "UPDATE", content: "A small habit that changed how I work: writing a one-paragraph decision log before every meaningful technical choice. Six months later, future-me is very grateful." },
  { type: "PROJECT", content: "Just open-sourced the accessibility checklist our team uses before every release. 42 checks, each with a short why and how. Feedback welcome!" },
  { type: "UPDATE", content: "Hiring tip for candidates: when a job post lists required skills, show evidence of each one in your projects section. It makes a recruiter's job so much easier." },
  { type: "ACHIEVEMENT", content: "Passed my AWS Solutions Architect exam this morning. Six weeks of evenings, one very patient partner, and a lot of coffee." },
  { type: "UPDATE", content: "Ran our first fully async planning week. Fewer meetings, more written proposals, better decisions. Writing it up for the team blog next." },
  { type: "PROJECT", content: "Wrapped up a research sprint with 14 user interviews. Biggest insight: people don't want more features, they want fewer decisions." },
  { type: "UPDATE", content: "Mentoring three junior designers this quarter. The best question I get asked: 'How do you know when a design is done?' Still working on a good answer." },
  { type: "ACHIEVEMENT", content: "Our team shipped the new onboarding flow — activation is up 18% in the first two weeks. Proud of everyone who worked on it." },
  { type: "UPDATE", content: "Reminder that 'senior' is mostly about scope of impact, not years. Take on the ambiguous problems nobody else wants." },
  { type: "PROJECT", content: "Built a small dashboard that tracks public transit delays in real time. Weekend project, but the city's data team reached out about it!" },
  { type: "UPDATE", content: "Looking for recommendations: what's the best book you've read on leading without authority?" },
];

export const COMPANY_POSTS = [
  "We're growing! Our engineering team is expanding across three time zones. Check out our open roles.",
  "Behind the scenes from our quarterly offsite — two days of planning, one day of hiking, and a lot of good food.",
  "Proud to share that we've been recognised as one of the best places to work this year. Thank you to every teammate.",
  "New: every employee now gets a learning budget that rolls over year to year. Growth shouldn't expire.",
];

export const COMMENTS = [
  "Congratulations, well deserved!", "This is so useful, thank you for sharing.", "Great insight — saving this.",
  "Love this approach.", "Would love to hear more about how you did this.", "Couldn't agree more.", "Amazing work!",
];
