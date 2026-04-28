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
