import { requireUser } from "@/server/auth";
import { loadAdminState } from "@/server/admin-data";
import { apiGet } from "@/server/route";

export const GET = apiGet(async () => {
  const user = await requireUser({ allowPasswordChange: true });
  return Response.json(await loadAdminState(user));
});
