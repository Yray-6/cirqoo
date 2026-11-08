import { requireAdmin } from "@/server/auth";
import { ticketListFilter, ticketPage } from "@/server/admin-data";
import { apiGet } from "@/server/route";

export const GET = apiGet(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const page = Number(url.searchParams.get("page") ?? "1");
  const status = ticketListFilter(url.searchParams.get("status"));
  return Response.json(await ticketPage(eventId, page, status));
});
