import { requireAdmin } from "@/server/auth";
import { addDiscount } from "@/server/admin-data";
import { isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await addDiscount({
    code: String(body.code ?? ""),
    eventId: String(body.eventId ?? ""),
    cut: body.cut === "fixed" ? "fixed" : "percentage",
    percent: Number(body.percent),
    amount: Number(body.amount),
    usageLimit: Number(body.usageLimit),
  });
  return Response.json({ ok: true });
});
