import { requireAdmin } from "@/server/auth";
import { confirmOrder } from "@/server/inventory";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (_request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  const result = await confirmOrder(id);
  return Response.json(result);
});
