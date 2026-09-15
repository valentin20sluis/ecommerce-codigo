import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Marcas diacríticas combinantes que deja `normalize("NFD")`. */
const COMBINING_MARKS = /[̀-ͯ]/g

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const priceFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Los precios viajan siempre en centavos enteros; el formateo es solo de presentación. */
export function formatPriceFromCents(cents: number): string {
  return priceFormatter.format(cents / 100)
}

/**
 * "19.99" → 1999. `parseFloat(x) * 100` da 1998.9999…: el `Math.round` es
 * obligatorio, no cosmético. Devuelve `NaN` si el texto no es un número.
 */
export function toCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN
}

/** Normaliza a `[a-z0-9]` separado por guiones simples: "Audio & Vídeo" → "audio-video". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
