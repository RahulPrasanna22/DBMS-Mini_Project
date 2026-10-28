import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signSession, COOKIE_NAME } from "@/lib/session";

export async function POST(request) {
  const { username, password } = await request.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const result = await query(
    "SELECT user_id, username, password_hash, role, supplier_id FROM users WHERE username = $1",
    [username]
  );
  const user = result.rows[0];

  let ok = false;
  if (user) {
    try {
      ok = await bcrypt.compare(password, user.password_hash);
    } catch {
      ok = false; // e.g. the placeholder hash is not a valid bcrypt hash
    }
  }
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await signSession({
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    supplier_id: user.supplier_id,
  });

  const res = NextResponse.json({ username: user.username, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,                                // JavaScript cannot read it
    secure: process.env.NODE_ENV === "production", // HTTPS only when deployed
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}