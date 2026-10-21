import { requireUser, updateOwnName, sessionTokenFor, applySessionCookie } from "@/server/auth";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  const user = await requireUser({ allowPasswordChange: true });
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await updateOwnName(user.id, asString(body.name));
  const token = await sessionTokenFor({ ...user, name: asString(body.name) });
  const response = Response.json({ ok: true });
  applySessionCookie(response, token);
  return response;
});
