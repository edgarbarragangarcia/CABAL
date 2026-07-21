import Link from "next/link";
import { AtSign, GraduationCap, MessageCircle, ShieldCheck, Video } from "lucide-react";
import { Container } from "@/components/ui/container";
import { footerNav, siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <GraduationCap className="size-4.5" aria-hidden="true" />
            </span>
            {siteConfig.name}
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            {siteConfig.description}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href={siteConfig.links.facebook}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Facebook de la fundación"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
            </a>
            <a
              href={siteConfig.links.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram de la fundación"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <AtSign className="size-4" aria-hidden="true" />
            </a>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="YouTube de la fundación"
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <Video className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Fundación</h3>
          <ul className="mt-4 space-y-3">
            {footerNav.fundacion.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Apoya la causa</h3>
          <ul className="mt-4 space-y-3">
            {footerNav.ayuda.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Mantente informado</h3>
          <p className="mt-4 text-sm text-muted-foreground">
            Recibe noticias sobre nuestros programas. Sin spam, cancela cuando quieras.
          </p>
          <form
            className="mt-4 flex gap-2"
            action="/api/newsletter"
            method="POST"
            aria-label="Suscripción al boletín"
          >
            <label htmlFor="footer-newsletter-email" className="sr-only">
              Correo electrónico
            </label>
            <input
              id="footer-newsletter-email"
              name="email"
              type="email"
              required
              placeholder="tu@correo.com"
              autoComplete="email"
              className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm outline-none ring-ring transition-shadow focus-visible:ring-2"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground transition hover:brightness-110"
            >
              Unirme
            </button>
          </form>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
            Sitio protegido con cifrado TLS y cabeceras de seguridad OWASP.
          </div>
        </div>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Todos los derechos reservados.
          </p>
          <nav aria-label="Enlaces legales" className="flex items-center gap-5">
            {footerNav.legal.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
    </footer>
  );
}
