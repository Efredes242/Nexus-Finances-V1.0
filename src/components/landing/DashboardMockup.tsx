
import React, { useState, useMemo } from 'react';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Download,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { MOCK_TRANSACTIONS } from './constants';
import { Transaction } from './types';

const DashboardMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState('movimientos');
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS as Transaction[]);
  const [cards, setCards] = useState([
    { id: '1', name: 'Visa Gold', limit: 500000, current: 125000, closing: '12/03' },
    { id: '2', name: 'Mastercard Platinum', limit: 1000000, current: 45000, closing: '28/02' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTx, setNewTx] = useState({ concept: '', amount: '', type: 'expense' as 'income' | 'expense' });
  const [newCard, setNewCard] = useState({ name: '', limit: '' });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.concept || !newTx.amount) return;

    const tx: Transaction = {
      id: Date.now().toString(),
      concept: newTx.concept,
      amount: parseFloat(newTx.amount),
      type: newTx.type,
      label: newTx.type === 'income' ? 'Ingresos' : 'Gastos Variables',
      method: 'Tarjeta',
      date: new Date().toLocaleDateString('es-ES')
    };

    setTransactions([tx, ...transactions]);
    setIsAdding(false);
    setNewTx({ concept: '', amount: '', type: 'expense' });
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.name || !newCard.limit) return;
    setCards([...cards, {
      id: Date.now().toString(),
      name: newCard.name,
      limit: parseFloat(newCard.limit),
      current: 0,
      closing: '30/xx'
    }]);
    setIsAdding(false);
    setNewCard({ name: '', limit: '' });
  };

  const removeTx = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const removeCard = (id: string) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 uppercase font-bold">Balance Total</p>
              <p className="text-2xl font-black text-white mt-1">${stats.balance.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 uppercase font-bold">Ingresos</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">+${stats.income.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 uppercase font-bold">Gastos</p>
              <p className="text-xl font-bold text-rose-400 mt-1">-${stats.expense.toLocaleString()}</p>
            </div>
          </div>
          <div className="p-8 border border-white/10 rounded-2xl bg-white/[0.02] text-center">
            <p className="text-slate-500 italic">Más gráficos disponibles en la versión completa</p>
          </div>
        </div>
      )
    }

    if (activeTab === 'tarjetas') {
      return (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Mis Tarjetas</h3>
            <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
              <Plus size={14} /> Agregar
            </button>
          </div>

          {isAdding && (
            <div className="mb-6 p-4 bg-purple-600/10 border border-purple-500/20 rounded-xl">
              <form onSubmit={handleAddCard} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nombre</label>
                  <input className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={newCard.name} onChange={e => setNewCard({ ...newCard, name: e.target.value })} placeholder="Ej: Visa Black" />
                </div>
                <div className="w-32">
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Límite</label>
                  <input type="number" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={newCard.limit} onChange={e => setNewCard({ ...newCard, limit: e.target.value })} placeholder="$" />
                </div>
                <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold h-[34px]">Guardar</button>
                <button type="button" onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white p-2"><X size={16} /></button>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {cards.map(card => (
              <div key={card.id} className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 rounded-xl relative group">
                <button onClick={() => removeCard(card.id)} className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                <div className="flex justify-between items-start mb-8">
                  <span className="font-bold text-white tracking-wide">{card.name}</span>
                  <i className="fas fa-wifi text-slate-600"></i>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Consumo Actual</p>
                    <p className="text-lg font-bold text-white">${card.current.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Límite</p>
                    <p className="text-sm text-slate-400">${card.limit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Default: Movimientos
    return (
      <div className="flex flex-col h-full animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Registro de Transacciones</h3>
            <p className="text-xs text-slate-500">Prueba añadiendo movimientos reales (Borrable)</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-blue-500 outline-none w-full"
              />
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>
        </div>

        {/* Modal addition (simulated inline) */}
        {isAdding && (
          <div className="mb-4 p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-white">Nueva Transacción</h4>
              <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddTx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                autoFocus
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 sm:col-span-2"
                placeholder="Concepto (ej: Pago de Luz)"
                value={newTx.concept}
                onChange={e => setNewTx({ ...newTx, concept: e.target.value })}
              />
              <input
                type="number"
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                placeholder="Monto"
                value={newTx.amount}
                onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
              />
              <select
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                value={newTx.type}
                onChange={e => setNewTx({ ...newTx, type: e.target.value as any })}
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-xs sm:col-span-4 hover:bg-blue-500 transition-colors">
                Registrar
              </button>
            </form>
          </div>
        )}

        <div className="overflow-hidden border border-white/5 rounded-2xl flex-1 bg-slate-900/30">
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-900 text-slate-500 font-bold uppercase tracking-tighter border-b border-white/5 z-10">
                <tr>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3 hidden sm:table-cell text-right">Monto</th>
                  <th className="px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white group-hover:text-blue-400 transition-colors">{t.concept}</span>
                        <span className="text-[10px] text-slate-500">{t.date} • {t.label}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-right font-bold hidden sm:table-cell ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => removeTx(t.id)}
                        className="text-slate-600 hover:text-rose-500 transition-colors p-2 opacity-0 group-hover:opacity-100"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-500 italic">No se encontraron movimientos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>

      <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[500px]">
        {/* Sidebar Mini */}
        <div className="w-full md:w-56 border-r border-white/5 bg-slate-900/50 p-4 hidden md:flex flex-col">
          <div className="flex items-center gap-2 mb-10 px-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold">N</div>
            <span className="text-xs font-bold text-white tracking-widest uppercase">Nexus</span>
          </div>
          <div className="space-y-1 flex-1">
            {['dashboard', 'movimientos', 'tarjetas', 'metas'].map((item) => (
              <div
                key={item}
                onClick={() => setActiveTab(item)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${activeTab === item ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
              >
                <div className={`w-3 h-3 rounded ${activeTab === item ? 'bg-blue-500' : 'bg-slate-700 opacity-50'}`}></div>
                <span className="capitalize">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto bg-white/5 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Tu Balance</p>
            <p className="text-sm font-bold text-white">${stats.balance.toLocaleString()}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-slate-950/40 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DashboardMockup;
