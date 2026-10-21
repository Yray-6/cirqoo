import { requireAdmin } from "@/server/auth";
import { deleteTickets } from "@/server/ticket-admin";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  const deleted = await deleteTickets(asString(body.eventId), {
    code: asString(body.code),
    allUnsold: body.allUnsold === true,
  });
  return Response.json({ ok: true, deleted });
});
