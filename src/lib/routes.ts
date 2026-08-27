/**
 * Every URL the app links to, in one place.
 *
 * Most of these routes are not built yet — they land in Phases 4 through 15.
 * Centralising them means the navbar and footer can be written against their
 * final shape now, and when a route is implemented nothing linking to it has
 * to change. Until then they resolve to the 404 page.
 *
 * `typedRoutes` is disabled in next.config.ts for exactly this reason; it gets
 * switched back on in Phase 5 once the catalogue routes are real.
 */
export const routes = {
  home: "/",
  design: "/design",

  // --- catalogue (Phase 5) --------------------------------------------------
  courses: "/courses",
  course: (slug: string) => `/courses/${slug}`,
  categories: "/categories",
  category: (slug: string) => `/courses?category=${encodeURIComponent(slug)}`,
  search: (query: string) => `/courses?q=${encodeURIComponent(query)}`,
  instructors: "/instructors",
  instructor: (slug: string) => `/instructors/${slug}`,

  // --- learning & commerce --------------------------------------------------
  learn: (courseSlug: string) => `/learn/${courseSlug}`,
  checkout: "/checkout",
  checkoutSuccess: "/checkout/success",
  checkoutCancelled: "/checkout/cancelled",
  orders: "/orders",
  order: (orderNumber: string) => `/orders/${orderNumber}`,
  checkoutFor: (courseSlug: string) => `/checkout?course=${encodeURIComponent(courseSlug)}`,

  // --- student (Phases 6, 9, 12, 13) ---------------------------------------
  dashboard: "/dashboard",
  dashboardCourses: "/dashboard/courses",
  dashboardProgress: "/dashboard/progress",
  dashboardCertificates: "/dashboard/certificates",
  dashboardWishlist: "/dashboard/wishlist",
  myLearning: "/dashboard/courses",
  wishlist: "/wishlist",
  certificates: "/dashboard/certificates",
  certificate: (serial: string) => `/certificates/${serial}`,
  verify: (serial: string) => `/verify/${serial}`,
  verifyHome: "/verify",
  notifications: "/notifications",
  profile: "/profile",
  settings: "/settings",

  // --- instructor studio (Phase 7) -----------------------------------------
  studio: "/studio",
  studioCourses: "/studio/courses",
  studioNewCourse: "/studio/courses/new",
  studioStudents: "/studio/students",
  studioQuizzes: "/studio/quizzes",
  studioQuiz: (lessonId: string) => `/studio/quizzes/${lessonId}`,
  studioSubmissions: "/studio/submissions",
  studioRevenue: "/studio/revenue",

  // --- admin (Phase 15) -----------------------------------------------------
  admin: "/admin",
  adminUsers: "/admin/users",
  adminUser: (id: string) => `/admin/users?user=${encodeURIComponent(id)}`,
  adminCourses: "/admin/courses",
  adminCategories: "/admin/categories",
  adminPayments: "/admin/payments",
  adminReports: "/admin/reports",

  // --- auth (Phase 4) -------------------------------------------------------
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  unauthorized: "/unauthorized",
  becomeInstructor: "/teach",

  // --- company & support ----------------------------------------------------
  about: "/about",
  careers: "/careers",
  blog: "/blog",
  contact: "/contact",
  help: "/help",
  community: "/community",
  pricing: "/pricing",

  // --- legal ----------------------------------------------------------------
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  cookies: "/legal/cookies",
  accessibility: "/legal/accessibility",
  refunds: "/legal/refunds",
} as const;
