import { HttpError } from "@/server/http";
import { initializePayment } from "@/server/paystack";
import { apiPost } from "@/server/route";
import { holdCookie } from "@/server/session-token";

export const POST = apiPost(async (request) => {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${holdCookie}=([^;]+)`));
  const orderId = match?.[1];
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    throw new HttpError(409, "This reservation expired. Start again.");
  }
  const { url } = await initializePayment(orderId);
  return Response.json({ url });
});
