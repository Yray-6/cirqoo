"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/scan", label: "Scan Tickets" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/profile", label: "Profile" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm ${
              active
                ? "bg-[rgba(252,100,53,0.12)] font-bold text-brand"
                : "text-ink hover:bg-line"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 bg-[#f6f6f7]">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-6 md:flex">
        <Link href="/admin" className="px-3 pb-6" aria-label="Admin home">
          <Wordmark />
        </Link>
        <div className="flex-1">
          <NavLinks />
        </div>
        <Link
          href="/"
          className="px-3 pt-4 text-sm text-muted hover:text-ink"
        >
          View site
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <Link href="/admin" aria-label="Admin home">
            <Wordmark className="text-2xl" />
          </Link>
          <button
            type="button"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm font-bold"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setOpen((current) => !current)}
          >
            Menu
          </button>
        </header>
        {open ? (
          <div id="admin-menu" className="border-b border-line bg-white px-3 py-3 md:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
            <Link
              href="/"
              className="mt-3 block px-3 text-sm text-muted"
              onClick={() => setOpen(false)}
            >
              View site
            </Link>
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
