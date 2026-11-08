"use client";

import type { ReactNode } from "react";
import { useAdminStatus } from "@/components/admin/admin-store";
import { useNavPending } from "@/components/admin/nav-pending";
import { PageSkeleton } from "@/components/admin/page-skeleton";

export function AdminOutlet({ children }: { children: ReactNode }) {
  const { status, error } = useAdminStatus();
  const { target } = useNavPending();
  const pending = target !== null;

  if (status === "error") {
    return (
      <p role="alert" className="text-sm font-bold text-brand">
        {error || "The admin data did not load."}
      </p>
    );
  }

  return (
    <>
      {status === "ready" ? (
        <div className={pending ? "hidden" : undefined} aria-hidden={pending || undefined}>
          {children}
        </div>
      ) : null}
      {status !== "ready" || pending ? <PageSkeleton path={target} /> : null}
    </>
  );
}
