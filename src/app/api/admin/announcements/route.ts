import { requireAdmin } from "@/server/auth";
import { addAnnouncement } from "@/server/admin-data";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await addAnnouncement(asString(body.title), asString(body.body));
  return Response.json({ ok: true });
});
