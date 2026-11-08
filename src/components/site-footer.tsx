import { NewsletterForm } from "@/components/newsletter-form";
import { Wordmark } from "@/components/wordmark";

const companyLinks = [
  { label: "Homepage", href: "/" },
  { label: "About Us", href: "/" },
  { label: "How Open Tickets Works", href: "/" },
  { label: "Blog", href: "/" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-footer">
      <div className="flex flex-col gap-16 px-6 py-10 min-[1100px]:gap-28 min-[1100px]:px-[72px]">
        <div className="flex flex-wrap items-start justify-between gap-14">
          <div className="max-w-md">
            <a href="/" aria-label="Open Tickets home" className="mb-8 inline-block">
              <Wordmark />
            </a>
            <p className="mb-6 max-w-sm text-base leading-6 text-ink">
              Sign up to our newsletter to receive information about upcoming
              events.
            </p>
            <NewsletterForm />
          </div>

          <div className="flex flex-wrap gap-16 min-[1100px]:gap-[120px]">
            <nav aria-label="Company" className="flex flex-col gap-6">
              <p className="text-base font-extrabold leading-6 text-brand">
                Company
              </p>
              {companyLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-base leading-6 text-black hover:text-brand"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="text-base leading-6 text-black/70">
            Copyright © 2026. Open Tickets. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
