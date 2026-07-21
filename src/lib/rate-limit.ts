/**
 * Rate limiting para rutas de API sensibles (contacto, donaciones, newsletter).
 *
 * En producción, define UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN
 * para usar Upstash Redis (@upstash/ratelimit) de forma distribuida.
 * Sin esas variables, cae de forma segura a un limitador en memoria por
 * instancia — suficiente para desarrollo y despliegues de instancia única,
 * pero no compartido entre regiones Edge.
 */

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS = 10;

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, limit: MAX_REQUESTS, remaining: MAX_REQUESTS - 1, reset: now + WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { success: false, limit: MAX_REQUESTS, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return {
    success: true,
    limit: MAX_REQUESTS,
    remaining: MAX_REQUESTS - entry.count,
    reset: entry.resetAt,
  };
}

let upstashLimiter: {
  limit: (identifier: string) => Promise<RateLimitResult>;
} | null = null;

async function getUpstashLimiter() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  if (upstashLimiter) return upstashLimiter;

  // Import dinámico: evita el costo/las dependencias de Upstash cuando no
  // está configurado.
  const [{ Redis }, { Ratelimit }] = await Promise.all([
    import("@upstash/redis"),
    import("@upstash/ratelimit"),
  ]);

  const redis = new Redis({ url, token });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "60 s"),
    analytics: true,
    prefix: "fel:ratelimit",
  });

  upstashLimiter = {
    limit: async (identifier: string) => {
      const result = await ratelimit.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    },
  };

  return upstashLimiter;
}

/** Aplica rate limiting a un identificador (normalmente la IP del cliente). */
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  try {
    const limiter = await getUpstashLimiter();
    if (limiter) return limiter.limit(identifier);
  } catch {
    // Si Upstash no está disponible, se recurre al limitador en memoria
    // en lugar de bloquear la solicitud.
  }

  return memoryRateLimit(identifier);
}
