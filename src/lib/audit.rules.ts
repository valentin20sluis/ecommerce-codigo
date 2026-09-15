import type { AuditChanges } from "@/server/db/schema";

export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "card",
  "cvv",
] as const;

/** Prefijos de acción cuyo log es transaccional y bloqueante (SETUP §5.2 regla 4). */
const SECURITY_ACTION_PREFIXES = ["auth.", "role.", "permission.", "user.role"] as const;

const MAX_MASK_DEPTH = 8;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function maskSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_MASK_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => maskSensitive(item, depth + 1));
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  const masked: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    masked[key] = isSensitiveKey(key) ? REDACTED : maskSensitive(item, depth + 1);
  }

  return masked;
}

export function maskRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
  return value === null ? null : (maskSensitive(value) as Record<string, unknown>);
}

/** Deja en `changes` solo los campos que realmente cambiaron. */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChanges | null {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let changed = false;

  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    changedBefore[key] = before[key] ?? null;
    changedAfter[key] = after[key] ?? null;
    changed = true;
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}

export function isSecurityAction(action: string): boolean {
  return SECURITY_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}
