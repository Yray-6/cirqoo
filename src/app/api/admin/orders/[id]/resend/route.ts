import { requireAdmin } from "@/server/auth";
import { resendOrder } from "@/server/inventory";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (_request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  await resendOrder(id);
  return Response.json({ ok: true });
});
