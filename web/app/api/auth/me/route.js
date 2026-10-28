import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.json({
    user_id: session.user_id,
    username: session.username,
    role: session.role,
    supplier_id: session.supplier_id,
  });
}