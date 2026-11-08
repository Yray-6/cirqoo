import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, getSql } from "@/server/db";
import { asDate } from "@/server/time";
import { HttpError, validEmail } from "@/server/http";
import {
  acceptablePassword,
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "@/server/password";
import { users } from "@/server/schema";
import {
  claimsFor,
  sessionCookie,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionRole,
} from "@/server/session-token";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: SessionRole;
  disabled: boolean;
  mustChangePassword: boolean;
};

async function userById(id: string) {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function currentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const user = await userById(claims.sub);
  if (!user || user.disabled) return null;
  if (user.role !== "admin" && user.role !== "staff") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    disabled: user.disabled,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function requireUser(options?: { allowPasswordChange?: boolean }) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in required.");
  if (user.mustChangePassword && !options?.allowPasswordChange) {
    throw new HttpError(403, "Change your password before continuing.");
  }
  return user;
}

export async function requireAdmin(options?: { allowPasswordChange?: boolean }) {
  const user = await requireUser(options);
  if (user.role !== "admin") throw new HttpError(403, "That page is for admins.");
  return user;
}

export async function sessionTokenFor(user: CurrentUser) {
  return signSession(claimsFor(user));
}

const lockMs = 15 * 60 * 1000;

export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!validEmail(normalized) || !password) {
    throw new HttpError(401, "Email or password is wrong.");
  }
  const sql = getSql();
  const throttle = await sql<{ failed_attempts: number; locked_until: Date | null }[]>`
    SELECT failed_attempts, locked_until FROM login_throttle WHERE email = ${normalized}
  `;
  const lockedUntil = asDate(throttle[0]?.locked_until);
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
  }

  const rows = await getDb().select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = rows[0];
  const hash = user?.passwordHash ?? (await dummyPasswordHash());
  const matches = await verifyPassword(password, hash);
  const allowed = Boolean(user && !user.disabled && matches);
  if (!allowed) {
    const attempts = (throttle[0]?.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + lockMs) : null;
    await sql`
      INSERT INTO login_throttle (email, failed_attempts, locked_until)
      VALUES (${normalized}, ${lockedUntil ? 0 : attempts}, ${lockedUntil ? lockedUntil.toISOString() : null})
      ON CONFLICT (email) DO UPDATE
      SET failed_attempts = EXCLUDED.failed_attempts, locked_until = EXCLUDED.locked_until
    `;
    if (lockedUntil) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
    throw new HttpError(401, "Email or password is wrong.");
  }

  await sql`DELETE FROM login_throttle WHERE email = ${normalized}`;
  const current: CurrentUser = {
    id: user!.id,
    name: user!.name,
    email: user!.email,
    role: user!.role as SessionRole,
    disabled: false,
    mustChangePassword: user!.mustChangePassword,
  };
  return { user: current, token: await sessionTokenFor(current) };
}

export async function updateOwnName(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new HttpError(400, "Enter your name.");
  await getDb().update(users).set({ name: trimmed }).where(eq(users.id, userId));
}

export async function changeOwnPassword(user: CurrentUser, currentPassword: string, nextPassword: string) {
  if (!acceptablePassword(nextPassword)) {
    throw new HttpError(400, "Use a password of 10 to 200 characters.");
  }
  if (nextPassword === currentPassword) {
    throw new HttpError(400, "Choose a different password.");
  }
  const rows = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
  const row = rows[0];
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new HttpError(401, "The current password is wrong.");
  }
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(nextPassword), mustChangePassword: false })
    .where(eq(users.id, user.id));
  return sessionTokenFor({ ...user, mustChangePassword: false });
}

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: SessionRole;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 80) throw new HttpError(400, "Enter a name.");
  if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!acceptablePassword(input.password)) {
    throw new HttpError(400, "Use a temporary password of 10 to 200 characters.");
  }
  if (input.role !== "admin" && input.role !== "staff") {
    throw new HttpError(400, "Choose admin or staff.");
  }
  try {
    await getDb()
      .insert(users)
      .values({
        id: randomUUID(),
        name,
        email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        disabled: false,
        mustChangePassword: true,
      });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") throw new HttpError(409, "That email is already used.");
    throw error;
  }
}

export async function resetStaffPassword(id: string, password: string) {
  if (!acceptablePassword(password)) {
    throw new HttpError(400, "Use a temporary password of 10 to 200 characters.");
  }
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "That account was not found.");
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
    .where(eq(users.id, id));
}

export async function disableStaff(actorId: string, id: string) {
  const sql = getSql();
  const rows = await sql<{ id: string; role: string; disabled: boolean }[]>`
    SELECT id, role, disabled FROM users WHERE id = ${id}
  `;
  const target = rows[0];
  if (!target) throw new HttpError(404, "That account was not found.");
  if (target.disabled) return;
  if (target.role === "admin") {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin' AND disabled = false AND id <> ${id}
    `;
    if (count === "0") throw new HttpError(409, "The last admin cannot be disabled.");
  }
  if (actorId === id) throw new HttpError(409, "Ask another admin to disable this account.");
  await getDb().update(users).set({ disabled: true }).where(eq(users.id, id));
}

export function applySessionCookie(response: Response, token: string) {
  const options = sessionCookieOptions();
  response.headers.append(
    "set-cookie",
    `${sessionCookie}=${token}; HttpOnly; Path=${options.path}; Max-Age=${options.maxAge}; SameSite=Lax${
      options.secure ? "; Secure" : ""
    }`,
  );
}

export { sessionCookie, sessionCookieOptions };
