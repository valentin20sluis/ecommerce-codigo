import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";

import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  toErrorPayload,
} from "./api-error.core.ts";

describe("AppError subclasses", () => {
  it("sets the fixed status and code for each error type", () => {
    assert.equal(new BadRequestError().status, 400);
    assert.equal(new BadRequestError().code, "BAD_REQUEST");
    assert.equal(new NotFoundError().status, 404);
    assert.equal(new NotFoundError().code, "NOT_FOUND");
  });

  it("uses the default message when none is given", () => {
    assert.equal(new NotFoundError().message, "Recurso no encontrado.");
  });

  it("is an instance of AppError", () => {
    assert.ok(new ConflictError() instanceof AppError);
  });
});

describe("toErrorPayload", () => {
  it("maps a ZodError to a 400 VALIDATION_ERROR with the zod issues as details", () => {
    const zodError = new ZodError([{ code: "custom", message: "bad", path: ["x"] }]);

    const payload = toErrorPayload(zodError);

    assert.equal(payload.status, 400);
    assert.equal(payload.body.error.code, "VALIDATION_ERROR");
    assert.deepEqual(payload.body.error.details, zodError.issues);
  });

  it("maps an AppError to its own status/code/message/details", () => {
    const payload = toErrorPayload(new ConflictError("dup"));

    assert.deepEqual(payload, {
      status: 409,
      body: { error: { code: "CONFLICT", message: "dup", details: null } },
    });
  });

  it("maps an unknown error to a generic 500 INTERNAL_ERROR without leaking details", () => {
    const payload = toErrorPayload(new Error("boom"));

    assert.deepEqual(payload, {
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado.", details: null } },
    });
  });
});
