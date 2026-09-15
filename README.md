# E-commerce Tech

Proyecto de e-commerce de tecnología en Next.js, con módulos de **cliente**
(storefront) y **administración**. Bootstrapeado con
[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Metodología: Spec-Driven Development (SDD)

Este proyecto se desarrolla con IA (Claude Code) bajo una metodología SDD
definida en [`CLAUDE.md`](./CLAUDE.md), que actúa como contrato de trabajo y se
lee en cada sesión de IA. La idea central: **el spec aprobado por un humano es
la fuente de verdad, no el criterio del modelo en el momento**.

### Flujo

```
Prompt del usuario
        │
        ▼
  ┌──────────────┐
  │ orchestrator │  clasifica: ¿SDD o BUILD?
  └──────┬───────┘
         │
   ┌─────┴──────────────────────────────┐
   │                                    │
 MODO: SDD                          MODO: BUILD
   │                                    │
   ▼                                    ▼
 spec ──► ⏸ APROBACIÓN HUMANA ──► developer ⇄ reviewer ──► done
                                                 (bucle, máx. 3)
```

- **`orchestrator`** clasifica cada petición como `SDD` (nueva feature de
  producto: requiere modelo de datos, contratos de API o UI nueva) o `BUILD`
  (tarea puntual: fix, infraestructura, tooling) antes de que se escriba una
  sola línea de código.
- **`spec`** convierte el requerimiento en un documento corto y ejecutable en
  `docs/specs/` (criterios de aceptación, modelo de datos, contratos de API,
  tareas atómicas) y **se detiene** a esperar aprobación humana explícita.
- **`developer`** solo implementa contra un spec en `status: approved`. Nunca
  contra un `draft`.
- **`reviewer`** audita la implementación contra el spec y la arquitectura de
  [`docs/SETUP.md`](./docs/SETUP.md). Si hay hallazgos bloqueantes, el trabajo
  vuelve a `developer` (máximo 3 vueltas; si no converge, se escala a un
  humano en lugar de seguir iterando indefinidamente).

### Reglas al usar IA como fuente de verdad del código

1. **Ningún código se escribe sobre un spec `draft`.** La aprobación humana es
   una puerta obligatoria, no un trámite: el spec pasa a `approved` solo
   cuando una persona lo confirma explícitamente.
2. **La IA no se autoaprueba ni se autoextiende el alcance.** Los agentes
   (`orchestrator`, `spec`, `developer`, `reviewer`) terminan su turno con un
   handoff explícito; es la sesión principal —dirigida por un humano— la que
   decide invocar al siguiente paso.
3. **El bucle developer ⇄ reviewer tiene un límite duro (3 iteraciones).** Si
   no converge, se detiene y se escala al usuario en vez de seguir generando
   código sin control.
4. **La arquitectura documentada manda sobre la preferencia del modelo.** Si
   una skill o el propio modelo sugiere una estructura distinta a
   `docs/SETUP.md`, gana `docs/SETUP.md`.
5. **Reglas duras de arquitectura son bloqueantes en review**, entre ellas:
   separación estricta de capas (componente → hook → service → route handler →
   repositorio → Drizzle), validación con Zod en todo Route Handler, permisos
   de admin verificados por código de permiso (no por comparación de rol en el
   código), y `audit_logs` append-only sin PII sensible.
6. **Antes de dar por cerrada una tarea se verifica, no se asume:**
   `npm run typecheck && npm run lint && npm run build` deben pasar.
7. **`docs/specs/` es documentación viva.** Cada feature construida deja su
   spec con contexto y decisiones técnicas; antes de proponer una feature
   nueva se revisa si ya existe un spec que la cubra.

El detalle completo de agentes, arquitectura, stack y skills está en
[`CLAUDE.md`](./CLAUDE.md) y [`docs/SETUP.md`](./docs/SETUP.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
