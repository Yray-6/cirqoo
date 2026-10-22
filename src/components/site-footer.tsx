import Image from "next/image";
import { NewsletterForm } from "@/components/newsletter-form";
import { Wordmark } from "@/components/wordmark";

const companyLinks = [
  { label: "Homepage", href: "https://cirqoo.app" },
  { label: "About Us", href: "https://www.instagram.com/cirqoo?vrfl=YmoxMjFhajhucG1h" },
  { label: "How Cirqoo Works", href: "https://www.instagram.com/cirqoo?vrfl=YmoxMjFhajhucG1h" },
  { label: "Blog", href: "https://www.instagram.com/cirqoo?vrfl=YmoxMjFhajhucG1h" },
];

const socialLinks = [
  // { label: "Facebook", href: "https://tix.africa", icon: "/facebook-56586a.png" },
  // { label: "X (Twitter)", href: "https://tix.africa", icon: "/x-56586a.png" },
  { label: "Instagram", href: "https://www.instagram.com/cirqoo?vrfl=YmoxMjFhajhucG1h", icon: "/instagram-56586a.png" },
  { label: "Tiktok", href: "https://www.tiktok.com/@cirqoo?_r=1&_t=ZS-9Am01dDQ8hS", icon: "/tiktok-56586a.png" },
];

const policyLinks = [
  { label: "Terms & Conditions", href: "https://tix.africa" },
  { label: "Privacy Policy", href: "https://tix.africa" },
  { label: "Refund Policy", href: "https://tix.africa" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-footer">
      <div className="flex flex-col gap-16 px-6 py-10 min-[1100px]:gap-28 min-[1100px]:px-[72px]">
        <div className="flex flex-wrap items-start justify-between gap-14">
          <div className="max-w-md">
            <a href="/" aria-label="Cirqoo home" className="mb-8 inline-block">
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
            <nav aria-label="Follow Us" className="flex flex-col gap-6">
              <p className="text-base font-extrabold leading-6 text-brand">
                Follow Us
              </p>
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-4 text-base leading-6 text-black hover:text-brand"
                >
                  <Image
                    src={link.icon}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 object-contain"
                  />
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="text-base leading-6 text-black/70">
            Copyright © 2026. Cirqoo. All rights reserved.
          </p>
          {/* <nav aria-label="Policies" className="flex flex-wrap gap-8 min-[1100px]:gap-16">
            {policyLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-base leading-6 text-black hover:text-brand"
              >
                {link.label}
              </a>
            ))}
          </nav> */}
        </div>
      </div>
    </footer>
  );
}
