"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as Accordion from "@radix-ui/react-accordion";
import {
  ChevronDown,
  FileText,
  Gavel,
  LineChart,
  LogIn,
  Menu,
  Newspaper,
  Radio,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { mainNav, siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const CHILD_ICONS: Record<string, React.ElementType> = {
  "/academia/publicaciones": FileText,
  "/academia/observatorio-legislativo": Gavel,
  "/academia/observatorio-economico": LineChart,
  "/academia/boletines": Newspaper,
};

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 16);
  });

  const openWithIntent = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };

  const closeWithIntent = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 transition-colors duration-300 sm:pt-4"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          {/* Marca en móvil: solo el emblema. En escritorio va al centro de la barra. */}
          <Link
            href="/"
            aria-label={`${siteConfig.shortName} — Inicio`}
            className={cn(
              "flex shrink-0 items-center rounded-full border p-1.5 transition-all duration-300 md:hidden",
              scrolled
                ? "hairline-gold border-border/70 bg-surface/75 shadow-elev-2 backdrop-blur-2xl backdrop-saturate-150"
                : "border-transparent bg-surface/25 backdrop-blur-md",
            )}
          >
            <Image
              src="/logo-mark.png"
              alt=""
              width={96}
              height={96}
              priority
              className="size-11 shrink-0 object-contain"
            />
          </Link>

          {/* Bloque de navegación: separado visualmente de la marca */}
          <div
            className={cn(
              "relative hidden flex-1 items-center justify-between rounded-full border px-2 py-1.5 transition-all duration-300 md:flex",
              scrolled
                ? "hairline-gold border-border/70 bg-surface/75 shadow-elev-2 backdrop-blur-2xl backdrop-saturate-150"
                : "border-transparent bg-surface/25 backdrop-blur-md",
            )}
          >
            <nav
              aria-label="Navegación principal"
              className="flex flex-1 items-center justify-center"
            >
              {mainNav.map((item, index) => {
                const isActive = pathname === item.href;
                const hasChildren = !!item.children?.length;

                return (
                  <React.Fragment key={item.href}>
                    {/* Escudo: el emblema en un círculo que parte la barra en dos. */}
                    {index === Math.ceil(mainNav.length / 2) && (
                      <Link
                        href="/"
                        aria-label={`${siteConfig.shortName} — Inicio`}
                        className="relative z-10 -my-7 mx-3 flex size-[5.5rem] shrink-0 items-center justify-center rounded-full border-2 border-accent/70 bg-surface shadow-elev-2 ring-4 ring-surface/80 transition-transform duration-300 hover:scale-105"
                      >
                        <Image
                          src="/logo-mark.png"
                          alt=""
                          width={128}
                          height={128}
                          priority
                          className="size-16 object-contain"
                        />
                      </Link>
                    )}
                    <div
                      className="relative"
                      onMouseEnter={() =>
                        hasChildren && openWithIntent(item.label)
                      }
                      onMouseLeave={() => hasChildren && closeWithIntent()}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        aria-expanded={
                          hasChildren ? openMenu === item.label : undefined
                        }
                        onClick={(e) => {
                          if (hasChildren) {
                            e.preventDefault();
                            setOpenMenu((prev) =>
                              prev === item.label ? null : item.label,
                            );
                          }
                        }}
                        className={cn(
                          "group relative flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                          isActive && "text-foreground",
                        )}
                      >
                        {item.label}
                        {hasChildren && (
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              openMenu === item.label && "rotate-180",
                            )}
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={cn(
                            "absolute inset-x-3 -bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-brand to-accent transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100",
                            isActive && "scale-x-100",
                          )}
                          aria-hidden="true"
                        />
                      </Link>

                      <AnimatePresence>
                        {hasChildren && openMenu === item.label && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{
                              duration: 0.18,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="glass-panel absolute left-1/2 top-full z-10 mt-3 w-[26rem] -translate-x-1/2 overflow-hidden rounded-2xl p-2"
                          >
                            <ul className="grid grid-cols-2 gap-1">
                              {item.children!.map((child) => {
                                const Icon =
                                  CHILD_ICONS[child.href] ?? FileText;
                                return (
                                  <li key={child.href}>
                                    <Link
                                      href={child.href}
                                      onClick={() => setOpenMenu(null)}
                                      className="flex h-full flex-col gap-2 rounded-xl border border-transparent p-3 transition-colors duration-300 hover:border-border hover:bg-surface-muted/70"
                                    >
                                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                                        <Icon
                                          className="size-4"
                                          aria-hidden="true"
                                        />
                                      </span>
                                      <span className="text-sm font-semibold leading-tight text-foreground">
                                        {child.label}
                                      </span>
                                      <span className="text-xs leading-snug text-muted-foreground">
                                        {child.description}
                                      </span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </React.Fragment>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 pl-2">
              <Link
                href="/admin/login"
                aria-label="Acceso administrativo"
                title="Acceso administrativo"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <LogIn className="size-4" aria-hidden="true" />
              </Link>
              <ThemeToggle />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "border transition-all duration-300 md:hidden",
                    scrolled
                      ? "bg-surface/70 backdrop-blur-xl"
                      : "bg-surface/30 backdrop-blur-md",
                  )}
                  aria-label="Abrir menú de navegación"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </Dialog.Trigger>

              <AnimatePresence>
                {mobileOpen && (
                  <Dialog.Portal forceMount>
                    <Dialog.Overlay asChild>
                      <motion.div
                        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    </Dialog.Overlay>
                    <Dialog.Content asChild aria-describedby={undefined}>
                      <motion.div
                        className="fixed inset-x-4 top-4 z-50 max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl"
                        initial={{ opacity: 0, y: -16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="flex items-center justify-between">
                          <Dialog.Title className="text-sm font-semibold">
                            Menú
                          </Dialog.Title>
                          <Dialog.Close asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Cerrar menú"
                            >
                              <X aria-hidden="true" />
                            </Button>
                          </Dialog.Close>
                        </div>

                        <Accordion.Root
                          type="single"
                          collapsible
                          className="mt-6 flex flex-col gap-1"
                        >
                          {mainNav.map((item) =>
                            item.children ? (
                              <Accordion.Item
                                key={item.href}
                                value={item.href}
                                className="rounded-xl"
                              >
                                <Accordion.Header>
                                  <Accordion.Trigger className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-muted">
                                    {item.label}
                                    <ChevronDown
                                      className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                                      aria-hidden="true"
                                    />
                                  </Accordion.Trigger>
                                </Accordion.Header>
                                <Accordion.Content className="flex flex-col gap-1 overflow-hidden pb-2 pl-4 data-[state=closed]:animate-none">
                                  {item.children.map((child) => (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      onClick={() => setMobileOpen(false)}
                                      className="rounded-lg px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                                    >
                                      {child.label}
                                    </Link>
                                  ))}
                                </Accordion.Content>
                              </Accordion.Item>
                            ) : (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-muted",
                                  pathname === item.href && "bg-surface-muted",
                                )}
                              >
                                {item.label}
                              </Link>
                            ),
                          )}
                        </Accordion.Root>

                        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
                          <div className="flex items-center gap-1">
                            <ThemeToggle />
                            <Link
                              href="/admin/login"
                              onClick={() => setMobileOpen(false)}
                              aria-label="Acceso administrativo"
                              title="Acceso administrativo"
                              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                            >
                              <LogIn className="size-4" aria-hidden="true" />
                            </Link>
                          </div>
                          <Button asChild variant="accent">
                            <Link href="/donar">Donar ahora</Link>
                          </Button>
                        </div>

                        <a
                          href="#radio-en-vivo"
                          onClick={() => setMobileOpen(false)}
                          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                        >
                          <Radio
                            className="size-3.5 text-destructive"
                            aria-hidden="true"
                          />
                          Escuchar radio en vivo
                        </a>
                      </motion.div>
                    </Dialog.Content>
                  </Dialog.Portal>
                )}
              </AnimatePresence>
            </Dialog.Root>
          </div>
        </div>
      </motion.header>
    </div>
  );
}
