"use client";

import type { ReactNode } from "react";
import { AdminOutlet } from "@/components/admin/admin-outlet";
import { AdminStoreProvider } from "@/components/admin/admin-store";
import { NavPendingProvider } from "@/components/admin/nav-pending";
import { AdminShell } from "@/components/admin/shell";
import { SuccessProvider } from "@/components/admin/success-modal";
import type { UserRole } from "@/lib/admin-mock";

export function AdminFrame({ role, children }: { role: UserRole; children: ReactNode }) {
  return (
    <AdminStoreProvider role={role}>
      <SuccessProvider>
        <NavPendingProvider>
          <AdminShell role={role}>
            <AdminOutlet>{children}</AdminOutlet>
          </AdminShell>
        </NavPendingProvider>
      </SuccessProvider>
    </AdminStoreProvider>
  );
}
