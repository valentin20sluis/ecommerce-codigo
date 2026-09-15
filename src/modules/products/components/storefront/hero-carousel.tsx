"use client";

import { motion } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";

import { cn, formatPriceFromCents } from "@/lib/utils";
import { AddToCartControl } from "@/modules/products/components/storefront/add-to-cart-control";
import type { StorefrontProduct } from "@/modules/products/components/storefront/product-card";
import { ProductImage } from "@/modules/products/components/storefront/product-image";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-40";

function HeroSlide({ product }: { product: StorefrontProduct }) {
  const discount = product.compareAtPriceCents
    ? Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100)
    : null;

  return (
    <div className="grid min-h-[360px] grid-cols-1 items-center gap-6 p-8 sm:grid-cols-2 sm:p-12">
      <div className="flex flex-col gap-4">
        {discount && (
          <span className="inline-flex w-fit items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
            -{discount}% de descuento
          </span>
        )}
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{product.name}</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatPriceFromCents(product.priceCents)}</span>
          {product.compareAtPriceCents && (
            <span className="text-base text-muted-foreground line-through">
              {formatPriceFromCents(product.compareAtPriceCents)}
            </span>
          )}
        </div>
        <div className="w-fit">
          <AddToCartControl product={product} size="default" />
        </div>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-background">
        {product.imageUrl && (
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 640px) 40vw, 90vw"
            className="object-cover"
            priority
          />
        )}
      </div>
    </div>
  );
}

/** Recibe las ofertas ya resueltas por el Server Component del home (005 T20): sin fetch propio. */
export function HeroCarousel({ products }: { products: StorefrontProduct[] }) {
  if (products.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-muted"
    >
      <Swiper
        modules={[Autoplay, Navigation]}
        autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
        navigation={{ prevEl: ".hero-carousel-prev", nextEl: ".hero-carousel-next" }}
        loop={products.length > 1}
      >
        {products.map((product) => (
          <SwiperSlide key={product.id}>
            <HeroSlide product={product} />
          </SwiperSlide>
        ))}
      </Swiper>

      {products.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Oferta anterior"
            className={cn(NAV_BUTTON_CLASS, "hero-carousel-prev left-4")}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Oferta siguiente"
            className={cn(NAV_BUTTON_CLASS, "hero-carousel-next right-4")}
          >
            <ChevronRightIcon />
          </button>
        </>
      )}
    </motion.section>
  );
}
