import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { currentUser } from "@/server/auth";

export const instant = false;

export default async function LoginPage() {
  const user = await currentUser();
  if (user?.mustChangePassword) redirect("/admin/profile");
  if (user) redirect(user.role === "staff" ? "/admin/scan" : "/admin");
  return <LoginForm />;
}
