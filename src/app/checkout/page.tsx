import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout-flow";

export const metadata: Metadata = {
  title: "Checkout - Cirqoo After Hours",
  description:
    "Choose tickets, add your contact details, and pay for Cirqoo After Hours - Karaoke & Games.",
  alternates: { canonical: "/checkout" },
};

export default function CheckoutPage() {
  return <CheckoutFlow />;
}
