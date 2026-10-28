import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/session";

// Pages that only certain roles may open
const PAGE_RULES = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/inventory", roles: ["ADMIN", "MANAGER"] },
  { prefix: "/alerts", roles: ["ADMIN", "MANAGER"] },
  { prefix: "/products/new", roles: ["ADMIN", "MANAGER"] },
];

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already logged in: skip the login page
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const rule = PAGE_RULES.find((r) => pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};