import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ErrorEnvelope = {
  error?: { code?: string; message?: string; details?: unknown };
};

/** Traduce el envelope de `src/lib/api-error.ts` a un Error con mensaje mostrable. */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const envelope = error.response?.data as ErrorEnvelope | undefined;

      throw new ApiError(
        error.response?.status ?? 0,
        envelope?.error?.code ?? "NETWORK_ERROR",
        envelope?.error?.message ?? "No se pudo contactar al servidor.",
        envelope?.error?.details ?? null,
      );
    }

    throw error;
  },
);
