import { requireAdmin } from "@/server/auth";
import { provisionTickets } from "@/server/events";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await provisionTickets(asString(body.eventId), asString(body.tierId), Number(body.count));
  return Response.json({ ok: true });
});
