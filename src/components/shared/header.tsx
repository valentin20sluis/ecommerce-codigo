"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { MoonIcon, SearchIcon, SunIcon, UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { CartDrawer } from "@/modules/cart/components/cart-drawer";
import { SearchResultsDropdown } from "@/modules/products/components/storefront/search-results-dropdown";

const noopSubscribe = () => () => {};

/**
 * `true` solo después del commit en cliente, sin `setState` en un efecto (evita la
 * regla `react-hooks/set-state-in-effect`): el snapshot de servidor siempre es `false`.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Evita el mismatch de hidratación: `resolvedTheme` no existe en el primer render del servidor. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Cambiar tema" disabled>
        <SunIcon />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

export function Header() {
  const router = useRouter();
  // No lee la URL (evita `useSearchParams`, que forzaría un Suspense en todo el
  // layout y rompería el ISR estático del home, 005 AC7): siempre navega "fresco"
  // a /products, sin intentar preservar filtros de categoría/precio activos ahí.
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const term = debouncedSearch.trim();

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFocused(false);
    const value = search.trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/products${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
      <Link href="/" className="shrink-0 font-semibold tracking-tight">
        E-commerce Tech
      </Link>

      <form onSubmit={submitSearch} className="relative hidden max-w-md flex-1 sm:block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setFocused(true)}
          // El delay deja que el click de una fila del dropdown registre antes de
          // que el blur la desmonte (007 Notas, mismo patrón que el mock original).
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Buscar productos..."
          className="pl-9"
          aria-label="Buscar productos"
        />
        {focused && term.length > 0 && (
          <SearchResultsDropdown term={term} onNavigate={() => setFocused(false)} />
        )}
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <CartDrawer />
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost" size="sm">
              Iniciar sesión
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button size="sm">Crear cuenta</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link label="Mi perfil" labelIcon={<UserIcon className="size-4" />} href="/profile" />
            </UserButton.MenuItems>
          </UserButton>
        </Show>
      </div>
    </header>
  );
}
