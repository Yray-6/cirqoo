import { requireAdmin } from "@/server/auth";
import { redeemDiscount } from "@/server/admin-data";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (_request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await context.params;
  await redeemDiscount(id);
  return Response.json({ ok: true });
});
