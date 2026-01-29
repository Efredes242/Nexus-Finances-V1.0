import React from 'react';
import { InstallmentPurchase, CategoryType } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Tooltip } from '../components/Tooltip';
import { generateUUID } from '../utils/helpers';

interface TarjetasViewProps {
  installmentPurchases: InstallmentPurchase[];
  currentMonth: string;
  formatMoney: (amount: number) => string;
  setEditingInstallment: (installment: InstallmentPurchase) => void;
  setViewingInstallment: (installment: InstallmentPurchase | null) => void;
  deleteInstallment: (id: string) => void;
}

export const TarjetasView: React.FC<TarjetasViewProps> = ({
  installmentPurchases,
  currentMonth,
  formatMoney,
  setEditingInstallment,
  setViewingInstallment,
  deleteInstallment
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black">Planificación Crediticia</h3>
            <Tooltip content="Aquí puedes registrar tus compras en cuotas para ver cuánto deberás pagar cada mes en tu resumen de tarjeta." position="bottom" useIcon />
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Seguimiento de consumos financiados</p>
        </div>
        <Button onClick={() => setEditingInstallment({
          id: generateUUID(), name: '', totalAmount: 0, installments: 1, startDate: currentMonth, category: CategoryType.FIXED_EXPENSE, tag: 'Cuotas'
        })} className="rounded-2xl">
          <i className="fas fa-plus mr-2"></i> Nueva Financiación
        </Button>
      </div>

      {installmentPurchases.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] text-slate-600">
          <i className="fas fa-credit-card text-5xl mb-4 opacity-20"></i>
          <p className="font-bold">No hay compras en cuotas registradas</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(
            installmentPurchases.reduce((acc, p) => {
              const key = p.cardName || 'Otras / Sin Tarjeta';
              if (!acc[key]) acc[key] = [];
              acc[key].push(p);
              return acc;
            }, {} as Record<string, InstallmentPurchase[]>)
          ).sort((a, b) => a[0].localeCompare(b[0])).map(([cardName, purchases]) => (
            <div key={cardName} className="space-y-4">
              <div className="flex items-center gap-3 px-2 border-b border-white/5 pb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center border border-white/10">
                  <i className="fas fa-credit-card text-blue-400"></i>
                </div>
                <div>
                  <h4 className="text-lg font-black text-white uppercase tracking-wider">{cardName}</h4>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{purchases.length} Financiaciones activas</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {purchases.map(p => {
                  const [sY, sM] = p.startDate.split('-').map(Number);
                  const [cY, cM] = currentMonth.split('-').map(Number);
                  const diff = (cY - sY) * 12 + (cM - sM);
                  const progress = Math.min(100, Math.max(0, ((diff + 1) / p.installments) * 100));

                  return (
                    <Card key={p.id} title={p.name} subtitle={`${p.installments} cuotas de ${formatMoney(p.totalAmount / p.installments)}`}>
                      <div className="space-y-5 mt-6">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Monto Total</span>
                            <p className="text-xl font-black">{formatMoney(p.totalAmount)}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-blue-500">{Math.max(0, diff + 1)}/{p.installments}</span>
                          </div>
                        </div>

                        <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setViewingInstallment(p)}>Detalle</Button>
                          <Button variant="danger" size="sm" className="rounded-xl w-10 px-0" onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Eliminar compra?')) {
                              deleteInstallment(p.id);
                            }
                          }}><i className="fas fa-trash"></i></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
