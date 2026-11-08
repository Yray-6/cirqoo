import { createStaff, requireAdmin } from "@/server/auth";
import { asString, isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  await createStaff({
    name: asString(body.name),
    email: asString(body.email),
    password: typeof body.password === "string" ? body.password : "",
    role: body.role === "admin" ? "admin" : "staff",
  });
  return Response.json({ ok: true });
});
