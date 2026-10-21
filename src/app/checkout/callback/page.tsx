import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResult, PaymentResultShell } from "@/components/payment-result";

export const metadata: Metadata = {
  title: "Payment - Cirqoo After Hours",
  description: "Confirming your payment for Cirqoo After Hours - Karaoke & Games.",
  robots: { index: false, follow: false },
};

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<PaymentResultShell title="Confirming your payment" body="One moment while we check with Paystack." />}>
      <PaymentResult />
    </Suspense>
  );
}
