import React, { useCallback, useEffect, useState } from 'react';
import { fetchBbvaQuote, BbvaQuote } from '../services/dolar';

interface Props {
  onApply: (rate: number) => Promise<{ updatedCount: number }>;
  pendingUsdCount: number;
  // Si la pantalla está filtrada por categoría, este es el nombre — sirve para que
  // el botón y el modal aclaren a qué scope se va a aplicar.
  scopeLabel?: string;
}

const formatRate = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatRelativeTime = (sourceTimeSec: number): string => {
  const diffMs = Date.now() - sourceTimeSec * 1000;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

export const DolarQuoteCard: React.FC<Props> = ({ onApply, pendingUsdCount, scopeLabel }) => {
  const [quote, setQuote] = useState<BbvaQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const q = await fetchBbvaQuote(force);
      setQuote(q);
    } catch (e: any) {
      setError(e?.message || 'No se pudo obtener la cotización');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleApply = async () => {
    if (!quote) return;
    setApplying(true);
    try {
      const res = await onApply(quote.compra);
      setConfirmOpen(false);
      setFeedback(
        res.updatedCount === 0
          ? 'No hay movimientos USD en este mes para actualizar.'
          : `Se actualizaron ${res.updatedCount} movimiento(s) al cambio ${formatRate(quote.compra)}.`
      );
    } catch (e: any) {
      setFeedback('Error al aplicar: ' + (e?.message || 'Desconocido'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-2 pr-3 border border-white/5 min-w-[260px]">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <i className="fas fa-dollar-sign text-lg"></i>
        </div>

        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dólar BBVA</span>
            {quote && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${quote.stale ? 'text-amber-400' : 'text-slate-500'}`}
                title={quote.stale ? 'La fuente no se actualiza hace más de 24 h. Verificá manualmente antes de aplicar.' : `Fuente: CriptoYa (${formatRelativeTime(quote.sourceTime)})`}
              >
                {quote.stale ? 'STALE' : formatRelativeTime(quote.sourceTime)}
              </span>
            )}
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
              title="Refrescar cotización"
            >
              <i className={`fas fa-rotate text-[10px] ${loading ? 'animate-spin' : ''}`}></i>
            </button>
          </div>

          {error ? (
            <span className="text-[11px] font-bold text-rose-400 truncate">{error}</span>
          ) : loading && !quote ? (
            <span className="text-[11px] font-bold text-slate-400">Cargando…</span>
          ) : quote ? (
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-black text-emerald-400">
                C: <span className="text-white">${formatRate(quote.compra)}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                V: ${formatRate(quote.venta)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0" />

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!quote || pendingUsdCount === 0}
          className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
          title={
            pendingUsdCount === 0
              ? (scopeLabel ? `No hay movimientos USD en "${scopeLabel}" este mes` : 'No hay movimientos USD en el mes')
              : (scopeLabel
                  ? `Aplicar a ${pendingUsdCount} movimiento(s) USD en "${scopeLabel}"`
                  : `Aplicar a ${pendingUsdCount} movimiento(s) USD del mes`)
          }
        >
          <i className="fas fa-bolt text-[10px]"></i>
          Aplicar
          {pendingUsdCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono">{pendingUsdCount}</span>
          )}
        </button>
      </div>

      {feedback && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm bg-slate-900 border border-emerald-500/30 rounded-xl px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <p className="text-xs font-bold text-white">{feedback}</p>
        </div>
      )}

      {confirmOpen && quote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <i className="fas fa-bolt text-xl"></i>
                </div>
                <div>
                  <h4 className="text-base font-black text-white uppercase tracking-wide">Aplicar Cotización</h4>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">BBVA — Compra</p>
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-4 border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cotización a aplicar</span>
                  <span className="text-2xl font-black text-emerald-400">${formatRate(quote.compra)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {scopeLabel ? `Movimientos USD en "${scopeLabel}"` : 'Movimientos USD del mes'}
                  </span>
                  <span className="text-base font-black text-white">{pendingUsdCount}</span>
                </div>
                {quote.stale && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-2">
                    <i className="fas fa-triangle-exclamation text-amber-400 text-xs mt-0.5"></i>
                    <p className="text-[10px] font-bold text-amber-400 leading-snug">
                      La fuente está desactualizada hace más de 24 h. Verificá el valor en la app de Brubank antes de continuar.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Esta acción va a reemplazar la <span className="font-bold text-white">Cotiz. Real (Compra)</span> de los movimientos en USD
                {scopeLabel
                  ? <> de la categoría <span className="font-bold text-white">{scopeLabel}</span> en el mes que estás viendo.</>
                  : <> del mes que estás viendo.</>
                } Los totales en ARS se recalculan automáticamente.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={applying}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {applying ? (
                    <>
                      <i className="fas fa-spinner fa-spin text-xs"></i>
                      Aplicando…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check text-xs"></i>
                      Confirmar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
