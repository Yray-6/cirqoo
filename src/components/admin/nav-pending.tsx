"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type NavPendingValue = {
  target: string | null;
  expect: (pathname: string) => void;
};

const NavPendingContext = createContext<NavPendingValue | null>(null);

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [target, setTarget] = useState<string | null>(null);
  const origin = useRef(pathname);

  const expect = useCallback((next: string) => {
    if (next === window.location.pathname) return;
    origin.current = window.location.pathname;
    setTarget(next);
  }, []);

  useEffect(() => {
    if (!target) return;
    if (pathname !== origin.current) setTarget(null);
  }, [pathname, target]);

  useEffect(() => {
    if (!target) return;
    const timer = window.setTimeout(() => setTarget(null), 10000);
    return () => window.clearTimeout(timer);
  }, [target]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let next: URL;
      try {
        next = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (next.origin !== window.location.origin) return;
      if (!next.pathname.startsWith("/admin") || next.pathname === "/admin/login") return;
      expect(next.pathname);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [expect]);

  return <NavPendingContext.Provider value={{ target, expect }}>{children}</NavPendingContext.Provider>;
}

export function useNavPending() {
  const value = useContext(NavPendingContext);
  if (!value) throw new Error("Navigation state is missing.");
  return value;
}
