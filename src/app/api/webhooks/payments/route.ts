import { isRecord } from "@/server/http";
import { settlePayment, verifyWebhookSignature, webhookSignatureHeaderName } from "@/server/payments";

// The payment provider posts here directly, so there is no browser origin to check.
// Always answer 200 once the signature is good, or the provider keeps retrying.
export async function POST(request: Request) {
  const raw = await request.text();
  let valid = false;
  try {
    valid = verifyWebhookSignature(raw, request.headers.get(webhookSignatureHeaderName()));
  } catch {
    return Response.json({ error: "Payments are not configured." }, { status: 503 });
  }
  if (!valid) return Response.json({ error: "Bad signature." }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || !isRecord(payload.data)) return Response.json({ ok: true });

  const event = typeof payload.event === "string" ? payload.event : "";
  const reference = typeof payload.data.reference === "string" ? payload.data.reference : null;
  console.error(`payments settle ${JSON.stringify({ source: "webhook", event, reference })}`);

  if (event === "charge.success" && reference) {
    try {
      const result = await settlePayment(reference, "webhook");
      return Response.json({ ok: true, status: result.status });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.error(`payments webhook settle failed: ${detail}`);
    }
  }
  return Response.json({ ok: true });
}
