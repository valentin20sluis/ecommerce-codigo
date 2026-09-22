import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { inArray, sql } from "drizzle-orm";

import { closePool, dbTx, type Executor } from "@/server/db/pool";
import { categories, products } from "@/server/db/schema";
import { recordInitialMovement } from "@/server/services/inventory.service";

/**
 * Catálogo de demostración para la landing (005 D7, T12): reutiliza las 8 fotos
 * reales aprobadas en la fase de diseño, ya copiadas a `public/products/`. Script
 * aparte de `seed.ts` (RBAC/usuarios) e idempotente por `slug`: correrlo dos veces
 * no duplica filas, solo actualiza los campos declarados aquí. El `stock` queda
 * fuera de esa actualización a propósito: desde 014 solo lo mueve el kardex.
 */
const CATEGORIES = [
  { slug: "laptops", name: "Laptops", description: "Portátiles para trabajo y creación." },
  { slug: "tablets", name: "Tablets", description: "Pantallas táctiles para todo el día." },
  { slug: "audio", name: "Audio", description: "Auriculares y sonido de alta fidelidad." },
  { slug: "wearables", name: "Wearables", description: "Relojes y bandas inteligentes." },
  { slug: "accesorios", name: "Accesorios", description: "Periféricos y complementos." },
  { slug: "smart-home", name: "Smart Home", description: "Hogar conectado." },
  { slug: "fotografia", name: "Fotografía", description: "Cámaras y equipo fotográfico." },
] as const;

type CategorySlug = (typeof CATEGORIES)[number]["slug"];

const PRODUCTS: Array<{
  slug: string;
  name: string;
  description: string;
  categorySlug: CategorySlug;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  imageUrl: string;
}> = [
  {
    slug: "ultrabook-x1",
    name: "UltraBook X1 14”",
    description: "Potencia real para tu día a día, en un chasis de menos de 1.2 kg.",
    categorySlug: "laptops",
    priceCents: 129900,
    compareAtPriceCents: null,
    stock: 12,
    imageUrl: "/products/laptop.jpg",
  },
  {
    slug: "tabair-11",
    name: "TabAir 11”",
    description: "Pantalla de 11 pulgadas, ligera y con batería de dos días.",
    categorySlug: "tablets",
    priceCents: 49900,
    compareAtPriceCents: null,
    stock: 18,
    imageUrl: "/products/tablet.jpg",
  },
  {
    slug: "sonicwave-pro",
    name: "SonicWave Pro",
    description: "Cancelación de ruido activa, todo el día de batería.",
    categorySlug: "audio",
    priceCents: 24900,
    compareAtPriceCents: 29900,
    stock: 30,
    imageUrl: "/products/audio-headphones.jpg",
  },
  {
    slug: "pulsefit-watch",
    name: "PulseFit Watch",
    description: "Monitoreo de salud continuo con resistencia al agua.",
    categorySlug: "wearables",
    priceCents: 18900,
    compareAtPriceCents: 22900,
    stock: 20,
    imageUrl: "/products/wearable-watch.jpg",
  },
  {
    slug: "typemech-keyboard",
    name: "TypeMech Keyboard",
    description: "Switches mecánicos silenciosos, retroiluminación por tecla.",
    categorySlug: "accesorios",
    priceCents: 8900,
    compareAtPriceCents: null,
    stock: 40,
    imageUrl: "/products/keyboard.jpg",
  },
  {
    slug: "rapidclick-mouse",
    name: "RapidClick Mouse",
    description: "Sensor de alta precisión para trabajo y gaming.",
    categorySlug: "accesorios",
    priceCents: 5900,
    compareAtPriceCents: 7900,
    stock: 50,
    imageUrl: "/products/gaming-mouse.jpg",
  },
  {
    slug: "echohome-mini",
    name: "EchoHome Mini",
    description: "Altavoz inteligente compacto para cualquier habitación.",
    categorySlug: "smart-home",
    priceCents: 6900,
    compareAtPriceCents: null,
    stock: 25,
    imageUrl: "/products/smart-speaker.jpg",
  },
  {
    slug: "capturex-mirrorless",
    name: "CaptureX Mirrorless",
    description: "Sensor APS-C, video 4K y enfoque automático rápido.",
    categorySlug: "fotografia",
    priceCents: 89900,
    compareAtPriceCents: 99900,
    stock: 8,
    imageUrl: "/products/camera.jpg",
  },

  // Ampliación de catálogo (4 productos nuevos por categoría, con fotos de
  // stock con licencia libre descargadas de Wikimedia Commons).
  {
    slug: "featherbook-air-13",
    name: "FeatherBook Air 13”",
    description: "Ultraligera a menos de 1 kg, ideal para llevarla a todos lados.",
    categorySlug: "laptops",
    priceCents: 109900,
    compareAtPriceCents: null,
    stock: 15,
    imageUrl: "/products/featherbook-air-13.jpg",
  },
  {
    slug: "probook-creator-16",
    name: "ProBook Creator 16”",
    description: "Pantalla grande y potencia para edición de video y diseño.",
    categorySlug: "laptops",
    priceCents: 179900,
    compareAtPriceCents: 199900,
    stock: 6,
    imageUrl: "/products/probook-creator-16.jpg",
  },
  {
    slug: "gamerx-strike-15",
    name: "GamerX Strike 15”",
    description: "Teclado RGB y gráfica dedicada para el gaming más exigente.",
    categorySlug: "laptops",
    priceCents: 159900,
    compareAtPriceCents: null,
    stock: 10,
    imageUrl: "/products/gamerx-strike-15.jpg",
  },
  {
    slug: "convertiflex-2in1",
    name: "ConvertiFlex 2-en-1",
    description: "Bisagra de 360° para usarla como laptop o como tablet.",
    categorySlug: "laptops",
    priceCents: 134900,
    compareAtPriceCents: null,
    stock: 9,
    imageUrl: "/products/convertiflex-2in1.jpg",
  },
  {
    slug: "tabpro-12-ultra",
    name: "TabPro 12 Ultra",
    description: "Pantalla de 12” con colores vibrantes para creativos y streaming.",
    categorySlug: "tablets",
    priceCents: 79900,
    compareAtPriceCents: 89900,
    stock: 10,
    imageUrl: "/products/tabpro-12-ultra.jpg",
  },
  {
    slug: "tabmini-8",
    name: "TabMini 8”",
    description: "Compacta y ligera, perfecta para leer y navegar con una mano.",
    categorySlug: "tablets",
    priceCents: 34900,
    compareAtPriceCents: null,
    stock: 20,
    imageUrl: "/products/tabmini-8.jpg",
  },
  {
    slug: "tabhome-10",
    name: "TabHome 10”",
    description: "Tablet familiar para streaming, videollamadas y uso diario en casa.",
    categorySlug: "tablets",
    priceCents: 39900,
    compareAtPriceCents: null,
    stock: 16,
    imageUrl: "/products/tabhome-10.jpg",
  },
  {
    slug: "tabnote-11-stylus",
    name: "TabNote 11” con lápiz",
    description: "Incluye lápiz óptico para tomar notas y dibujar con precisión.",
    categorySlug: "tablets",
    priceCents: 59900,
    compareAtPriceCents: 64900,
    stock: 12,
    imageUrl: "/products/tabnote-11-stylus.jpg",
  },
  {
    slug: "bassline-earbuds-tws",
    name: "BassLine TWS Earbuds",
    description: "Inalámbricos con estuche de carga y graves potentes.",
    categorySlug: "audio",
    priceCents: 14900,
    compareAtPriceCents: null,
    stock: 35,
    imageUrl: "/products/bassline-earbuds-tws.jpg",
  },
  {
    slug: "studiomax-over-ear",
    name: "StudioMax Over-Ear",
    description: "Sonido de estudio con almohadillas acolchadas para uso prolongado.",
    categorySlug: "audio",
    priceCents: 22900,
    compareAtPriceCents: null,
    stock: 18,
    imageUrl: "/products/studiomax-over-ear.jpg",
  },
  {
    slug: "partyboom-speaker-xl",
    name: "PartyBoom Speaker XL",
    description: "Parlante portátil resistente al agua, ideal para reuniones al aire libre.",
    categorySlug: "audio",
    priceCents: 19900,
    compareAtPriceCents: 23900,
    stock: 22,
    imageUrl: "/products/partyboom-speaker-xl.jpg",
  },
  {
    slug: "clearvoice-mic-usb",
    name: "ClearVoice USB Mic",
    description: "Micrófono de condensador USB para streaming y podcasts.",
    categorySlug: "audio",
    priceCents: 12900,
    compareAtPriceCents: null,
    stock: 25,
    imageUrl: "/products/clearvoice-mic-usb.jpg",
  },
  {
    slug: "fitband-lite",
    name: "FitBand Lite",
    description: "Banda de actividad económica con monitoreo de pasos y sueño.",
    categorySlug: "wearables",
    priceCents: 8900,
    compareAtPriceCents: null,
    stock: 40,
    imageUrl: "/products/fitband-lite.jpg",
  },
  {
    slug: "smartring-pulse",
    name: "SmartRing Pulse",
    description: "Anillo inteligente que mide el descanso y la frecuencia cardiaca.",
    categorySlug: "wearables",
    priceCents: 29900,
    compareAtPriceCents: null,
    stock: 14,
    imageUrl: "/products/smartring-pulse.jpg",
  },
  {
    slug: "lumewatch-smart",
    name: "LumeWatch Smart",
    description: "Smartwatch premium con notificaciones y control de apps del día a día.",
    categorySlug: "wearables",
    priceCents: 27900,
    compareAtPriceCents: 32900,
    stock: 12,
    imageUrl: "/products/lumewatch-smart.jpg",
  },
  {
    slug: "runpro-gps-watch",
    name: "RunPro GPS Watch",
    description: "Reloj deportivo con GPS integrado para corredores y ciclistas.",
    categorySlug: "wearables",
    priceCents: 24900,
    compareAtPriceCents: null,
    stock: 15,
    imageUrl: "/products/runpro-gps-watch.jpg",
  },
  {
    slug: "hublink-usb-c-7in1",
    name: "HubLink USB-C 7-en-1",
    description: "Hub multipuerto con HDMI, USB y lector de tarjetas en un solo cable.",
    categorySlug: "accesorios",
    priceCents: 8900,
    compareAtPriceCents: null,
    stock: 30,
    imageUrl: "/products/hublink-usb-c-7in1.jpg",
  },
  {
    slug: "powerbank-20k",
    name: "PowerBank 20000mAh",
    description: "Batería portátil de alta capacidad para varias cargas completas.",
    categorySlug: "accesorios",
    priceCents: 7900,
    compareAtPriceCents: 9900,
    stock: 45,
    imageUrl: "/products/powerbank-20k.jpg",
  },
  {
    slug: "webcam-fullhd-pro",
    name: "WebCam FullHD Pro",
    description: "Cámara web con clip universal, ideal para videollamadas y streaming.",
    categorySlug: "accesorios",
    priceCents: 6900,
    compareAtPriceCents: null,
    stock: 32,
    imageUrl: "/products/webcam-fullhd-pro.jpg",
  },
  {
    slug: "deskpad-xl",
    name: "DeskPad XL",
    description: "Mousepad extendido que cubre todo el escritorio.",
    categorySlug: "accesorios",
    priceCents: 3900,
    compareAtPriceCents: null,
    stock: 50,
    imageUrl: "/products/deskpad-xl.jpg",
  },
  {
    slug: "smartbulb-color-pack",
    name: "SmartBulb Color Pack x2",
    description: "Pack de dos focos LED inteligentes con millones de colores.",
    categorySlug: "smart-home",
    priceCents: 9900,
    compareAtPriceCents: null,
    stock: 28,
    imageUrl: "/products/smartbulb-color-pack.jpg",
  },
  {
    slug: "plugsmart-wifi",
    name: "PlugSmart WiFi",
    description: "Enchufe inteligente que se controla desde el celular.",
    categorySlug: "smart-home",
    priceCents: 4900,
    compareAtPriceCents: null,
    stock: 38,
    imageUrl: "/products/plugsmart-wifi.jpg",
  },
  {
    slug: "camguard-indoor",
    name: "CamGuard Indoor",
    description: "Cámara de seguridad interior con visión nocturna.",
    categorySlug: "smart-home",
    priceCents: 11900,
    compareAtPriceCents: 13900,
    stock: 20,
    imageUrl: "/products/camguard-indoor.jpg",
  },
  {
    slug: "thermosense-thermostat",
    name: "ThermoSense Thermostat",
    description: "Termostato inteligente que aprende tus horarios y ahorra energía.",
    categorySlug: "smart-home",
    priceCents: 34900,
    compareAtPriceCents: null,
    stock: 10,
    imageUrl: "/products/thermosense-thermostat.jpg",
  },
  {
    slug: "dronecam-4k-fold",
    name: "DroneCam 4K Fold",
    description: "Dron plegable con cámara 4K, fácil de llevar de viaje.",
    categorySlug: "fotografia",
    priceCents: 149900,
    compareAtPriceCents: 169900,
    stock: 7,
    imageUrl: "/products/dronecam-4k-fold.jpg",
  },
  {
    slug: "gimbalpro-stabilizer",
    name: "GimbalPro Stabilizer",
    description: "Estabilizador de 3 ejes para video fluido con cámara o celular.",
    categorySlug: "fotografia",
    priceCents: 39900,
    compareAtPriceCents: null,
    stock: 11,
    imageUrl: "/products/gimbalpro-stabilizer.jpg",
  },
  {
    slug: "tripodflex-travel",
    name: "TripodFlex Travel",
    description: "Trípode de viaje en fibra de carbono, compacto y resistente.",
    categorySlug: "fotografia",
    priceCents: 19900,
    compareAtPriceCents: null,
    stock: 16,
    imageUrl: "/products/tripodflex-travel.jpg",
  },
  {
    slug: "instantcam-retro",
    name: "InstantCam Retro",
    description: "Cámara instantánea de estilo retro, imprime la foto al momento.",
    categorySlug: "fotografia",
    priceCents: 29900,
    compareAtPriceCents: 34900,
    stock: 13,
    imageUrl: "/products/instantcam-retro.jpg",
  },
];

async function seedCategories(tx: Executor): Promise<Map<CategorySlug, string>> {
  await tx
    .insert(categories)
    .values(CATEGORIES.map((category) => ({ ...category, isActive: true })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const rows = await tx
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(
      inArray(
        categories.slug,
        CATEGORIES.map((category) => category.slug),
      ),
    );

  return new Map(rows.map((row) => [row.slug as CategorySlug, row.id]));
}

/**
 * Siembra el catálogo sin romper el kardex de 014: el stock solo nace con su
 * movimiento `initial`, y el de un producto que ya existe no se toca —el UPSERT
 * lo reescribiría sin dejar rastro y descuadraría `sum(qty_delta)` (AC6)—.
 */
async function seedProducts(tx: Executor, categoryIds: Map<CategorySlug, string>): Promise<number> {
  const values = PRODUCTS.map((product) => {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Categoría "${product.categorySlug}" no sembrada: revisa CATEGORIES.`);
    }

    return {
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId,
      priceCents: product.priceCents,
      compareAtPriceCents: product.compareAtPriceCents,
      stock: product.stock,
      isActive: true,
      imageUrl: product.imageUrl,
    };
  });

  // Slugs ya presentes antes del UPSERT: su stock vive en el kardex y este
  // script no lo mueve, así que tampoco les emite un `initial` duplicado.
  const existing = await tx
    .select({ slug: products.slug })
    .from(products)
    .where(
      inArray(
        products.slug,
        values.map((value) => value.slug),
      ),
    );

  const alreadySeeded = new Set(existing.map((row) => row.slug));

  const rows = await tx
    .insert(products)
    .values(values)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        categoryId: sql`excluded.category_id`,
        priceCents: sql`excluded.price_cents`,
        compareAtPriceCents: sql`excluded.compare_at_price_cents`,
        isActive: true,
        imageUrl: sql`excluded.image_url`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: products.id, slug: products.slug, stock: products.stock });

  for (const row of rows) {
    if (alreadySeeded.has(row.slug)) continue;

    // Mismo camino que el alta de producto del panel: con stock 0 no hay
    // movimiento, porque el CHECK de la tabla exige `qty_delta <> 0`.
    await recordInitialMovement(tx, row.id, row.stock, null);
  }

  return values.length;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Configúrala en .env.local antes de sembrar.");
  }

  const summary = await dbTx.transaction(async (tx) => {
    const categoryIds = await seedCategories(tx);
    const productCount = await seedProducts(tx, categoryIds);

    return { categories: categoryIds.size, products: productCount };
  });

  console.log(`Categorías sembradas: ${summary.categories}`);
  console.log(`Productos sembrados: ${summary.products}`);
  console.log("Seed de catálogo completado.");
}

main()
  .catch((error) => {
    console.error("Seed de catálogo fallido:", error);
    process.exitCode = 1;
  })
  .finally(closePool);
