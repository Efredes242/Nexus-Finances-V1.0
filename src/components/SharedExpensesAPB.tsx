
import React, { useState, useMemo } from 'react';

// Icons (inline to avoid dependency issues)
const ArrowUpRight = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
);

const ArrowDownLeft = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
    </svg>
);

const ChevronDown = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

enum TransactionType {
    OWE = 'OWE',
    RECEIVE = 'RECEIVE'
}

interface SharedExpenseItem {
    id: string;
    description: string;
    date: string;
    amount: number;
    currentInstallment: number;
    totalInstallments: number;
}

interface NettedPerson {
    personName: string;
    oweTotal: number;
    receiveTotal: number;
    netAmount: number;
    items: (SharedExpenseItem & { type: TransactionType })[];
    dueDate: string;
}

interface SharedExpensesAPBProps {
    sharedExpenses: any[]; // Virtual shared expenses from App.tsx
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(Math.abs(amount));
};

export const SharedExpensesAPB: React.FC<SharedExpensesAPBProps> = ({ sharedExpenses }) => {
    const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());

    // Transform virtual shared expenses into netted balances per person
    const nettedBalances = useMemo(() => {
        const peopleMap: Record<string, NettedPerson> = {};

        sharedExpenses.forEach(expense => {
            // Extract person name from entry.name (e.g., "Netflix (Pago a Leandro)" or "Netflix (Cobro a Pepe)")
            const nameMatch = expense.name?.match(/\((Pago|Cobro) a ([^)]+)\)/);
            const personName = nameMatch ? nameMatch[2].trim() : 'Desconocido';

            if (!peopleMap[personName]) {
                peopleMap[personName] = {
                    personName,
                    oweTotal: 0,
                    receiveTotal: 0,
                    netAmount: 0,
                    items: [],
                    dueDate: expense.date || ''
                };
            }

            const person = peopleMap[personName];
            // In App.tsx: positive amount = I owe them, negative amount = they owe me
            const isOwe = expense.amount > 0;
            const absAmount = Math.abs(expense.amount);

            if (isOwe) person.oweTotal += absAmount;
            else person.receiveTotal += absAmount;

            person.items.push({
                id: expense.id,
                description: expense.name,
                date: expense.date,
                amount: absAmount,
                currentInstallment: expense.currentInstallment || 1,
                totalInstallments: expense.totalInstallments || 1,
                type: isOwe ? TransactionType.OWE : TransactionType.RECEIVE
            });

            // Net: if they owe you more than you owe them = positive (you receive)
            // if you owe them more than they owe you = negative (you owe)
            person.netAmount = person.receiveTotal - person.oweTotal;
        });

        return Object.values(peopleMap);
    }, [sharedExpenses]);

    const togglePerson = (name: string) => {
        const newExpanded = new Set(expandedPeople);
        if (newExpanded.has(name)) newExpanded.delete(name);
        else newExpanded.add(name);
        setExpandedPeople(newExpanded);
    };

    if (nettedBalances.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 text-sm">No hay gastos compartidos en este período</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {nettedBalances.map((person) => {
                const isOpen = expandedPeople.has(person.personName);
                // Positive netAmount = they owe you more (RECEIVE), Negative = you owe them more (OWE)
                const status = person.netAmount > 0 ? 'RECEIVE' : 'OWE';
                const finalAmount = Math.abs(person.netAmount);

                return (
                    <div key={person.personName} className="group">
                        {/* Module Header */}
                        <div
                            onClick={() => togglePerson(person.personName)}
                            className={`cursor-pointer relative z-10 w-full flex items-center transition-all duration-300 border rounded-3xl overflow-hidden shadow-xl
                ${status === 'OWE' ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15' : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'}
              `}
                            style={{ minHeight: '100px' }}
                        >
                            {/* Icon Section */}
                            <div className={`h-full w-20 md:w-24 flex items-center justify-center border-r border-white/5 ${status === 'OWE' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {status === 'OWE' ? <ArrowUpRight className="w-8 h-8 md:w-10 md:h-10" /> : <ArrowDownLeft className="w-8 h-8 md:w-10 md:h-10" />}
                            </div>

                            {/* Calculation Breakdown - Hidden on Mobile */}
                            <div className="hidden md:flex flex-col items-center px-6 lg:px-12 border-r border-white/5 h-full justify-center gap-1 bg-black/10">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Balance Anterior</p>
                                <div className="flex items-center gap-3 text-sm font-mono font-bold">
                                    <div className="flex flex-col items-end">
                                        <span className="text-emerald-400">+{formatCurrency(person.receiveTotal)}</span>
                                        <span className="text-rose-400">-{formatCurrency(person.oweTotal)}</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-700 mx-2" />
                                    <div className="text-xs text-slate-400 font-normal italic">Compensado</div>
                                </div>
                            </div>

                            {/* Final Result */}
                            <div className="flex-1 px-4 md:px-12 text-center py-2">
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Resultado Final</p>
                                <div className={`text-sm md:text-3xl font-black tracking-tighter ${status === 'OWE' ? 'text-rose-400' : 'text-emerald-400'} flex flex-col md:flex-row items-center justify-center gap-1 md:gap-3`}>
                                    <span className="uppercase text-center leading-tight">
                                        {status === 'OWE'
                                            ? `EZEQUIEL TIENE QUE PAGAR`
                                            : `${person.personName.toUpperCase()} TE TIENE QUE PAGAR`}
                                    </span>
                                    <span className="font-mono text-lg md:text-3xl">{formatCurrency(finalAmount)}</span>
                                    {status === 'RECEIVE' && (
                                        <div className="group/tooltip relative hidden md:block" title="Este ingreso se refleja automáticamente en Ingresos">
                                            <svg className="w-5 h-5 text-slate-500 hover:text-teal-400 transition-colors cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Toggle Icon */}
                            <div className="px-4 md:px-8 h-full flex items-center border-l border-white/5 bg-white/5">
                                <ChevronDown className={`w-6 h-6 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {/* Expandable Details */}
                        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-height-[1000px] mt-4 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {person.items.map((item, idx) => (
                                    <div key={`${item.id}-${idx}`} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between group/item hover:border-slate-600 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-10 rounded-full ${item.type === TransactionType.OWE ? 'bg-rose-500/50' : 'bg-emerald-500/50'}`} />
                                            <div>
                                                <h4 className="font-bold text-slate-100 text-sm truncate max-w-[150px]">{item.description}</h4>
                                                <p className="text-[10px] text-slate-500 font-medium">Cuota {item.currentInstallment} de {item.totalInstallments} • {item.date}</p>
                                            </div>
                                        </div>
                                        <span className={`font-black text-sm ${item.type === TransactionType.OWE ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {item.type === TransactionType.OWE ? '-' : '+'}{formatCurrency(item.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Legend */}
            <div className="flex gap-8 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-t border-slate-900 pt-8 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500" /> Dinero que sale de tu bolsillo
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500" /> Dinero que entra a tu bolsillo
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-white/10" /> Se muestra el Neto Final
                </div>
            </div>
        </div>
    );
};
