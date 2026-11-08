import { requireAdmin } from "@/server/auth";
import { asString, isRecord, readJson } from "@/server/http";
import { sendEventReminders } from "@/server/mail/reminder";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  const body = await readJson(request);
  const note = isRecord(body) ? asString(body.note) : "";
  if (note.length > 400) {
    return Response.json({ error: "Keep the note to 400 characters." }, { status: 400 });
  }
  const sent = await sendEventReminders(id, note);
  return Response.json({ sent });
});
