import Link from "next/link";
import { AtSign, MessageCircle, Rss, Video } from "lucide-react";

import { routes } from "@/lib/routes";
import type { CategorySummary } from "@/features/catalog/types";
import { Logo } from "@/components/layout/logo";

interface FooterLink {
  label: string;
  href: string;
}

const platformLinks: FooterLink[] = [
  { label: "About Coursera", href: routes.about },
  { label: "How it works", href: routes.home },
  { label: "Pricing", href: routes.pricing },
  { label: "Become an instructor", href: routes.becomeInstructor },
  { label: "Careers", href: routes.careers },
];

const resourceLinks: FooterLink[] = [
  { label: "Blog", href: routes.blog },
  { label: "Community", href: routes.community },
  { label: "All instructors", href: routes.instructors },
  { label: "Design system", href: routes.design },
];

const supportLinks: FooterLink[] = [
  { label: "Help centre", href: routes.help },
  { label: "Verify a certificate", href: routes.verifyHome },
  { label: "Contact us", href: routes.contact },
  { label: "Accessibility", href: routes.accessibility },
  { label: "Refund policy", href: routes.refunds },
];

const legalLinks: FooterLink[] = [
  { label: "Terms", href: routes.terms },
  { label: "Privacy", href: routes.privacy },
  { label: "Cookies", href: routes.cookies },
];

/**
 * Social destinations.
 *
 * Deliberately pointed at internal pages rather than invented external
 * profiles — Coursera has no social accounts, and linking to plausible-looking
 * URLs that belong to someone else would be worse than linking nowhere. The
 * icons are generic channel marks for the same reason: no third-party brand
 * marks ship in this repo. Swap both for real handles once they exist.
 */
const socialLinks = [
  { label: "Social", href: routes.home, icon: AtSign },
  { label: "Video channel", href: routes.home, icon: Video },
  { label: "Community", href: routes.community, icon: MessageCircle },
  { label: "Blog RSS", href: routes.blog, icon: Rss },
] as const;

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteFooter({ categories }: { categories: CategorySummary[] }) {
  const categoryLinks: FooterLink[] = categories.slice(0, 6).map((category) => ({
    label: category.name,
    href: routes.category(category.slug),
  }));

  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* --- platform information -------------------------------- */}
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              Coursera is a learning platform for people who finish what they start. Structured
              courses, progress that follows you between devices, and credentials anyone can verify.
            </p>
            <ul className="flex gap-1.5">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <Link
                    href={href}
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <FooterColumn title="Categories" links={categoryLinks} />
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Support" links={supportLinks} />
        </div>

        {/* --- legal bar ---------------------------------------------- */}
        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Coursera. An original learning platform.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
