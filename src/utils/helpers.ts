export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  // Handle YYYY-MM-DD or ISO strings
  // We want to display the date component as is, without timezone conversion
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  
  // Format as DD/MM/YYYY
  return `${day}/${month}/${year}`;
};

export const PREDEFINED_CARDS = [
    'VISA', 'MASTERCARD', 'AMERICAN EXPRESS', 'CABAL', 'NARANJA X',
    'SHOPPING', 'CENCOSUD', 'ARGENCARD', '365', 'MERCADO PAGO', 'UALA', 'LEMON',
    'TARJETA SOL', 'CORDOBESA'
];

// Predicate compartido entre el contador del botón "Aplicar" y el handler que aplica
// la cotización. Mantenerlos alineados es crítico: si el contador dice X pero el
// handler toca Y, confunde al usuario. Itera SIEMPRE entries reales en DB,
// excluyendo agregadores virtuales (`card-agg-*`, `inst-*`, `shared-*`, `virt-*`).
export const isUsdTargetEntry = (e: any): boolean => (
  e.currency === 'USD' &&
  typeof e.originalAmount === 'number' &&
  e.originalAmount > 0 &&
  !e.deleted &&
  !e.id.startsWith('card-agg-') &&
  !e.id.startsWith('inst-') &&
  !e.id.startsWith('shared-') &&
  !e.id.startsWith('virt-')
);

// El bot de Telegram genera ids con formato `tg_<timestamp_ms>_<rand>`. Eso
// nos da la hora exacta de creación gratis: la extraemos para mostrarla en el
// banner y en la lista de Movimientos sin tener que agregar columna nueva.
export const extractTgTimestamp = (id: string | undefined | null): number | null => {
  if (typeof id !== 'string') return null;
  const match = id.match(/^tg_(\d+)_/);
  if (!match) return null;
  const ts = parseInt(match[1], 10);
  return Number.isFinite(ts) ? ts : null;
};

// HH:MM en hora local del navegador (UTC-3 para AR). El timestamp viene en UTC ms.
export const formatTgTime = (id: string | undefined | null): string => {
  const ts = extractTgTimestamp(id);
  if (ts === null) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};
