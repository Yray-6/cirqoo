const required = ["DATABASE_URL", "SESSION_SECRET", "APP_ORIGIN"] as const;

export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment: ${missing.join(", ")}.`);
  }
  if ((process.env.SESSION_SECRET ?? "").length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
}

export function appOrigin() {
  return (process.env.APP_ORIGIN ?? "").replace(/\/$/, "");
}

export function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is missing.");
  return url;
}

export function migrationUrl() {
  return process.env.DATABASE_URL_UNPOOLED?.trim() || databaseUrl();
}

export function poolMax() {
  if (process.env.VERCEL || databaseUrl().includes("-pooler")) return 1;
  return 10;
}
