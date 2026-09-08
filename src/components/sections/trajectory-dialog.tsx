"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Sparkles, X } from "lucide-react";

import {
  cabalStats,
  cabalBills,
  cabalProfileUrl,
} from "@/config/maria-fernanda-cabal";

/**
 * Ficha "Trayectoria legislativa" que se despliega en un panel con el
 * detalle verificable del trabajo de María Fernanda Cabal en el Congreso:
 * cifras con fuente e iniciativas radicadas con su tema.
 */
export function TrajectoryDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel fixed left-1/2 top-1/2 z-[61] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl text-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
                  <div>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#22c58a]">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      Trayectoria legislativa
                    </span>
                    <Dialog.Title className="mt-1 text-xl font-semibold tracking-tight">
                      12 años en el Congreso de la República
                    </Dialog.Title>
                  </div>
                  <Dialog.Close
                    className="rounded-full border border-white/10 p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <div className="overflow-y-auto p-6">
                  <dl className="grid grid-cols-3 gap-3">
                    {cabalStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <dd className="text-lg font-semibold tracking-tight">
                          {stat.value}
                        </dd>
                        <dt className="mt-1 text-[10px] leading-snug text-zinc-500">
                          {stat.label}
                        </dt>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Iniciativas radicadas · fuente Congreso Visible
                  </p>
                  <ul className="mt-3 space-y-2">
                    {cabalBills.map((bill) => (
                      <li
                        key={bill.title}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <span className="text-sm text-zinc-200">{bill.title}</span>
                        <span className="mt-0.5 shrink-0 rounded-full bg-[#22c58a]/15 px-2 py-0.5 text-[10px] font-medium text-[#22c58a]">
                          {bill.topic}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={cabalProfileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                  >
                    Ver perfil completo en Congreso Visible
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
