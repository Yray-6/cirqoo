import { login } from "@/server/auth";
import { asString, isRecord, readJson } from "@/server/http";
import { applySessionCookie } from "@/server/auth";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  const result = await login(asString(body.email), typeof body.password === "string" ? body.password : "");
  const response = Response.json({
    role: result.user.role,
    mustChangePassword: result.user.mustChangePassword,
  });
  applySessionCookie(response, result.token);
  return response;
});
