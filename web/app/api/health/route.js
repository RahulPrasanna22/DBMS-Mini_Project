import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";



export async function GET() {
  const result = { postgres: null, mongo: null };
  let ok = true;

  try {
    const r = await query("SELECT now() AS now");
    result.postgres = { ok: true, time: r.rows[0].now };
  } catch (e) {
    ok = false;
    result.postgres = { ok: false, error: e.message };
  }

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    result.mongo = { ok: true };
  } catch (e) {
    ok = false;
    result.mongo = { ok: false, error: e.message };
  }

  return NextResponse.json(result, { status: ok ? 200 : 500 });
}