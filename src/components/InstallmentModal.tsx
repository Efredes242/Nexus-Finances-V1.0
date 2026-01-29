import React, { useState, useRef, useEffect } from 'react';
import { InstallmentPurchase, CategoryType } from '../types';
import { PREDEFINED_CARDS } from '../utils/helpers';

interface InstallmentModalProps {
  installment: InstallmentPurchase;
  onClose: () => void;
  onSave: (installment: InstallmentPurchase) => void;
  creditCards: string[];
  onAddCard: (card: string) => void;
  onDeleteCard: (card: string) => void;
  categories: Record<CategoryType, string[]>;
}

export const InstallmentModal: React.FC<InstallmentModalProps> = ({
  installment,
  onClose,
  onSave,
  creditCards,
  onAddCard,
  onDeleteCard,
  categories
}) => {
  const [localInstallment, setLocalInstallment] = useState<InstallmentPurchase>(installment);
  const [isCardSelectorOpen, setIsCardSelectorOpen] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardType, setNewCardType] = useState(PREDEFINED_CARDS[0]);
  const [newCardEntity, setNewCardEntity] = useState('');
  const cardSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalInstallment(installment);
  }, [installment]);

  // Handle click outside to close selector
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardSelectorRef.current && !cardSelectorRef.current.contains(event.target as Node)) {
        setIsCardSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    if (!localInstallment.name || localInstallment.totalAmount <= 0) return;
    onSave(localInstallment);
  };

  const handleAddNewCard = () => {
      if (newCardEntity.trim()) {
          const newCardName = `${newCardType} ${newCardEntity.trim()}`;
          onAddCard(newCardName);
          setLocalInstallment({ ...localInstallment, cardName: newCardName });
          setIsAddingCard(false);
          setIsCardSelectorOpen(false);
          setNewCardEntity('');
      }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10"
        >
          <i className="fas fa-times text-xl"></i>
        </button>

        <div className="p-4 lg:p-6 pb-0 shrink-0">
          <h3 className="text-xl font-black text-white">
            {installment.name ? 'Editar Financiación' : 'Nueva Financiación'}
          </h3>
          <p className="text-slate-500 text-sm font-medium">Gestiona tus compras en cuotas</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 pt-4 space-y-4 pb-4">
            {/* NAME INPUT */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                <input 
                    autoFocus
                    className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-bold text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-700"
                    placeholder="Ej: Televisor Samsung 55"
                    value={localInstallment.name}
                    onChange={e => setLocalInstallment({...localInstallment, name: e.target.value})}
                />
            </div>

            {/* AMOUNT & INSTALLMENTS */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto Total</label>
                    <input 
                        type="number" 
                        className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-black text-emerald-400 outline-none"
                        value={localInstallment.totalAmount || ''}
                        onChange={e => setLocalInstallment({...localInstallment, totalAmount: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cuotas</label>
                    <input 
                        type="number" 
                        className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-black text-blue-400 outline-none text-center"
                        value={localInstallment.installments || ''}
                        onChange={e => setLocalInstallment({...localInstallment, installments: parseInt(e.target.value) || 1})}
                        placeholder="1"
                    />
                </div>
            </div>

            {/* CARD SELECTOR (NEW) */}
            <div className="space-y-1" ref={cardSelectorRef}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tarjeta (Opcional)</label>
                
                {!isAddingCard ? (
                    <div className="relative">
                        <div 
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white cursor-pointer flex justify-between items-center hover:border-blue-500 transition-all"
                            onClick={() => setIsCardSelectorOpen(!isCardSelectorOpen)}
                        >
                            <span className="font-bold">{localInstallment.cardName || 'Seleccionar Tarjeta...'}</span>
                            <i className={`fas fa-chevron-down text-xs text-slate-500 transition-transform ${isCardSelectorOpen ? 'rotate-180' : ''}`}></i>
                        </div>
                        
                        {isCardSelectorOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto">
                                <div 
                                    className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 border-b border-white/5"
                                    onClick={() => {
                                        setLocalInstallment({...localInstallment, cardName: undefined});
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
                                                setLocalInstallment({...localInstallment, cardName: c});
                                                setIsCardSelectorOpen(false);
                                            }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-blue-400">
                                                <i className="fas fa-credit-card text-xs"></i>
                                            </div>
                                            <span className="font-bold text-sm text-white">{c}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`¿Estás seguro de eliminar la tarjeta ${c}?`)) {
                                                    onDeleteCard(c);
                                                    if (localInstallment.cardName === c) {
                                                        setLocalInstallment({...localInstallment, cardName: undefined});
                                                    }
                                                }
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="Eliminar tarjeta"
                                        >
                                            <i className="fas fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                ))}
                                <div 
                                    className="px-4 py-3 bg-blue-600/10 hover:bg-blue-600/20 cursor-pointer flex items-center gap-3 text-blue-400 transition-colors"
                                    onClick={() => {
                                        setIsAddingCard(true);
                                        setIsCardSelectorOpen(false);
                                        setLocalInstallment({...localInstallment, cardName: ''});
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
                                    value={newCardType}
                                    onChange={e => setNewCardType(e.target.value)}
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
                                value={newCardEntity}
                                onChange={e => setNewCardEntity(e.target.value)}
                            />
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 mt-2">
                             <button 
                                onClick={() => setIsAddingCard(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAddNewCard}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Crear Tarjeta
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Primera Cuota</label>
                    <input 
                        type="month"
                        className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-bold text-white outline-none"
                        value={localInstallment.startDate}
                        onChange={e => setLocalInstallment({...localInstallment, startDate: e.target.value})}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</label>
                    <div className="relative">
                        <select 
                            className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-black text-white outline-none appearance-none"
                            value={localInstallment.category}
                            onChange={e => {
                                const newCat = e.target.value as CategoryType;
                                const newTag = categories[newCat]?.[0] || '';
                                setLocalInstallment({...localInstallment, category: newCat, tag: newTag});
                            }}
                        >
                            {Object.values(CategoryType).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                            <i className="fas fa-chevron-down text-xs"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* TAG */}
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Etiqueta</label>
                <input 
                    className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-bold text-white outline-none"
                    placeholder="Ej: Electro, Viaje, etc."
                    value={localInstallment.tag}
                    onChange={e => setLocalInstallment({...localInstallment, tag: e.target.value})}
                />
            </div>
            </div>
            
             <div className="p-4 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 flex gap-3 mt-auto shrink-0 z-20">
                <button 
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl font-black text-slate-400 hover:bg-white/5 transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Guardar
                </button>
            </div>

      </div>
    </div>
  );
};
