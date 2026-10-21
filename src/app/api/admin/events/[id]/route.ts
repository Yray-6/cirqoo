import { requireAdmin } from "@/server/auth";
import { updateEvent, type EventInput } from "@/server/events";
import { isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await updateEvent(id, body as EventInput);
  return Response.json({ ok: true });
});
