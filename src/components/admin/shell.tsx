"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";
import { useNavPending } from "@/components/admin/nav-pending";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/admin-mock";

const adminLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/scan", label: "Scan Tickets" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/profile", label: "Profile" },
];

const staffLinks = [
  { href: "/admin/scan", label: "Scan Tickets" },
  { href: "/admin/profile", label: "Profile" },
];

function NavLinks({
  links,
  onNavigate,
}: {
  links: Array<(typeof adminLinks)[number] | (typeof staffLinks)[number]>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { target } = useNavPending();
  const current = target ?? pathname;

  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {links.map((link) => {
        const exact = "exact" in link && link.exact;
        const active = exact
          ? current === link.href
          : current === link.href || current.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm ${
              active ? "bg-[rgba(252,100,53,0.12)] font-bold text-brand" : "text-ink hover:bg-line"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = role === "staff" ? staffLinks : adminLinks;

  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 bg-[#f6f6f7]">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-6 md:flex">
        <Link href={role === "staff" ? "/admin/scan" : "/admin"} className="px-3 pb-6" aria-label="Admin home">
          <Wordmark />
        </Link>
        <div className="flex-1">
          <NavLinks links={links} />
        </div>
        <button type="button" onClick={() => void logout()} className="px-3 pt-4 text-left text-sm text-muted hover:text-ink">
          Sign out
        </button>
        <Link href="/" className="px-3 pt-2 text-sm text-muted hover:text-ink">
          View site
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <Link href={role === "staff" ? "/admin/scan" : "/admin"} aria-label="Admin home">
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
            <NavLinks links={links} onNavigate={() => setOpen(false)} />
            <button type="button" className="mt-3 block px-3 text-sm text-muted" onClick={() => void logout()}>
              Sign out
            </button>
            <Link href="/" className="mt-2 block px-3 text-sm text-muted" onClick={() => setOpen(false)}>
              View site
            </Link>
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
