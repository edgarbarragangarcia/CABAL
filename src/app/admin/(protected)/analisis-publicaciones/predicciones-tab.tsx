"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FlaskConical,
  ChevronDown,
  Circle,
  CircleCheck,
  GitFork,
  Loader2,
  MapPin,
  Network as NetworkIcon,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Users,
  UsersRound,
  Waypoints,
  X,
} from "lucide-react";

import { useTheme } from "@/components/animations/theme-provider";
import {
  buildNetwork,
  dimensionOf,
  normalizeText,
  predictFor,
  sharedTraits,
  type Mapping,
  type Network,
  type Trait,
} from "@/lib/crm/network";
import {
  DIMENSIONS,
  DIMENSION_LABEL,
  type CrmSnapshot,
  type Dimension,
  type RedCrmResponse,
} from "@/lib/crm/types";
import { demoSnapshot } from "@/lib/crm/demo";
import { OTHER_COMMUNITY_COLOR, RedCrmGraph, communityColor } from "./red-crm-graph";

const DIMENSION_ICON: Record<Dimension, LucideIcon> = {
  lugar: MapPin,
  intereses: Sparkles,
  actividades: CalendarDays,
  referidos: UserPlus,
};

const ALL_DIMENSIONS: ReadonlySet<Dimension> = new Set(DIMENSIONS);
/** Tope de puntos dibujados: con más, el layout de fuerzas se vuelve lento e ilegible. */
const MAX_DRAWN = 700;
const MAPPING_KEY = "el-admin-red-crm-campos-v1";

const fmt = (n: number) => n.toLocaleString("es-CO");
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

/** Mismo estilo de tarjetas que Votaciones. */
const KPI_STYLES = [
  { icon: Users, card: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
  { icon: NetworkIcon, card: "from-sky-500 to-indigo-600", glow: "shadow-sky-500/30" },
  { icon: UsersRound, card: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30" },
  { icon: UserPlus, card: "from-fuchsia-500 to-rose-600", glow: "shadow-rose-500/30" },
];

/** Carga de la red; al actualizar se sigue mostrando la red anterior hasta que llega la nueva. */
function useRedCrm() {
  const [version, setVersion] = React.useState(0);
  const [state, setState] = React.useState<{ version: number; body: RedCrmResponse } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/red-crm${version ? `?refresh=1&v=${version}` : ""}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<RedCrmResponse>)
      .then(
        (body) => !cancelled && setState({ version, body }),
        () =>
          !cancelled &&
          setState({
            version,
            body: { status: "error", message: "No fue posible cargar la red. Revisa tu conexión e intenta de nuevo." },
          })
      );
    return () => {
      cancelled = true;
    };
  }, [version]);
  return {
    body: state?.body ?? null,
    loading: state?.version !== version,
    refresh: () => setVersion((v) => v + 1),
  };
}

// El mapeo manual de campos es una preferencia de quien usa el panel: vive en este navegador.
function readMapping(): Mapping {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? "{}") as Mapping;
  } catch {
    return {};
  }
}

function saveMapping(mapping: Mapping) {
  try {
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    // Sin almacenamiento disponible: el mapeo dura mientras la pestaña esté abierta.
  }
}

/**
 * Pestaña Red Cabal: la red de relaciones de los contactos de Bitrix24.
 * Quién comparte lugar, intereses o actividades, quién trajo a quién, qué
 * comunidades se forman y qué relaciones son probables aunque aún no existan.
 * Mientras Bitrix24 no esté conectado, muestra una red de ejemplo.
 */
export function PrediccionesTab() {
  const { body, loading, refresh } = useRedCrm();

  if (!body) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Consultando contactos en Bitrix24...
      </p>
    );
  }
  if (body.status === "configurar") {
    return <RedCrm snapshot={demoSnapshot()} demo={body.falta} onRefresh={refresh} refreshing={loading} />;
  }
  if (body.status === "error") {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <p className="min-w-0 flex-1">{body.message}</p>
        <RetryButton onClick={refresh} busy={loading} label="Reintentar" />
      </div>
    );
  }
  if (!body.snapshot.contacts.length) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-sm">
        <UsersRound className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Bitrix24 está conectado ({body.snapshot.portal}), pero todavía no hay contactos en el CRM.
        </p>
        <RetryButton onClick={refresh} busy={loading} label="Actualizar" />
      </div>
    );
  }
  return <RedCrm snapshot={body.snapshot} onRefresh={refresh} refreshing={loading} />;
}

function RetryButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
    </button>
  );
}

function Configurar({
  falta,
  onRetry,
  retrying,
}: {
  falta: { admin: boolean; bitrix: boolean };
  onRetry: () => void;
  retrying: boolean;
}) {
  const steps: { done: boolean; title: string; body: React.ReactNode }[] = [
    {
      done: !falta.admin,
      title: "Protege el panel",
      body: (
        <>
          El correo y la contraseña del panel están escritos en el código, que es público en GitHub. Antes
          de traer datos personales del CRM, crea en Vercel (<b>Settings → Environment Variables</b>){" "}
          <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> (una contraseña nueva) y{" "}
          <code>ADMIN_SESSION_SECRET</code> (una frase larga al azar). Al volver a desplegar, entra con la
          contraseña nueva.
        </>
      ),
    },
    {
      done: !falta.bitrix,
      title: "Crea un webhook entrante en Bitrix24",
      body: (
        <>
          En Bitrix24 abre <b>Aplicaciones → Recursos para desarrolladores → Otros → Webhook entrante</b>.
          Marca los permisos <b>CRM (crm)</b> y <b>Usuarios (user_basic)</b>, guarda y copia la URL (se ve
          así: <code>https://tuempresa.bitrix24.co/rest/1/abc123.../</code>).
        </>
      ),
    },
    {
      done: !falta.bitrix,
      title: "Guarda la URL en Vercel",
      body: (
        <>
          Crea la variable <code>BITRIX24_WEBHOOK_URL</code> con esa URL y vuelve a desplegar. La URL
          funciona como una llave del CRM: no la pegues en chats ni en el código.
        </>
      ),
    },
  ];

  return (
    <div className="cabal-rise rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <NetworkIcon className="size-5 text-brand" aria-hidden="true" />
        Conecta la red con tu Bitrix24
      </p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Aquí verás a tus contactos del CRM como una red: quién comparte barrio, intereses o actividades,
        quién trajo a quién, qué comunidades se forman y qué relaciones son probables. La red solo lee
        contactos; nunca escribe en tu CRM.
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-border p-4 text-sm">
            {s.done ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-label="Listo" />
            ) : (
              <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Pendiente" />
            )}
            <div className="min-w-0 [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:break-all">
              <p className={`font-semibold ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {i + 1}. {s.title}
              </p>
              {!s.done && <p className="mt-1 leading-relaxed text-muted-foreground">{s.body}</p>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        <RetryButton onClick={onRetry} busy={retrying} label="Ya lo hice, volver a intentar" />
      </div>
    </div>
  );
}

function TraitChip({ trait }: { trait: Trait }) {
  const Icon = DIMENSION_ICON[trait.dim];
  return (
    <span
      title={`${trait.field}: ${trait.value}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-foreground/80"
    >
      <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{trait.value}</span>
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function RedCrm({
  snapshot,
  demo,
  onRefresh,
  refreshing,
}: {
  snapshot: CrmSnapshot;
  /** Red de ejemplo: qué falta para conectar Bitrix24. */
  demo?: { admin: boolean; bitrix: boolean };
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [showSteps, setShowSteps] = React.useState(false);
  const [mapping, setMapping] = React.useState<Mapping>(() =>
    typeof window === "undefined" ? {} : readMapping()
  );
  const [enabled, setEnabled] = React.useState<ReadonlySet<Dimension>>(ALL_DIMENSIONS);
  const [focus, setFocus] = React.useState<{ network: Network; community: number } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [showFields, setShowFields] = React.useState(false);

  // Recalcular la red tarda un instante con miles de contactos: mientras, la anterior queda atenuada.
  const deferredMapping = React.useDeferredValue(mapping);
  const deferredEnabled = React.useDeferredValue(enabled);
  const stale = deferredMapping !== mapping || deferredEnabled !== enabled;
  const network = React.useMemo(
    () => buildNetwork(snapshot, deferredMapping, deferredEnabled),
    [snapshot, deferredMapping, deferredEnabled]
  );

  // Comunidad enfocada y persona elegida solo valen para la red en la que se eligieron.
  const community = focus?.network === network ? focus.community : null;
  const indexById = React.useMemo(() => new Map(network.nodes.map((n, i) => [n.id, i])), [network]);
  const selected = selectedId === null ? null : (indexById.get(selectedId) ?? null);

  // Con muchos contactos, cada comunidad aporta a sus miembros más centrales en proporción a su
  // tamaño: así cada racimo se ve completo y conectado, en vez de pedazos sueltos de todos.
  const { visible, hidden } = React.useMemo(() => {
    const central = (members: number[], k: number) =>
      [...members].sort((a, b) => network.nodes[b].strength - network.nodes[a].strength).slice(0, k);
    const groups = community !== null ? [network.communities[community]] : network.communities;
    const total = groups.reduce((s, c) => s + c.members.length, 0);
    if (total <= MAX_DRAWN) return { visible: groups.flatMap((c) => c.members), hidden: 0 };
    const picked: number[] = [];
    for (const c of groups) {
      if (picked.length >= MAX_DRAWN) break;
      const k = Math.max(3, Math.round((c.members.length * MAX_DRAWN) / total));
      picked.push(...central(c.members, Math.min(k, MAX_DRAWN - picked.length)));
    }
    return { visible: picked, hidden: total - picked.length };
  }, [network, community]);
  const visibleSet = React.useMemo(() => new Set(visible), [visible]);

  const choose = (i: number) => {
    setSelectedId(network.nodes[i].id);
    setQuery("");
    const c = network.nodes[i].community;
    if (!visibleSet.has(i)) setFocus(c >= 0 ? { network, community: c } : null);
  };

  const fieldsByDim = React.useMemo(() => {
    const out: Record<Dimension, string[]> = { lugar: [], intereses: [], actividades: [], referidos: [] };
    for (const f of snapshot.fields) {
      const d = dimensionOf(f, mapping);
      if (d) out[d].push(f.label);
    }
    return out;
  }, [snapshot, mapping]);

  const matches = React.useMemo(() => {
    const q = normalizeText(query);
    if (q.length < 2) return [];
    return network.nodes.flatMap((n, i) => (normalizeText(n.name).includes(q) ? [i] : [])).slice(0, 8);
  }, [network, query]);

  const bridges = React.useMemo(
    () =>
      network.nodes
        .flatMap((n, i) => (n.degree >= 3 && n.bridge >= 0.3 ? [i] : []))
        .sort((a, b) => {
          const score = (i: number) => network.nodes[i].bridge * Math.log1p(network.nodes[i].strength);
          return score(b) - score(a);
        })
        .slice(0, 6),
    [network]
  );

  const setDimension = (key: string, dim: Dimension | null) => {
    const next = { ...mapping, [key]: dim };
    setMapping(next);
    saveMapping(next);
  };
  const resetMapping = () => {
    setMapping({});
    saveMapping({});
  };
  const toggle = (d: Dimension) => {
    const next = new Set(enabled);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setEnabled(next);
  };

  const groups = network.communities.filter((c) => c.members.length >= 3).length;
  const kpis = [
    {
      label: "Contactos analizados",
      value: fmt(snapshot.contacts.length),
      sub: demo
        ? "inventados, de ejemplo"
        : snapshot.total > snapshot.contacts.length
          ? `los más recientes de ${fmt(snapshot.total)}`
          : "todos los del CRM",
    },
    { label: "Relaciones encontradas", value: fmt(network.edges.length), sub: "por parecido o referido" },
    { label: "Comunidades", value: fmt(groups), sub: "de 3 o más personas" },
    {
      label: "Referidos",
      value: fmt(network.edges.filter((e) => e.referral).length),
      sub: "quién trajo a quién",
    },
  ];
  const nameOf = (i: number) => network.nodes[i].name;

  return (
    <div className="space-y-5">
      {demo && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm text-accent-ink">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Estás viendo datos de ejemplo</p>
            <p className="mt-0.5">
              Son {fmt(snapshot.contacts.length)} contactos inventados para que veas cómo funciona la red. Cuando
              conectes Bitrix24, aquí aparecerán tus contactos reales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-4 py-2 font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Cómo conectar Bitrix24
            <ChevronDown className={`size-4 transition-transform ${showSteps ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      )}
      {demo && showSteps && <Configurar falta={demo} onRetry={onRefresh} retrying={refreshing} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <NetworkIcon className="size-5 text-brand" aria-hidden="true" />
            Red de relaciones del CRM
          </p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Cada punto es un contacto {demo ? "de ejemplo" : `de Bitrix24 (${snapshot.portal})`}. Dos contactos
            quedan unidos cuando comparten lugar, intereses o actividades —pesa más lo que comparten pocos que lo
            que comparte toda la ciudad— o cuando uno trajo al otro.
          </p>
        </div>
        {!demo && <RetryButton onClick={onRefresh} busy={refreshing} label="Actualizar" />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const style = KPI_STYLES[i];
          const Icon = style.icon;
          return (
            <div
              key={k.label}
              className={`cabal-rise group relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.card} p-4 text-white shadow-lg ${style.glow} transition-transform duration-300 hover:-translate-y-1`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                aria-hidden="true"
                className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/85">{k.label}</p>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="relative mt-2 text-2xl font-bold">{k.value}</p>
              <p className="relative text-[11px] text-white/80">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros: una sola fila sobre todo lo que afectan. */}
      <div className="flex flex-wrap items-center gap-2">
        {DIMENSIONS.map((d) => {
          const Icon = DIMENSION_ICON[d];
          const fields = fieldsByDim[d];
          const on = enabled.has(d) && fields.length > 0;
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              disabled={!fields.length}
              aria-pressed={on}
              title={
                fields.length
                  ? `Campos: ${fields.join(", ")}`
                  : "No hay campos de Bitrix24 para esta relación. Asígnale uno en «Campos del CRM»."
              }
              className={
                on
                  ? "inline-flex items-center gap-2 rounded-full border border-brand bg-brand-soft px-3.5 py-1.5 text-sm font-medium text-brand"
                  : "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {DIMENSION_LABEL[d]}
              <span className="text-xs opacity-70">
                {fields.length ? plural(fields.length, "campo", "campos") : "sin campos"}
              </span>
            </button>
          );
        })}
        <div className="relative w-full sm:ml-auto sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una persona"
            aria-label="Buscar una persona en la red"
            className="w-full rounded-full border border-border bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-brand"
          />
          {matches.length > 0 && (
            <ul className="absolute right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
              {matches.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                  >
                    <Dot color={communityColor(network.nodes[i].community, resolvedTheme)} />
                    <span className="truncate">{nameOf(i)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className={`grid gap-4 transition-opacity lg:grid-cols-[minmax(0,1fr)_340px] ${stale ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
            {community !== null ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Dot color={communityColor(community, resolvedTheme)} />
                  Grupo {community + 1} · {plural(network.communities[community].members.length, "persona", "personas")}
                </span>
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="rounded-full border border-border px-2.5 py-1 font-medium text-foreground hover:bg-surface-muted"
                >
                  Ver toda la red
                </button>
              </>
            ) : (
              <>
                {network.communities.slice(0, 3).map((c, ci) => (
                  <span key={ci} className="inline-flex items-center gap-1.5">
                    <Dot color={communityColor(ci, resolvedTheme)} />
                    Grupo {ci + 1}
                  </span>
                ))}
                {network.communities.length > 3 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Dot color={OTHER_COMMUNITY_COLOR} />
                    Otros grupos
                  </span>
                )}
              </>
            )}
            <span className="inline-flex items-center gap-1.5 sm:ml-auto">
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                <path d="M5 0 10 5 5 10 0 5z" fill="currentColor" />
              </svg>
              Trajo a alguien
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 16 8" className="h-2 w-4" aria-hidden="true">
                <path d="M0 4h12M9 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Quién trajo a quién
            </span>
          </div>

          {network.edges.length > 0 ? (
            <RedCrmGraph network={network} visible={visible} selected={selected} onSelect={choose} />
          ) : (
            <div className="grid h-[320px] place-items-center p-6 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">No hay relaciones con los campos elegidos.</p>
                <p className="mt-1">
                  Activa más relaciones arriba o revisa qué representa cada campo en{" "}
                  <button type="button" onClick={() => setShowFields(true)} className="font-medium text-brand underline">
                    Campos del CRM
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
          {hidden > 0 && (
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              Se ven los {fmt(visible.length)} contactos más conectados de cada comunidad, de{" "}
              {fmt(visible.length + hidden)}. Elige una comunidad para verla completa.
            </p>
          )}
        </div>

        <aside className="min-w-0">
          {selected !== null ? (
            <PersonPanel
              network={network}
              index={selected}
              theme={resolvedTheme}
              onChoose={choose}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <CommunityList
              network={network}
              theme={resolvedTheme}
              focused={community}
              onFocus={(ci) => setFocus(ci === community ? null : { network, community: ci })}
            />
          )}
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Waypoints className="size-4 text-brand" aria-hidden="true" />
            Relaciones probables
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Personas que aún no están unidas pero tienen varios contactos en común: vale la pena presentarlas o
            invitarlas juntas.
          </p>
          {network.predictions.length ? (
            <ul className="mt-3 space-y-2">
              {network.predictions.slice(0, 8).map((p) => (
                <li key={`${p.a}-${p.b}`} className="rounded-xl border border-border p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-x-1.5">
                    <button type="button" onClick={() => choose(p.a)} className="font-medium hover:text-brand">
                      {nameOf(p.a)}
                    </button>
                    <span className="text-muted-foreground">↔</span>
                    <button type="button" onClick={() => choose(p.b)} className="font-medium hover:text-brand">
                      {nameOf(p.b)}
                    </button>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plural(p.via.length, "contacto en común", "contactos en común")}:{" "}
                    {p.via.slice(0, 3).map(nameOf).join(", ")}
                    {p.via.length > 3 ? "..." : ""}
                  </p>
                  {p.shared.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.shared.map((t) => (
                        <TraitChip key={`${t.dim}-${t.value}`} trait={t} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Todavía no hay parejas con contactos en común suficientes.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <GitFork className="size-4 text-brand" aria-hidden="true" />
            Personas puente
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sus relaciones cruzan varias comunidades: sirven para llevar un mensaje de un grupo a otro.
          </p>
          {bridges.length ? (
            <ul className="mt-3 space-y-2">
              {bridges.map((i) => {
                const reach = new Set([...network.adjacency[i].keys()].map((j) => network.nodes[j].community)).size;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => choose(i)}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:bg-surface-muted"
                    >
                      <Dot color={communityColor(network.nodes[i].community, resolvedTheme)} />
                      <span className="min-w-0 flex-1 truncate font-medium">{nameOf(i)}</span>
                      <span className="w-full pl-[22px] text-xs text-muted-foreground sm:w-auto sm:pl-0">
                        conecta {reach} grupos · {plural(network.nodes[i].degree, "vínculo", "vínculos")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nadie conecta todavía comunidades distintas.</p>
          )}
        </section>
      </div>

      <FieldsPanel
        snapshot={snapshot}
        mapping={mapping}
        open={showFields}
        onToggle={() => setShowFields((v) => !v)}
        onChange={setDimension}
        onReset={resetMapping}
      />
    </div>
  );
}

function CommunityList({
  network,
  theme,
  focused,
  onFocus,
}: {
  network: Network;
  theme: "light" | "dark";
  focused: number | null;
  onFocus: (community: number) => void;
}) {
  const shown = network.communities.slice(0, 10);
  const rest = network.communities.length - shown.length;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <UsersRound className="size-4 text-brand" aria-hidden="true" />
        Comunidades
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Grupos más unidos entre sí que con el resto. Elige uno para verlo en la red, o toca un punto para ver
        a esa persona.
      </p>
      {shown.length ? (
        <ul className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {shown.map((c, ci) => (
            <li key={ci}>
              <button
                type="button"
                onClick={() => onFocus(ci)}
                aria-pressed={focused === ci}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                  focused === ci ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Dot color={communityColor(ci, theme)} />
                  <span className="font-semibold">Grupo {ci + 1}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {plural(c.members.length, "persona", "personas")}
                  </span>
                </span>
                {c.traits.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1">
                    {c.traits.map((t) => (
                      <TraitChip key={`${t.dim}-${t.value}`} trait={t} />
                    ))}
                  </span>
                )}
                <span className="mt-2 block text-xs text-muted-foreground">
                  Centro: <span className="text-foreground">{network.nodes[c.hub].name}</span>
                  {c.referrer !== null && (
                    <>
                      {" "}
                      · red de <span className="text-foreground">{network.nodes[c.referrer].name}</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Aún no se forman comunidades.</p>
      )}
      {rest > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          y {plural(rest, "grupo más pequeño", "grupos más pequeños")}.
        </p>
      )}
    </div>
  );
}

function PersonPanel({
  network,
  index,
  theme,
  onChoose,
  onClose,
}: {
  network: Network;
  index: number;
  theme: "light" | "dark";
  onChoose: (i: number) => void;
  onClose: () => void;
}) {
  const node = network.nodes[index];
  const strongest = [...network.adjacency[index]]
    .map(([j, k]) => ({ j, edge: network.edges[k] }))
    .sort((x, y) => y.edge.weight - x.edge.weight)
    .slice(0, 8);
  const probable = predictFor(network, index, 5);
  const traitsByDim = DIMENSIONS.map((d) => ({ d, traits: node.traits.filter((t) => t.dim === d) })).filter(
    (x) => x.traits.length
  );
  const person = (i: number) => (
    <button type="button" onClick={() => onChoose(i)} className="font-medium hover:text-brand">
      {network.nodes[i].name}
    </button>
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{node.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {node.community >= 0 && <Dot color={communityColor(node.community, theme)} />}
            <span>
              {node.community >= 0 && `Grupo ${node.community + 1} · `}
              {plural(node.degree, "vínculo", "vínculos")}
              {node.referred.length > 0 && ` · trajo a ${fmt(node.referred.length)}`}
            </span>
          </p>
          {node.external && (
            <p className="mt-1.5 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
              Referente que no está como contacto
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {node.referredBy.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">La trajo: </span>
          {node.referredBy.map((r, k) => (
            <React.Fragment key={r}>
              {k > 0 && ", "}
              {person(r)}
            </React.Fragment>
          ))}
        </p>
      )}

      {traitsByDim.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {traitsByDim.map(({ d, traits }) => (
            <div key={d} className="flex flex-wrap gap-1">
              {traits.map((t) => (
                <TraitChip key={`${t.field}-${t.value}`} trait={t} />
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Relaciones más fuertes
      </p>
      <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
        {strongest.map(({ j, edge }) => (
          <li key={j} className="rounded-xl border border-border p-2.5 text-sm">
            <span className="flex items-center gap-2">
              <Dot color={communityColor(network.nodes[j].community, theme)} />
              <span className="min-w-0 truncate">{person(j)}</span>
              {edge.referral && (
                <span className="ml-auto shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                  {edge.a === index ? "Referido" : "Referente"}
                </span>
              )}
            </span>
            {edge.shared.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {edge.shared.map((t) => (
                  <TraitChip key={`${t.dim}-${t.value}`} trait={t} />
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>

      {probable.length > 0 && (
        <>
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Waypoints className="size-3.5" aria-hidden="true" />
            Relaciones probables
          </p>
          <ul className="mt-2 space-y-2">
            {probable.map((p) => {
              const shared = sharedTraits(network, index, p.b);
              return (
                <li key={p.b} className="rounded-xl border border-dashed border-border p-2.5 text-sm">
                  {person(p.b)}
                  <span className="block text-xs text-muted-foreground">
                    por {p.via.slice(0, 2).map((w) => network.nodes[w].name).join(" y ")}
                    {p.via.length > 2 ? ` y ${fmt(p.via.length - 2)} más` : ""}
                  </span>
                  {shared.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {shared.map((t) => (
                        <TraitChip key={`${t.dim}-${t.value}`} trait={t} />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FieldsPanel({
  snapshot,
  mapping,
  open,
  onToggle,
  onChange,
  onReset,
}: {
  snapshot: CrmSnapshot;
  mapping: Mapping;
  open: boolean;
  onToggle: () => void;
  onChange: (key: string, dim: Dimension | null) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4 text-brand" aria-hidden="true" />
          Campos del CRM
        </span>
        <span className="text-xs text-muted-foreground">
          {plural(snapshot.fields.length, "campo", "campos")} · qué relación representa cada uno
        </span>
        <ChevronDown
          className={`ml-auto size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Se asignaron por el nombre de cada campo en Bitrix24. Si alguno quedó mal, cámbialo aquí: el cambio
            se guarda en este navegador. Solo aparecen campos que relacionan a alguien (los que son únicos por
            persona, como documentos o direcciones, no se usan).
          </p>
          {snapshot.fields.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Campo</th>
                    <th className="py-2 pr-3 font-medium">Contactos con valor</th>
                    <th className="py-2 pr-3 font-medium">Valores distintos</th>
                    <th className="py-2 font-medium">Relación</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.fields.map((f) => (
                    <tr key={f.key} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{f.label}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{f.key}</span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{fmt(f.filled)}</td>
                      <td className="py-2 pr-3 tabular-nums">{fmt(f.values.length)}</td>
                      <td className="py-2">
                        <select
                          value={dimensionOf(f, mapping) ?? ""}
                          onChange={(e) => onChange(f.key, (e.target.value || null) as Dimension | null)}
                          aria-label={`Relación del campo ${f.label}`}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                        >
                          <option value="">No usar</option>
                          {DIMENSIONS.map((d) => (
                            <option key={d} value={d}>
                              {DIMENSION_LABEL[d]}
                              {f.auto === d ? " (automático)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Los contactos no tienen campos que relacionen a unas personas con otras.
            </p>
          )}
          {Object.keys(mapping).length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="mt-3 text-xs font-medium text-brand underline underline-offset-2"
            >
              Volver a la asignación automática
            </button>
          )}
        </div>
      )}
    </section>
  );
}
