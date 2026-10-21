import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookie, verifySession } from "@/server/session-token";

const staffPaths = ["/admin/scan", "/admin/profile"];

function isStaffPath(pathname: string) {
  return staffPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await verifySession(request.cookies.get(sessionCookie)?.value);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (pathname === "/api/admin/login") return NextResponse.next({ request: { headers: requestHeaders } });

  if (pathname.startsWith("/api/admin") && !claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (pathname === "/admin/login") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/admin") && !claims) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (claims?.mcp && pathname.startsWith("/admin") && !pathname.startsWith("/admin/profile")) {
    return NextResponse.redirect(new URL("/admin/profile", request.url));
  }

  if (claims?.role === "staff" && pathname.startsWith("/admin") && !isStaffPath(pathname)) {
    return NextResponse.redirect(new URL("/admin/scan", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
