import type { Blueprint } from "./blueprints";

/**
 * Courses migrated in from the client's reference build.
 *
 * Unlike every other blueprint in this catalogue, these four are not
 * original — they reproduce specific courses (title, curriculum spine,
 * artwork, and price) from the client's own reference project, which is
 * itself built around Microsoft-branded professional certificates. Kept in
 * their own file, separate from the procedurally-generated catalogue, so the
 * distinction stays visible in source control.
 *
 * Real-world overrides:
 *  - `thumbnailUrl` is the reference's actual photograph, not generated
 *    artwork.
 *  - `priceAmountOverride` is the reference's own one-time price, converted
 *    from USD to INR paise at roughly ₹83/$ and rounded to the nearest ₹100 —
 *    the reference priced in USD ("$250 one-time"); this platform only
 *    charges in INR, and has no subscription billing, so the "$X/month" side
 *    of the reference's pricing has no equivalent here.
 *  - `ratingAvgOverride` and `enrollmentCountOverride` are the reference's
 *    own published numbers ("4.7", "750K+ learners", …).
 *  - The instructor is still assigned by the normal category-matched,
 *    deterministic pick in `generate.ts` — the reference never named an
 *    individual teacher, only the partner brand ("Microsoft"), which is
 *    carried here in the title instead, exactly as the reference did.
 */
export const CLIENT_COURSES: Blueprint[] = [
  {
    title: "Microsoft Front-End Developer",
    category: "web-development",
    level: "BEGINNER",
    subtitle:
      "Learn front-end development with Microsoft: HTML, CSS, JavaScript and React, from zero to a portfolio-ready web app.",
    spine: [
      "Introduction to Web Development",
      "Responsive Web Design",
      "JavaScript DOM Manipulation",
    ],
    tags: ["javascript", "react"],
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&h=600",
    priceAmountOverride: 2_080_000,
    compareAtAmountOverride: null,
    ratingAvgOverride: 4.7,
    enrollmentCountOverride: 750_000,
  },
  {
    title: "Microsoft Back-End Developer",
    category: "programming",
    level: "INTERMEDIATE",
    subtitle:
      "Master back-end development with Microsoft: Node.js, Express, databases and REST APIs, built and deployed for real.",
    spine: [
      "Introduction to Back-End Development",
      "Database Management and MongoDB",
      "Authentication and Security",
    ],
    tags: ["nodejs", "sql", "api-design", "security"],
    thumbnailUrl:
      "https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&h=600",
    priceAmountOverride: 2_280_000,
    compareAtAmountOverride: null,
    ratingAvgOverride: 4.8,
    enrollmentCountOverride: 900_000,
  },
  {
    title: "Microsoft Full-Stack Developer",
    category: "web-development",
    level: "ADVANCED",
    subtitle:
      "Become a full-stack developer with Microsoft: front-end, back-end and DevOps, brought together into one working application.",
    spine: [
      "Full-Stack Development Basics",
      "Building RESTful APIs",
      "DevOps and Cloud Deployment",
    ],
    tags: ["javascript", "react", "nodejs"],
    thumbnailUrl:
      "https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&h=600",
    priceAmountOverride: 2_490_000,
    compareAtAmountOverride: null,
    ratingAvgOverride: 4.9,
    enrollmentCountOverride: 1_000_000,
  },
  {
    title: "Microsoft Project Management",
    category: "project-management",
    level: "BEGINNER",
    subtitle:
      "Learn project management with Microsoft: Agile, Scrum and the leadership skills to run a delivery team.",
    spine: [
      "Introduction to Project Management",
      "Agile and Scrum Methodology",
      "Risk and Stakeholder Management",
    ],
    tags: ["agile", "leadership", "risk", "stakeholders", "estimation"],
    thumbnailUrl:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&h=600",
    priceAmountOverride: 1_660_000,
    compareAtAmountOverride: null,
    ratingAvgOverride: 4.7,
    enrollmentCountOverride: 600_000,
  },
];
