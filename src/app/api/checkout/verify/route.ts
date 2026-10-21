import { HttpError, asString, isRecord, readJson } from "@/server/http";
import { settlePayment } from "@/server/paystack";
import { apiPost } from "@/server/route";
import { holdCookie } from "@/server/session-token";

export const POST = apiPost(async (request) => {
  const body = await readJson(request);
  const reference = isRecord(body) ? asString(body.reference) : "";
  if (!reference) throw new HttpError(400, "That payment reference is not valid.");
  const result = await settlePayment(reference);
  const response = Response.json(result);
  if (result.status === "paid") {
    const secure = (process.env.APP_ORIGIN ?? "").startsWith("https://");
    response.headers.append(
      "set-cookie",
      `${holdCookie}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
  }
  return response;
});
