import { applySessionCookie, changeOwnPassword, requireUser } from "@/server/auth";
import { isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  const user = await requireUser({ allowPasswordChange: true });
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  const token = await changeOwnPassword(
    user,
    typeof body.currentPassword === "string" ? body.currentPassword : "",
    typeof body.nextPassword === "string" ? body.nextPassword : "",
  );
  const response = Response.json({ ok: true });
  applySessionCookie(response, token);
  return response;
});
