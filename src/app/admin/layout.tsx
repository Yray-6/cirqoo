import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cirqoo Admin",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
