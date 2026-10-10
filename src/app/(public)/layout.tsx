import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteAuroraBackground } from "@/components/layout/site-aurora-background";

/**
 * Cromo público (navbar + footer) — separado del layout raíz para que las
 * rutas fuera de este grupo (p. ej. /admin) no lo hereden.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-full flex-col pb-20 md:pb-0">
      <SiteAuroraBackground />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
