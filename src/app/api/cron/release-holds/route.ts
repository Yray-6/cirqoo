import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/server/env";
import { sweepExpiredHolds } from "@/server/inventory";
import { apiGet } from "@/server/route";

function authorized(request: Request) {
  const expected = cronSecret();
  const header = request.headers.get("authorization");
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const provided = Buffer.from(token);
  const required = Buffer.from(expected);
  return provided.length === required.length && timingSafeEqual(provided, required);
}

export const GET = apiGet(async (request) => {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json(await sweepExpiredHolds());
});
