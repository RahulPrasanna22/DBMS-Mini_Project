import { NextResponse } from "next/server";

// PostgreSQL errors (CHECK, UNIQUE, triggers, RAISE EXCEPTION in procedures)
// carry a 5-character SQLSTATE code. We return the database's own message
// as HTTP 400, so the UI shows that the DB did the validation.
export function dbErrorResponse(e) {
  if (e && typeof e.code === "string" && e.code.length === 5) {
    return NextResponse.json(
      { error: e.message, detail: e.detail ?? null },
      { status: 400 }
    );
  }
  console.error(e);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}