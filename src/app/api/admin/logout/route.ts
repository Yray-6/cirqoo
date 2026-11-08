import { sessionCookie } from "@/server/session-token";
import { apiPost } from "@/server/route";

export const POST = apiPost(async () => {
  const response = Response.json({ ok: true });
  response.headers.append(
    "set-cookie",
    `${sessionCookie}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  );
  return response;
});
