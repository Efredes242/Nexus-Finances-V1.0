import React, { useState, useEffect, useRef } from 'react';
import { BudgetEntry, CategoryType, PaymentMethod, SavingsGoal } from '../types';
import { PREDEFINED_CARDS } from '../utils/helpers';
import { Card } from './Card';
import { Button } from './Button';

interface EntryModalProps {
  entry: BudgetEntry;
  onClose: () => void;
  onSave: (entry: BudgetEntry, newCard?: string, newTag?: string) => void;
  categories: Record<CategoryType, string[]>;
  creditCards: string[];
  goals: SavingsGoal[];
  onDeleteCard?: (card: string) => void;
}

const CARD_FINANCING_PLANS: Record<string, string[]> = {
  'NARANJA X': ['1 Pago', 'Plan Z - 1 Cuota Cero Interés', 'Plan Z - 2 Cuotas Cero Interés', 'Plan Z - 3 Cuotas Cero Interés', 'Plan 6', 'Plan 12', 'Plan 18'],
  'CORDOBESA': ['1 Pago', '4 Cuotas (Alimentos/Farmacias)', '12 Cuotas (Construcción/Etc)', '20 Cuotas', '24 Cuotas'],
  'TARJETA SOL': ['1 Pago', '3 Cuotas Fijas', '6 Cuotas Fijas', '12 Cuotas Fijas'],
  'VISA': ['1 Pago', 'Plan V', 'Cuota Simple 3', 'Cuota Simple 6', 'Cuota Simple 9', 'Cuota Simple 12'],
  'MASTERCARD': ['1 Pago', 'Mastercard Cuotas', 'Cuota Simple 3', 'Cuota Simple 6', 'Cuota Simple 9', 'Cuota Simple 12'],
  'AMERICAN EXPRESS': ['1 Pago', 'Express Plan', 'Cuota Simple 3', 'Cuota Simple 6', 'Cuota Simple 9', 'Cuota Simple 12'],
  'UALA': ['1 Pago', 'Cuotificación 1 Mes', 'Cuotificación 3 Meses', 'Cuotificación 5 Meses'],
  'MERCADO PAGO': ['1 Pago', 'Mercado Crédito - 1 Cuota', 'Mercado Crédito - 3 Cuotas', 'Mercado Crédito - 6 Cuotas', 'Mercado Crédito - 9 Cuotas', 'Mercado Crédito - 12 Cuotas', '3 Cuotas Sin Interés (MODO)', '6 Cuotas Sin Interés (MODO)'],
  'CABAL': ['1 Pago', 'Cuota Simple 3', 'Cuota Simple 6', 'Cuota Simple 9', 'Cuota Simple 12'],
  'LEMON': ['1 Pago'],
  '365': ['1 Pago'],
  'SHOPPING': ['1 Pago'],
  'CENCOSUD': ['1 Pago', '3 Cuotas', '6 Cuotas', '12 Cuotas'],
  'ARGENCARD': ['1 Pago']
};

export const EntryModal: React.FC<EntryModalProps> = ({
  entry,
  onClose,
  onSave,
  categories,
  creditCards,
  goals,
  onDeleteCard
}) => {
  const [localEntry, setLocalEntry] = useState<BudgetEntry>({
    ...entry,
    currency: entry.currency || 'ARS'
  });
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardType, setCardType] = useState(PREDEFINED_CARDS[0]);
  const [cardEntity, setCardEntity] = useState('');

  // Auto-calculate ARS amount when foreign values change
  useEffect(() => {
    if (localEntry.currency && localEntry.currency !== 'ARS') {
      const original = localEntry.originalAmount || 0;
      const rate = localEntry.exchangeRateActual || localEntry.exchangeRateEstimated || 0;
      if (original && rate) {
        // Only update if the calculated amount is different to avoid unnecessary renders/loops
        const calculated = original * rate;
        if (Math.abs(calculated - localEntry.amount) > 0.01) {
          setLocalEntry(prev => ({ ...prev, amount: calculated }));
        }
      }
    }
  }, [localEntry.originalAmount, localEntry.exchangeRateEstimated, localEntry.exchangeRateActual, localEntry.currency]);

  // Tag creation state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Determine available plans based on selected card
  const getAvailablePlans = () => {
    let type = '';
    if (isAddingCard) {
      type = cardType;
    } else if (localEntry.cardName) {
      type = PREDEFINED_CARDS.find(t => localEntry.cardName?.startsWith(t)) || '';
    }
    return CARD_FINANCING_PLANS[type] || ['1 Pago', 'Cuota Simple 3', 'Cuota Simple 6', 'Cuota Simple 12'];
  };

  const availablePlans = getAvailablePlans();

  // State for custom card selector
  const [isCardSelectorOpen, setIsCardSelectorOpen] = useState(false);
  const cardSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close card selector when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (cardSelectorRef.current && !cardSelectorRef.current.contains(event.target as Node)) {
        setIsCardSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // If we switch to CREDIT and there are no cards, automatically show add card mode
    if (localEntry.paymentMethod === PaymentMethod.CREDIT && (!creditCards || creditCards.length === 0)) {
      setIsAddingCard(true);
    }
  }, [localEntry.paymentMethod, creditCards]);

  const handleSave = () => {
    let finalTag = localEntry.tag;

    if (isAddingTag) {
      if (!newTag.trim()) {
        alert("Por favor ingresa un nombre para la nueva etiqueta");
        return;
      }
      finalTag = newTag.trim();
    }

    if (localEntry.paymentMethod === PaymentMethod.CREDIT && isAddingCard) {
      if (!cardEntity.trim()) {
        alert("Por favor ingresa la entidad de la tarjeta (ej. Galicia, Santander)");
        return;
      }
      const newCardName = `${cardType} ${cardEntity.trim().toUpperCase()}`;
      const updatedEntry = {
        ...localEntry,
        tag: finalTag,
        cardName: newCardName,
        financingPlan: localEntry.financingPlan || '1 Pago'
      };
      onSave(updatedEntry, newCardName, isAddingTag ? finalTag : undefined);
    } else {
      if (localEntry.paymentMethod === PaymentMethod.CREDIT) {
        const updatedEntry = {
          ...localEntry,
          tag: finalTag,
          financingPlan: localEntry.financingPlan || '1 Pago'
        };
        onSave(updatedEntry, undefined, isAddingTag ? finalTag : undefined);
      } else {
        onSave({ ...localEntry, tag: finalTag }, undefined, isAddingTag ? finalTag : undefined);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card title="Detalle del Movimiento" className="w-full max-w-xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col max-h-[90vh]" noPadding>
        <div className="flex flex-col h-full overflow-hidden min-h-0 relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* 1. MONEDA Y MONTOS */}
              <div className="col-span-2 space-y-3 bg-slate-800/50 p-3 rounded-xl border border-white/5">
                <div className="flex gap-3">
                  <div className="w-1/3 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moneda</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-black text-white appearance-none"
                        value={localEntry.currency || 'ARS'}
                        onChange={e => setLocalEntry({ ...localEntry, currency: e.target.value })}
                      >
                        {['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                        <i className="fas fa-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>

                  {localEntry.currency !== 'ARS' ? (
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto {localEntry.currency}</label>
                      <input
                        autoFocus
                        type="number"
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none font-black text-green-400 text-lg"
                        value={localEntry.originalAmount || ''}
                        onChange={e => setLocalEntry({ ...localEntry, originalAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto ARS</label>
                      <input
                        autoFocus
                        type="number"
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none font-black text-blue-400 text-lg"
                        value={localEntry.amount || ''}
                        onChange={e => setLocalEntry({ ...localEntry, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                </div>

                {localEntry.currency !== 'ARS' && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cotiz. Estimada</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-sm font-bold text-slate-300"
                        placeholder="0.00"
                        value={localEntry.exchangeRateEstimated || ''}
                        onChange={e => setLocalEntry({ ...localEntry, exchangeRateEstimated: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cotiz. Real (Compra)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-sm font-bold text-white"
                        placeholder="0.00"
                        value={localEntry.exchangeRateActual || ''}
                        onChange={e => setLocalEntry({ ...localEntry, exchangeRateActual: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-2 space-y-1 pt-2 border-t border-white/5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Calculado (ARS)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900/50 rounded-xl p-3 border border-white/5 outline-none font-black text-blue-400 text-lg"
                        value={localEntry.amount || ''}
                        readOnly
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. FECHA y 3. ETIQUETA (Merged Row) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-bold text-white"
                  value={localEntry.date.split('T')[0]}
                  onChange={e => setLocalEntry({ ...localEntry, date: e.target.value })}
                />

                <div className="flex items-center gap-2 mt-2 pt-1 border-t border-white/5">
                  <input
                    type="checkbox"
                    id="isProvisional"
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                    checked={localEntry.is_provisional || false}
                    onChange={e => setLocalEntry({ ...localEntry, is_provisional: e.target.checked })}
                  />
                  <label htmlFor="isProvisional" className="text-xs font-bold text-amber-500 cursor-pointer select-none">
                    Marcas como Provisorio
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Etiqueta</label>
                {!isAddingTag ? (
                  <div className="relative">
                    <select
                      className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none uppercase text-xs font-black text-slate-300 appearance-none"
                      value={localEntry.tag}
                      onChange={e => {
                        if (e.target.value === 'ADD_NEW_TAG_MAGIC_VALUE') {
                          setIsAddingTag(true);
                          setNewTag('');
                        } else {
                          setLocalEntry({ ...localEntry, tag: e.target.value });
                        }
                      }}
                    >
                      <option value="">SELECCIONAR...</option>
                      {(categories[localEntry.category] && categories[localEntry.category].length > 0
                        ? categories[localEntry.category]
                        : (localEntry.category === CategoryType.INCOME ? ['Sueldo', 'Aguinaldo', 'Extras', 'Ventas', 'Inversiones', 'Regalos'] : [])
                      ).map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="ADD_NEW_TAG_MAGIC_VALUE" className="text-blue-400 font-bold">+ Nuevo...</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                      <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Nueva etiqueta..."
                      className="flex-1 bg-slate-900 rounded-xl p-3 border border-blue-500/50 outline-none font-bold text-white text-xs"
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                    />
                    <button
                      onClick={() => setIsAddingTag(false)}
                      className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. MÉTODO DE PAGO */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Método</label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-black text-slate-300 appearance-none"
                    value={localEntry.paymentMethod}
                    onChange={e => {
                      const method = e.target.value as PaymentMethod;
                      setLocalEntry({ ...localEntry, paymentMethod: method });
                      if (method !== PaymentMethod.CREDIT) {
                        setIsAddingCard(false);
                      }
                    }}
                  >
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>

              {/* CAMPOS EXTRA PARA AHORROS */}
              {localEntry.category === CategoryType.SAVINGS && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Destinar a Meta</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-black text-slate-300 appearance-none"
                        value={localEntry.goalId || ''}
                        onChange={e => setLocalEntry({ ...localEntry, goalId: e.target.value || undefined })}
                      >
                        <option value="">-- Opcional --</option>
                        {goals.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                        <i className="fas fa-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disponibilidad</label>
                    <input
                      type="date"
                      className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-bold text-white"
                      value={localEntry.maturityDate ? localEntry.maturityDate.split('T')[0] : ''}
                      onChange={e => setLocalEntry({ ...localEntry, maturityDate: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* SELECCIÓN DE TARJETA (SOLO SI ES CRÉDITO) */}
              {localEntry.paymentMethod === PaymentMethod.CREDIT && (
                <div className="col-span-2 space-y-2 bg-slate-800/50 p-3 rounded-xl border border-white/5">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-credit-card"></i> Configuración de Tarjeta
                  </label>

                  {!isAddingCard ? (
                    <div className="relative" ref={cardSelectorRef}>
                      <div
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white cursor-pointer flex justify-between items-center hover:border-blue-500 transition-all"
                        onClick={() => setIsCardSelectorOpen(!isCardSelectorOpen)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{localEntry.cardName || 'Seleccionar Tarjeta...'}</span>
                        </div>
                        <i className={`fas fa-chevron-down text-xs text-slate-500 transition-transform ${isCardSelectorOpen ? 'rotate-180' : ''}`}></i>
                      </div>

                      {isCardSelectorOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div
                            className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 border-b border-white/5"
                            onClick={() => {
                              setLocalEntry({ ...localEntry, cardName: undefined });
                              setIsCardSelectorOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                              <i className="fas fa-ban text-xs"></i>
                            </div>
                            <span className="font-bold text-sm text-slate-400">Sin Tarjeta / Otra</span>
                          </div>
                          {creditCards.map(c => (
                            <div
                              key={c}
                              className="px-4 py-3 hover:bg-blue-600/20 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-0 group"
                            >
                              <div
                                className="flex items-center gap-3 flex-1"
                                onClick={() => {
                                  setLocalEntry({ ...localEntry, cardName: c });
                                  setIsCardSelectorOpen(false);
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-blue-400">
                                  <i className="fas fa-credit-card text-xs"></i>
                                </div>
                                <span className="font-bold text-sm text-white">{c}</span>
                              </div>
                              {onDeleteCard && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`¿Estás seguro de eliminar la tarjeta ${c}?`)) {
                                      onDeleteCard(c);
                                    }
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                  title="Eliminar tarjeta"
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </button>
                              )}
                            </div>
                          ))}
                          <div
                            className="px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 cursor-pointer flex items-center gap-3 text-blue-400 transition-colors"
                            onClick={() => {
                              setIsAddingCard(true);
                              setIsCardSelectorOpen(false);
                              setLocalEntry({ ...localEntry, cardName: '' });
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <i className="fas fa-plus text-xs"></i>
                            </div>
                            <span className="font-bold text-sm">Nueva Tarjeta...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300 bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</label>
                        <div className="relative">
                          <select
                            className="w-full bg-slate-900 rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 outline-none text-sm font-bold text-white appearance-none"
                            value={cardType}
                            onChange={e => setCardType(e.target.value)}
                          >
                            {PREDEFINED_CARDS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                            <i className="fas fa-chevron-down text-xs"></i>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entidad</label>
                        <input
                          placeholder="Ej: Galicia"
                          className="w-full bg-slate-900 rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 outline-none text-sm font-bold text-white placeholder-slate-600"
                          value={cardEntity}
                          onChange={e => setCardEntity(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 mt-2">
                        {creditCards.length > 0 && (
                          <button
                            onClick={() => setIsAddingCard(false)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                        {/* El botón de 'Crear' se dispara implícitamente al Guardar todo el modal, 
                            pero aquí podríamos añadir un botón explícito si queremos confirmar solo la tarjeta.
                            Por ahora mantenemos el flujo original de EntryModal que valida al final.
                            Sin embargo, visualmente InstallmentModal tiene botones. 
                            En EntryModal, la tarjeta se crea AL GUARDAR EL MOVIMIENTO.
                            Para mantener consistencia visual, dejaremos solo cancelar si aplica.
                        */}
                      </div>
                    </div>
                  )}

                  {/* PLAN DE FINANCIACIÓN SELECTION */}
                  {(localEntry.cardName || isAddingCard) && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plan</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-900 rounded-lg px-3 py-2 border border-white/10 focus:border-blue-500 outline-none text-xs font-bold text-white appearance-none"
                          value={localEntry.financingPlan || '1 Pago'}
                          onChange={e => setLocalEntry({ ...localEntry, financingPlan: e.target.value })}
                        >
                          {availablePlans.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                          <i className="fas fa-chevron-down text-[10px]"></i>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. DESCRIPCIÓN (Last, as requested) */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                <input
                  className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none font-bold text-white transition-all text-sm"
                  value={localEntry.name}
                  onChange={e => setLocalEntry({ ...localEntry, name: e.target.value })}
                  placeholder="Detalle..."
                />
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 mt-auto shrink-0 z-20">
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl py-3 text-sm" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1 rounded-xl py-3 text-sm" onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
