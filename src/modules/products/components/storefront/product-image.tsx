import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * `imageUrl` es texto libre del formulario admin (003 D3): puede ser una ruta local
 * servida desde `public/` (`/products/...`, optimizable con `next/image`) o
 * cualquier URL absoluta externa que el host no tiene por qué tener dada de alta en
 * `next.config.ts`. Un host externo no configurado hace que `next/image` responda
 * 500 (`Invalid src prop`, confirmado en runtime al probar el home con datos reales,
 * 005 T20) — para una URL externa se cae a un `<img>` plano, sin optimizar pero sin
 * poder romper la página. Siempre `fill`: los tres consumidores posicionan sobre un
 * contenedor `relative`.
 */
export function ProductImage({
  src,
  alt,
  className,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (src.startsWith("/")) {
    return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- host externo arbitrario, sin optimizar a propósito
    <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full object-cover", className)} />
  );
}
