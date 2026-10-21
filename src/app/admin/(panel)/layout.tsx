import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminFrame } from "@/components/admin/admin-frame";
import { currentUser } from "@/server/auth";

export const instant = false;

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  const path = (await headers()).get("x-pathname") ?? "";
  if (path && user.mustChangePassword && !path.startsWith("/admin/profile")) {
    redirect("/admin/profile");
  }
  if (
    path &&
    user.role === "staff" &&
    path !== "/admin/scan" &&
    !path.startsWith("/admin/profile")
  ) {
    redirect("/admin/scan");
  }
  return <AdminFrame role={user.role}>{children}</AdminFrame>;
}
