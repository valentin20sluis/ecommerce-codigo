import { NextResponse } from "next/server";

import { toErrorPayload, type ErrorResponseBody } from "./api-error.core";

export * from "./api-error.core";

export function toErrorResponse(error: unknown): NextResponse<ErrorResponseBody> {
  const { status, body } = toErrorPayload(error);
  return NextResponse.json<ErrorResponseBody>(body, { status });
}
