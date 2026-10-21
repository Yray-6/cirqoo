import { appOrigin } from "@/server/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== appOrigin()) {
    throw new HttpError(403, "This request was blocked.");
  }
}

export async function readJson(request: Request) {
  const text = await request.text();
  if (text.length > 20_000) throw new HttpError(400, "That request is too large.");
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Send the form as JSON.");
  }
}

export function asJson(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  console.error(code ? `request failed ${code}` : "request failed");
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}
