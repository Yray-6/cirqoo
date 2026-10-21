import { asString, isRecord, readJson } from "@/server/http";
import { saveLead } from "@/server/events";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  const source = body.source === "checkout" ? "checkout" : "newsletter";
  await saveLead(asString(body.email), source);
  return Response.json({ ok: true });
});
