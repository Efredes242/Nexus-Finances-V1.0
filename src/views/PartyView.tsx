
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Plus, Users, DollarSign, Calendar, UserPlus } from 'lucide-react';
// ExpenseModal import removed as we implemented it inline


export const PartyView: React.FC<{ user: any }> = ({ user }) => {
    const [parties, setParties] = useState<any[]>([]);
    const [selectedParty, setSelectedParty] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal States
    const [showCreateParty, setShowCreateParty] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [showAddExpense, setShowAddExpense] = useState(false);

    // Form Inputs
    const [newPartyName, setNewPartyName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');

    useEffect(() => {
        loadParties();
    }, []);

    useEffect(() => {
        if (selectedParty) {
            loadPartyDetails(selectedParty.id);
        }
    }, [selectedParty]);

    const loadParties = async () => {
        try {
            const data = await api.getParties();
            console.log("Parties data:", data);
            if (Array.isArray(data)) {
                setParties(data);
            } else if (data && Array.isArray(data.results)) {
                setParties(data.results); // Handle D1 default format
            } else {
                setParties([]);
            }
        } catch (e) {
            console.error("Error loading parties:", e);
            setParties([]);
        }
    };

    const loadPartyDetails = async (id: string) => {
        setLoading(true);
        try {
            const data = await api.getPartyDetails(id);
            // Check expenses
            if (data && Array.isArray(data.expenses)) {
                setExpenses(data.expenses);
            } else if (data && data.expenses && Array.isArray(data.expenses.results)) {
                setExpenses(data.expenses.results);
            } else {
                setExpenses([]);
            }

            // Check members
            if (data && Array.isArray(data.members)) {
                setMembers(data.members);
            } else if (data && data.members && Array.isArray(data.members.results)) {
                setMembers(data.members.results);
            } else {
                setMembers([]);
            }
        } catch (e) {
            console.error(e);
            setExpenses([]);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateParty = async () => {
        if (!newPartyName) return;
        try {
            await api.createParty(newPartyName);
            setNewPartyName('');
            setShowCreateParty(false);
            loadParties();
        } catch (e) {
            alert("Error al crear grupo");
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail || !selectedParty) return;
        try {
            await api.inviteToParty(selectedParty.id, inviteEmail);
            alert(`Invitación enviada a ${inviteEmail}`);
            setInviteEmail('');
            setShowInvite(false);
        } catch (e) {
            alert("Error al invitar usuario");
        }
    };

    const handleAddExpense = async (data: any) => {
        if (!selectedParty) return;
        // Transform standard budget form data to party expense data
        // We'll need a simplified form ideally, but for now let's assume simple payload
        try {
            await api.addPartyExpense(selectedParty.id, {
                description: data.name,
                amount: Number(data.amount),
                date: data.date,
                category: data.category,
                participants: members.map(m => m.id) // Default split among all members for v1
            });
            setShowAddExpense(false);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al agregar gasto");
        }
    };

    const calculateBalances = () => {
        // Balances calculation logic
        // Total spent by each user
        const spentByUser: Record<string, number> = {};
        let totalSpent = 0;

        expenses.forEach(e => {
            spentByUser[e.payer_id] = (spentByUser[e.payer_id] || 0) + e.amount;
            totalSpent += e.amount;
        });

        // Split equally (simple version)
        const sharePerPerson = totalSpent / (members.length || 1);

        const balances = members.map(m => ({
            ...m,
            paid: spentByUser[m.id] || 0,
            share: sharePerPerson,
            balance: (spentByUser[m.id] || 0) - sharePerPerson // Positive = They are owed money. Negative = They owe money.
        }));

        return balances;
    };

    const balances = calculateBalances();

    return (
        <div className="p-6 text-white space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Gastos Compartidos
                </h2>
                {!selectedParty && (
                    <Button onClick={() => setShowCreateParty(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> Crear Grupo
                    </Button>
                )}
            </div>

            {/* List of Parties */}
            {!selectedParty ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parties.map(party => (
                        <Card key={party.id} className="cursor-pointer hover:border-blue-500/50 transition-all group" onClick={() => setSelectedParty(party)}>
                            <div className="flex items-center gap-4">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:scale-110 transition-transform">
                                    <Users className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{party.name}</h3>
                                    <p className="text-gray-400 text-sm">Creado por mí</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                    {parties.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">No tienes grupos de gastos compartidos.</p>
                            <Button onClick={() => setShowCreateParty(true)} className="mt-4 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400">
                                Crear mi primer grupo
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white pl-0" onClick={() => setSelectedParty(null)}>
                        ← Volver a mis grupos
                    </Button>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* LEFT COLUMN: Summary & Members */}
                        <div className="md:w-1/3 space-y-6">
                            <Card className="bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
                                <h3 className="text-2xl font-bold mb-1">{selectedParty.name}</h3>
                                <p className="text-gray-400 text-sm mb-6">Resumen de Balances</p>

                                <div className="space-y-4">
                                    {balances.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                                                    {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{m.username || m.email}</p>
                                                    <p className="text-xs text-gray-500">Pagó: ${m.paid.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className={`text-right font-bold ${m.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {m.balance >= 0 ? 'Le deben' : 'Debe'}<br />
                                                ${Math.abs(m.balance).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Button onClick={() => setShowInvite(true)} className="w-full mt-6 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30">
                                    <UserPlus className="w-4 h-4 mr-2" /> Invitar Amigo
                                </Button>
                            </Card>
                        </div>

                        {/* RIGHT COLUMN: Expenses List */}
                        <div className="md:w-2/3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Historial de Gastos</h3>
                                <Button onClick={() => setShowAddExpense(true)} className="bg-emerald-600 hover:bg-emerald-700">
                                    <Plus className="w-4 h-4 mr-2" /> Agregar Gasto
                                </Button>
                            </div>

                            {loading ? (
                                <div className="text-center py-10">Cargando...</div>
                            ) : expenses.length === 0 ? (
                                <div className="text-center py-20 bg-white/5 rounded-2xl">
                                    <p className="text-gray-400">Aún no hay gastos en este grupo.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {expenses.map(expense => (
                                        <Card key={expense.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-full bg-blue-500/20 text-blue-400">
                                                    <DollarSign className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold">{expense.description}</p>
                                                    <p className="text-sm text-gray-400">
                                                        Pagado por {members.find(m => m.id === expense.payer_id)?.username || 'Alguien'} • {new Date(expense.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-white">${expense.amount.toLocaleString()}</p>
                                                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">{expense.category || 'General'}</span>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            {showCreateParty && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#1e293b]">
                        <h3 className="text-xl font-bold mb-4">Crear Nuevo Grupo</h3>
                        <input
                            type="text"
                            placeholder="Nombre del grupo (ej: Vacaciones)"
                            className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white mb-6 focus:border-blue-500 outline-none"
                            value={newPartyName}
                            onChange={e => setNewPartyName(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setShowCreateParty(false)}>Cancelar</Button>
                            <Button onClick={handleCreateParty} className="bg-blue-600">Crear</Button>
                        </div>
                    </Card>
                </div>
            )}

            {showInvite && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#1e293b]">
                        <h3 className="text-xl font-bold mb-4">Invitar a {selectedParty?.name}</h3>
                        <p className="text-gray-400 text-sm mb-4">Ingresa el email de la persona. Debe tener cuenta en Nexus Finance.</p>
                        <input
                            type="email"
                            placeholder="Email del usuario (ej: amigo@gmail.com)"
                            className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white mb-6 focus:border-purple-500 outline-none"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancelar</Button>
                            <Button onClick={handleInvite} className="bg-purple-600">Enviar Invitación</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Simplified Expense Modal reuse or custom */}
            {/* For now reusing concept, in real implementation we might pass props to ExpenseModal or build a small one here */}
            {showAddExpense && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#1e293b]">
                        <h3 className="text-xl font-bold mb-4">Agregar Gasto Compartido</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400">Descripción</label>
                                <input id="desc" type="text" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white" />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Monto</label>
                                <input id="amount" type="number" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white" />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Categoría</label>
                                <select id="cat" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white">
                                    <option value="Comida">Comida</option>
                                    <option value="Transporte">Transporte</option>
                                    <option value="Hospedaje">Hospedaje</option>
                                    <option value="Varios">Varios</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={() => setShowAddExpense(false)}>Cancelar</Button>
                            <Button onClick={() => {
                                const desc = (document.getElementById('desc') as HTMLInputElement).value;
                                const amt = (document.getElementById('amount') as HTMLInputElement).value;
                                const cat = (document.getElementById('cat') as HTMLSelectElement).value;
                                if (desc && amt) {
                                    handleAddExpense({ name: desc, amount: amt, date: new Date().toISOString(), category: cat });
                                }
                            }} className="bg-emerald-600">Guardar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
