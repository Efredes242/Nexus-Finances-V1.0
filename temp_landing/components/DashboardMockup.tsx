
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
import { MOCK_TRANSACTIONS } from '../constants';
import { Transaction } from '../types';

const DashboardMockup: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS as Transaction[]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTx, setNewTx] = useState({ concept: '', amount: '', type: 'expense' as 'income' | 'expense' });

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

  const handleAdd = (e: React.FormEvent) => {
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

  const removeTx = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
      
      <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        {/* Sidebar Mini */}
        <div className="w-full md:w-56 border-r border-white/5 bg-slate-900/50 p-4 hidden md:flex flex-col">
          <div className="flex items-center gap-2 mb-10 px-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold">N</div>
            <span className="text-xs font-bold text-white tracking-widest uppercase">Nexus</span>
          </div>
          <div className="space-y-1 flex-1">
            {['Dashboard', 'Movimientos', 'Tarjetas', 'Metas'].map((item, i) => (
              <div 
                key={item} 
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${i === 1 ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
              >
                <div className="w-4 h-4 bg-slate-700 rounded opacity-30"></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto bg-white/5 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Tu Balance</p>
            <p className="text-sm font-bold text-white">${stats.balance.toLocaleString()}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-slate-950/40 p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Registro de Transacciones</h3>
              <p className="text-xs text-slate-500">Prueba la funcionalidad añadiendo movimientos reales</p>
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
            <div className="mb-8 p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-white">Nueva Transacción</h4>
                <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
              </div>
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input 
                  autoFocus
                  className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 sm:col-span-2"
                  placeholder="Concepto (ej: Pago de Luz)"
                  value={newTx.concept}
                  onChange={e => setNewTx({...newTx, concept: e.target.value})}
                />
                <input 
                  type="number"
                  className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  placeholder="Monto"
                  value={newTx.amount}
                  onChange={e => setNewTx({...newTx, amount: e.target.value})}
                />
                <select 
                  className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  value={newTx.type}
                  onChange={e => setNewTx({...newTx, type: e.target.value as any})}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
                <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-xs sm:col-span-4 hover:bg-blue-500 transition-colors">
                  Registrar Movimiento
                </button>
              </form>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ingresos</p>
                <p className="text-lg font-bold text-emerald-400">${stats.income.toLocaleString()}</p>
              </div>
              <ArrowUpCircle className="text-emerald-500/50 w-8 h-8" />
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Gastos</p>
                <p className="text-lg font-bold text-rose-400">${stats.expense.toLocaleString()}</p>
              </div>
              <ArrowDownCircle className="text-rose-500/50 w-8 h-8" />
            </div>
          </div>

          <div className="overflow-hidden border border-white/5 rounded-2xl">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-900 text-slate-500 font-bold uppercase tracking-tighter border-b border-white/5 z-10">
                  <tr>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3 hidden sm:table-cell text-right">Monto</th>
                    <th className="px-4 py-3 text-center">Acción</th>
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
                          className="text-slate-600 hover:text-rose-500 transition-colors p-2"
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
      </div>
    </div>
  );
};

export default DashboardMockup;
