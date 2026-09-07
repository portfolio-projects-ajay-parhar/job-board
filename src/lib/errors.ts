import { NextResponse } from "next/server";
import { ZodError } from "zod";

export { ApiError, AuthError } from "./api-error";
import { ApiError } from "./api-error";

/** Prisma unique-constraint violation → friendly 409. */
export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(409, message, "CONFLICT");
  }
}

/** Normalizes every thrown error to an `{ error: string }` response. */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: e.message, ...(e.code ? { code: e.code } : {}) },
      { status: e.status },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: e.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
    return NextResponse.json({ error: "Resource already exists", code: "CONFLICT" }, { status: 409 });
  }
  console.error("[api] unhandled error:", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
