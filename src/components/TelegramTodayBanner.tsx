import React, { useState } from 'react';
import { BudgetEntry } from '../types';
import { formatTgTime } from '../utils/helpers';

interface TelegramTodayBannerProps {
  entries: BudgetEntry[];
  formatMoney: (amount: number) => string;
  onEdit: (entry: BudgetEntry) => void;
  onDelete: (id: string) => void;
  onConfirm: (entry: BudgetEntry) => void;
}

// Banner que aparece arriba de Movimientos sólo cuando hay items cargados por
// Telegram pendientes de revisión. Una vez que el usuario los confirma, salen
// del banner y entran a la lista normal de la categoría correspondiente.
export const TelegramTodayBanner: React.FC<TelegramTodayBannerProps> = ({
  entries,
  formatMoney,
  onEdit,
  onDelete,
  onConfirm,
}) => {
  const [expanded, setExpanded] = useState(true);

  const handleDelete = (entry: BudgetEntry) => {
    const ok = window.confirm(
      `¿Eliminar "${entry.name || 'sin nombre'}" ($${formatMoney(entry.amount)})?\n\nEsta acción no se puede deshacer.`,
    );
    if (ok) onDelete(entry.id);
  };

  if (entries.length === 0) return null;

  const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const count = entries.length;

  // YYYY-MM-DD → DD/MM
  const fmtShortDate = (iso?: string) => {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}` : iso;
  };

  return (
    <div className="glass rounded-2xl border border-cyan-500/30 overflow-hidden shadow-lg shadow-cyan-500/5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <i className="fab fa-telegram text-lg"></i>
          </div>
          <div className="text-left min-w-0">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
              Pendientes desde Telegram · revisar
            </div>
            <div className="text-sm font-bold text-white truncate">
              {count} {count === 1 ? 'movimiento' : 'movimientos'} · {formatMoney(total)}
            </div>
          </div>
        </div>
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-slate-400 ml-3 flex-shrink-0`}></i>
      </button>

      {expanded && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 hover:bg-white/5 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white truncate">
                    {entry.name || 'Sin nombre'}
                  </span>
                  <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">
                    {fmtShortDate(entry.date)}
                    {formatTgTime(entry.id) && ` · ${formatTgTime(entry.id)}hs`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {entry.category} › {entry.tag}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                <div className="text-sm font-bold text-rose-400 whitespace-nowrap mr-1">
                  {formatMoney(entry.amount)}
                </div>
                <button
                  type="button"
                  onClick={() => onConfirm(entry)}
                  className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 hover:text-white px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 transition-colors"
                  title="Confirmar y mover a la categoría"
                >
                  <i className="fas fa-check mr-1"></i>Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="text-[10px] uppercase tracking-wider font-bold text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  title="Editar antes de confirmar"
                >
                  <i className="fas fa-pen mr-1"></i>Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  className="text-[10px] uppercase tracking-wider font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                  title="Eliminar / desestimar"
                >
                  <i className="fas fa-trash mr-1"></i>Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
