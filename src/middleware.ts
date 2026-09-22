import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { toErrorResponse, UnauthorizedError } from "@/lib/api-error";

const isPublicRoute = createRouteMatcher([
  "/",
  "/products(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/products(.*)",
  "/api/categories(.*)",
  // La firma Svix es la autenticación de esta ruta; Clerk no envía sesión.
  "/api/webhooks(.*)",
]);

const isApiRoute = createRouteMatcher(["/api(.*)"]);

/** El panel nunca puede volverse público por un descuido en `isPublicRoute`. */
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

/**
 * Excepción acotada de la Enmienda 1 (docs/specs/002-categories-crud.md §12, D16),
 * ampliada a productos por docs/specs/003-products-crud.md (D1, D6): solo categorías
 * y productos quedan sin autenticación. Las rutas se listan con el `/` explícito para
 * que un prefijo vecino como `/admin/categories-internas` o `/api/admin/productsX` no
 * herede la exención. Configuración de desarrollo local; ver los planes de cierre.
 *
 * `/admin/inventory` y `/api/admin/inventory` quedan deliberadamente fuera de esta
 * lista (014 T16): mueven stock y exigen sesión en el borde, más `inventory.read` /
 * `inventory.adjust` por código en cada handler.
 */
const isUnauthenticatedRoute = createRouteMatcher([
  "/admin/categories",
  "/admin/categories/(.*)",
  "/api/admin/categories",
  "/api/admin/categories/(.*)",
  "/admin/products",
  "/admin/products/(.*)",
  "/api/admin/products",
  "/api/admin/products/(.*)",
]);

/**
 * Capa 1: solo autenticación. El borde no puede consultar Postgres, así que la
 * autorización por permiso vive íntegra en la capa 2 (`requirePermission`).
 */
export default clerkMiddleware(async (auth, req) => {
  if (isUnauthenticatedRoute(req)) return;

  if (isPublicRoute(req) && !isAdminRoute(req)) return;

  const { userId, redirectToSignIn } = await auth();
  if (userId) return;

  if (isApiRoute(req)) return toErrorResponse(new UnauthorizedError());

  return redirectToSignIn();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
