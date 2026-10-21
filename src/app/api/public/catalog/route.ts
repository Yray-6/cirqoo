import { getCatalog } from "@/server/catalog";
import { apiGet } from "@/server/route";

export const GET = apiGet(async () => {
  return Response.json({ event: await getCatalog() });
});
