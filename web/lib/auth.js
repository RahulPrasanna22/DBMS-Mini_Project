import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/session";

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Use in a route handler:
//   const { session, error } = await requireRole("ADMIN", "MANAGER");
//   if (error) return error;
export async function requireRole(...roles) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not logged in" }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden for your role" }, { status: 403 }) };
  }
  return { session };
}