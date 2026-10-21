import { disableStaff, requireAdmin, resetStaffPassword } from "@/server/auth";
import { isRecord, readJson } from "@/server/http";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requireAdmin();
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isRecord(body)) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  if (body.action === "disable") {
    await disableStaff(actor.id, id);
    return Response.json({ ok: true });
  }
  if (body.action === "reset") {
    await resetStaffPassword(id, typeof body.password === "string" ? body.password : "");
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Choose reset or disable." }, { status: 400 });
});
