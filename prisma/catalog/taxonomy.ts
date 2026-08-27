/**
 * Catalogue taxonomy — categories, tags and instructors.
 *
 * All of this is original. Nothing here is scraped from or modelled on any
 * real platform's listings: the categories are the obvious shape of a
 * technology-and-business marketplace, and every instructor is fictional.
 * The `.test` email domain is reserved and can never resolve, which is what
 * keeps these unmistakably fixtures.
 */

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  /** Resolved to a component by `CategoryIcon`; only these eight keys exist. */
  iconKey: "code" | "chart" | "brain" | "palette" | "briefcase" | "megaphone" | "shield" | "camera";
}

export const CATEGORIES: SeedCategory[] = [
  {
    slug: "programming",
    name: "Programming",
    description: "Languages, tooling and the craft of writing software that lasts.",
    iconKey: "code",
  },
  {
    slug: "web-development",
    name: "Web Development",
    description: "Browsers, frameworks and shipping interfaces people actually use.",
    iconKey: "code",
  },
  {
    slug: "data-science",
    name: "Data Science",
    description: "Statistics, pipelines and drawing conclusions that hold up.",
    iconKey: "chart",
  },
  {
    slug: "artificial-intelligence",
    name: "Artificial Intelligence",
    description: "Model behaviour, evaluation and shipping AI features responsibly.",
    iconKey: "brain",
  },
  {
    slug: "machine-learning",
    name: "Machine Learning",
    description: "Training, tuning and the maths that decides whether a model works.",
    iconKey: "brain",
  },
  {
    slug: "cybersecurity",
    name: "Cybersecurity",
    description: "Threat modelling, defence and the habits that keep systems intact.",
    iconKey: "shield",
  },
  {
    slug: "cloud-computing",
    name: "Cloud Computing",
    description: "Infrastructure, cost and running services somebody else's hardware.",
    iconKey: "code",
  },
  {
    slug: "devops",
    name: "DevOps",
    description: "Delivery pipelines, observability and the path from commit to production.",
    iconKey: "code",
  },
  {
    slug: "database",
    name: "Database",
    description: "Modelling, querying and keeping data correct under load.",
    iconKey: "chart",
  },
  {
    slug: "computer-science",
    name: "Computer Science",
    description: "Algorithms, systems and the fundamentals the rest of it rests on.",
    iconKey: "code",
  },
  {
    slug: "business",
    name: "Business",
    description: "Operations, strategy and the mechanics of running something real.",
    iconKey: "briefcase",
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Modelling, markets and reading a set of accounts honestly.",
    iconKey: "chart",
  },
  {
    slug: "marketing",
    name: "Marketing",
    description: "Positioning, channels and measuring what actually moved.",
    iconKey: "megaphone",
  },
  {
    slug: "design",
    name: "Design",
    description: "Interface, interaction and the reasoning behind good visual decisions.",
    iconKey: "palette",
  },
  {
    slug: "personal-development",
    name: "Personal Development",
    description: "Attention, communication and working well over a long career.",
    iconKey: "briefcase",
  },
  {
    slug: "project-management",
    name: "Project Management",
    description: "Planning, delivery and keeping a team honest about dates.",
    iconKey: "briefcase",
  },
  {
    slug: "languages",
    name: "Languages",
    description: "Speaking, listening and reaching fluency without losing momentum.",
    iconKey: "megaphone",
  },
];

/** Every tag any course may reference. Kept flat and lowercase. */
export const TAGS = [
  "architecture",
  "scalability",
  "databases",
  "communication",
  "documentation",
  "statistics",
  "analysis",
  "design-systems",
  "tokens",
  "evaluation",
  "llms",
  "positioning",
  "strategy",
  "reliability",
  "python",
  "javascript",
  "typescript",
  "react",
  "nodejs",
  "sql",
  "testing",
  "performance",
  "security",
  "cryptography",
  "networking",
  "linux",
  "docker",
  "kubernetes",
  "terraform",
  "ci-cd",
  "observability",
  "aws",
  "api-design",
  "graphql",
  "rest",
  "caching",
  "algorithms",
  "data-structures",
  "concurrency",
  "compilers",
  "operating-systems",
  "pandas",
  "visualisation",
  "forecasting",
  "experimentation",
  "deep-learning",
  "nlp",
  "computer-vision",
  "mlops",
  "prompt-design",
  "fine-tuning",
  "threat-modelling",
  "incident-response",
  "compliance",
  "finance-modelling",
  "accounting",
  "valuation",
  "pricing",
  "growth",
  "seo",
  "content",
  "analytics",
  "brand",
  "ux-research",
  "accessibility",
  "typography",
  "prototyping",
  "productivity",
  "writing",
  "leadership",
  "hiring",
  "negotiation",
  "agile",
  "estimation",
  "risk",
  "stakeholders",
  "grammar",
  "vocabulary",
  "pronunciation",
  "fluency",
] as const;

export interface SeedInstructor {
  email: string;
  /** Shown on the instructor card. */
  location?: string;
  name: string;
  slug: string;
  headline: string;
  bio: string;
  expertise: string[];
  /** Categories this instructor teaches in. */
  categories: string[];
}

/**
 * Original fictional instructors.
 *
 * Each teaches a small, coherent set of categories, so a course's author is
 * always plausible for its subject rather than assigned at random.
 */
export const INSTRUCTORS: SeedInstructor[] = [
  {
    email: "priya@coursera.test",
    name: "Priya Raghunathan",
    slug: "priya-raghunathan",
    headline: "Distributed systems engineer, sixteen years in production",
    bio: "I have spent most of my career on the unglamorous half of distributed systems: the retries, the backpressure and the 3am pages. I teach the reasoning, not the buzzwords.",
    expertise: ["Distributed systems", "Databases", "Reliability"],
    location: "Bengaluru, India",
    categories: ["programming", "computer-science", "database", "cloud-computing"],
  },
  {
    email: "daniel@coursera.test",
    name: "Daniel Okonkwo",
    slug: "daniel-okonkwo",
    headline: "Staff engineer turned writing coach for technical teams",
    bio: "Good engineering that nobody can follow is wasted engineering. I help technical people write documents that change decisions.",
    expertise: ["Technical writing", "Communication", "Design docs"],
    location: "Lagos, Nigeria",
    categories: ["programming", "personal-development", "web-development"],
  },
  {
    email: "mei@coursera.test",
    name: "Mei Tanaka",
    slug: "mei-tanaka",
    headline: "Statistician working on causal inference in health data",
    bio: "Most analytical mistakes are not maths errors, they are design errors made before any data was collected. That is where my teaching starts.",
    expertise: ["Statistics", "Causal inference", "R"],
    location: "Kyoto, Japan",
    categories: ["data-science", "machine-learning", "business"],
  },
  {
    email: "tomas@coursera.test",
    name: "Tomás Lindqvist",
    slug: "tomas-lindqvist",
    headline: "Product designer, previously design lead at two marketplaces",
    bio: "I have watched three design systems rot and helped rebuild two of them. The governance matters more than the components.",
    expertise: ["Interaction design", "Design systems", "Research"],
    location: "Stockholm, Sweden",
    categories: ["design", "web-development"],
  },
  {
    email: "arjun@coursera.test",
    name: "Arjun Mehta",
    slug: "arjun-mehta",
    headline: "Security engineer, ex-incident responder",
    bio: "Spent four years being paged at three in the morning. Teaches the controls that actually reduced pages, and is candid about the ones that only produced paperwork.",
    expertise: ["Application security", "Incident response", "Threat modelling"],
    categories: ["cybersecurity", "devops", "cloud-computing"],
  },
  {
    email: "sofia@coursera.test",
    name: "Sofia Berg",
    slug: "sofia-berg",
    headline: "Machine learning engineer working on deployment",
    bio: "More interested in the model that survives contact with production than the one that wins the offline benchmark. Most of her material is about the gap between the two.",
    expertise: ["MLOps", "Model evaluation", "Feature pipelines"],
    categories: ["machine-learning", "artificial-intelligence", "data-science"],
  },
  {
    email: "kwame@coursera.test",
    name: "Kwame Boateng",
    slug: "kwame-boateng",
    headline: "Platform engineer, container era survivor",
    bio: "Has migrated the same workload from bare metal to VMs to containers to a managed service, and will happily explain what each migration actually bought.",
    expertise: ["Kubernetes", "Infrastructure as code", "Observability"],
    categories: ["devops", "cloud-computing", "programming"],
  },
  {
    email: "lena@coursera.test",
    name: "Lena Vogt",
    slug: "lena-vogt",
    headline: "Front-end architect",
    bio: "Cares about the millisecond between a tap and a response, and about the person who has to maintain the code that produced it eighteen months later.",
    expertise: ["React", "Performance", "TypeScript"],
    categories: ["web-development", "programming"],
  },
  {
    email: "rohan@coursera.test",
    name: "Rohan Desai",
    slug: "rohan-desai",
    headline: "Data engineer turned analytics lead",
    bio: "Built warehouses that nobody queried and then learned why. Now starts every pipeline with the decision it is supposed to inform.",
    expertise: ["SQL", "Data modelling", "Warehousing"],
    categories: ["database", "data-science", "business"],
  },
  {
    email: "amelie@coursera.test",
    name: "Amélie Rousseau",
    slug: "amelie-rousseau",
    headline: "Product marketer with a research habit",
    bio: "Believes positioning is a research output, not a workshop output, and can show you the interview transcripts that changed her mind about a launch.",
    expertise: ["Positioning", "Go-to-market", "Customer research"],
    categories: ["marketing", "business"],
  },
  {
    email: "hassan@coursera.test",
    name: "Hassan Al-Rashid",
    slug: "hassan-al-rashid",
    headline: "Finance director, formerly an analyst who hated bad models",
    bio: "Has rebuilt enough inherited spreadsheets to have strong opinions about structure, and teaches models that a stranger can audit in ten minutes.",
    expertise: ["Financial modelling", "Valuation", "Reporting"],
    categories: ["finance", "business"],
  },
  {
    email: "yuki@coursera.test",
    name: "Yuki Nakamura",
    slug: "yuki-nakamura",
    headline: "Delivery lead who stopped believing in perfect estimates",
    bio: "Ships large projects on schedule by being honest about uncertainty early rather than heroic about it late.",
    expertise: ["Agile delivery", "Estimation", "Stakeholder management"],
    categories: ["project-management", "business", "personal-development"],
  },
  {
    email: "isabel@coursera.test",
    name: "Isabel Ortega",
    slug: "isabel-ortega",
    headline: "Language teacher and applied linguist",
    bio: "Teaches adults who have failed at a language before, which shapes everything about how her courses are sequenced.",
    expertise: ["Second-language acquisition", "Pronunciation", "Curriculum design"],
    categories: ["languages", "personal-development"],
  },
  {
    email: "nikhil@coursera.test",
    name: "Nikhil Sharma",
    slug: "nikhil-sharma",
    headline: "Algorithms instructor, competitive programming background",
    bio: "Spent his twenties on contest problems and his thirties explaining why most of that is irrelevant to the job — and which quarter of it is not.",
    expertise: ["Algorithms", "Data structures", "Problem solving"],
    categories: ["computer-science", "programming"],
  },
  {
    email: "grace@coursera.test",
    name: "Grace Mbeki",
    slug: "grace-mbeki",
    headline: "AI product engineer",
    bio: "Works on the unglamorous half of AI features: evaluation harnesses, guardrails, and knowing when the answer should be 'I do not know'.",
    expertise: ["LLM applications", "Evaluation", "Prompt design"],
    categories: ["artificial-intelligence", "machine-learning"],
  },
  {
    email: "victor@coursera.test",
    name: "Victor Almeida",
    slug: "victor-almeida",
    headline: "Backend engineer with a database obsession",
    bio: "Reads query plans for fun. Teaches the small number of database ideas that explain most production performance problems.",
    expertise: ["PostgreSQL", "Query optimisation", "Transactions"],
    categories: ["database", "programming", "computer-science"],
  },
  {
    email: "hana@coursera.test",
    name: "Hana Kowalski",
    slug: "hana-kowalski",
    headline: "UX researcher",
    bio: "Runs studies that change roadmaps rather than decorate them, and is direct about how often a finding is inconvenient.",
    expertise: ["UX research", "Usability testing", "Service design"],
    categories: ["design", "personal-development"],
  },
  {
    email: "omar@coursera.test",
    name: "Omar Haddad",
    slug: "omar-haddad",
    headline: "Cloud architect",
    bio: "Has signed off on architectures he later regretted, and structures his courses around the questions he wishes he had asked first.",
    expertise: ["Cloud architecture", "Cost engineering", "Networking"],
    categories: ["cloud-computing", "devops", "cybersecurity"],
  },
  {
    email: "clara@coursera.test",
    name: "Clara Whitfield",
    slug: "clara-whitfield",
    headline: "Growth lead with an analytics background",
    bio: "Came to marketing from data, which means she is unusually resistant to metrics that look impressive and mean nothing.",
    expertise: ["Growth", "Analytics", "Lifecycle marketing"],
    categories: ["marketing", "business", "data-science"],
  },
  {
    email: "ravi@coursera.test",
    name: "Ravi Krishnan",
    slug: "ravi-krishnan",
    headline: "Systems programmer",
    bio: "Works close to the metal and teaches the mental models — memory, scheduling, I/O — that make higher-level performance work make sense.",
    expertise: ["Operating systems", "Concurrency", "Performance"],
    categories: ["computer-science", "programming", "devops"],
  },
];
