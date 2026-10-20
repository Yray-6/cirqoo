import { Suspense } from "react";
import { AdminStoreProvider } from "@/components/admin/admin-store";
import { AdminShell } from "@/components/admin/shell";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminStoreProvider>
      <Suspense fallback={<div className="p-8 text-sm text-muted">Loading admin…</div>}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </AdminStoreProvider>
  );
}
