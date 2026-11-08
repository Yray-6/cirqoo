import { requireUser } from "@/server/auth";
import { scanTicket } from "@/server/inventory";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireUser({ allowPasswordChange: true });
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  return Response.json(await scanTicket(asString(body.code)));
});
