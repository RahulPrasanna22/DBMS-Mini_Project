import { NextResponse } from "next/server";

// MongoDB errors -> HTTP responses, like lib/dberror.js does for PostgreSQL.
// Code 121 = the document broke the collection's $jsonSchema validator,
// so the validation happened inside MongoDB, not in our code.
export function mongoErrorResponse(e) {
  if (e?.code === 121) {
    const rules = e.errInfo?.details?.schemaRulesNotSatisfied;
    return NextResponse.json(
      {
        error: "MongoDB schema validation failed: document rejected by the collection validator",
        detail: rules ? JSON.stringify(rules).slice(0, 400) : null,
      },
      { status: 400 }
    );
  }
  if (e?.code === 11000) {
    return NextResponse.json(
      { error: "MongoDB duplicate key", detail: e.message },
      { status: 400 }
    );
  }
  console.error(e);
  return NextResponse.json(
    { error: "MongoDB is unreachable or returned an error", detail: e?.message ?? null },
    { status: 503 }
  );
}
