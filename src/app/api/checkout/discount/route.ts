import { HttpError, asString, clientIp, isRecord, readJson } from "@/server/http";
import { assertHoldRate, quoteCheckout, type HoldLine } from "@/server/inventory";
import { apiPost } from "@/server/route";

export const POST = apiPost(async (request) => {
  assertHoldRate(clientIp(request));
  const body = await readJson(request);
  if (!isRecord(body) || !Array.isArray(body.lines)) {
    throw new HttpError(400, "Choose a ticket to continue.");
  }
  const lines: HoldLine[] = body.lines.map((line) => {
    if (!isRecord(line)) return { tierId: "", quantity: 0 };
    return { tierId: asString(line.tierId), quantity: Number(line.quantity) };
  });
  return Response.json(await quoteCheckout({ code: asString(body.code), lines }));
});
