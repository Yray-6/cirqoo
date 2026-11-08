import { requireAdmin } from "@/server/auth";
import { createEvent, type EventInput } from "@/server/events";
import { isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  const id = await createEvent(body as EventInput);
  return Response.json({ id });
});
