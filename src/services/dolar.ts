// Cotización del dólar BBVA (proxy de Brubank).
// Fuente: CriptoYa /api/bancostodos — público, sin auth, CORS abierto, rate-limit 120/min.
// Convención del campo `compra` / `venta`:
//   compra = lo que el USUARIO paga al comprar USD  = ask del banco
//   venta  = lo que el USUARIO recibe al vender USD = bid del banco
// (Importante: NO coincide con la convención bancaria; está alineado con la UX de la app.)

const CRIPTOYA_URL = 'https://criptoya.com/api/bancostodos';
const CACHE_KEY = 'nexus_bbva_quote_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 h: si CriptoYa no refrescó en este lapso, marcamos `stale`

export interface BbvaQuote {
  compra: number;
  venta: number;
  sourceTime: number;   // unix seconds — última actualización reportada por CriptoYa
  fetchedAt: number;    // ms — cuándo lo trajimos nosotros
  stale: boolean;       // true si sourceTime quedó muy viejo
}

const readCache = (): BbvaQuote | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BbvaQuote;
  } catch {
    return null;
  }
};

const writeCache = (q: BbvaQuote) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(q)); } catch { /* ignore quota errors */ }
};

export async function fetchBbvaQuote(forceRefresh = false): Promise<BbvaQuote> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached;
    }
  }

  const res = await fetch(CRIPTOYA_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`CriptoYa respondió ${res.status}`);
  const data = await res.json() as Record<string, { ask?: number; bid?: number; time?: number }>;
  const bbva = data?.bbva;
  if (!bbva || typeof bbva.ask !== 'number' || typeof bbva.bid !== 'number') {
    throw new Error('Respuesta inesperada: no se encontró el campo `bbva`');
  }

  const sourceTime = typeof bbva.time === 'number' ? bbva.time : Math.floor(Date.now() / 1000);
  const stale = Date.now() - sourceTime * 1000 > STALE_THRESHOLD_MS;

  const quote: BbvaQuote = {
    compra: bbva.ask,
    venta: bbva.bid,
    sourceTime,
    fetchedAt: Date.now(),
    stale,
  };
  writeCache(quote);
  return quote;
}
