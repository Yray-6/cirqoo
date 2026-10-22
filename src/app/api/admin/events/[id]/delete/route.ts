import { requireAdmin } from "@/server/auth";
import { deleteEvent } from "@/server/events";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (_request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  await deleteEvent(id);
  return Response.json({ ok: true });
});
