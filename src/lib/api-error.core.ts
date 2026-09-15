import { ZodError } from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ErrorResponseBody = {
  error: {
    code: ErrorCode;
    message: string;
    details: unknown;
  };
};

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details: unknown = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Solicitud inválida.", details: unknown = null) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autenticado.", details: unknown = null) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No autorizado.", details: unknown = null) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado.", details: unknown = null) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "La operación entra en conflicto con el estado actual.", details: unknown = null) {
    super(409, "CONFLICT", message, details);
  }
}

export type ErrorPayload = {
  status: number;
  body: ErrorResponseBody;
};

/**
 * Decide status/código/mensaje para cualquier error. Separado de `toErrorResponse`
 * (en `api-error.ts`) para que esta decisión sea testeable sin `next/server`.
 */
export function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos.",
          details: error.issues,
        },
      },
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }

  // El detalle interno no viaja al cliente, pero no se pierde.
  console.error("[api] error no controlado", error);

  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado.", details: null } },
  };
}
