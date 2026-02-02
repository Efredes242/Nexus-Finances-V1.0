

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Plus, Users, DollarSign, Calendar, UserPlus, Trash2, Pencil, LogOut } from 'lucide-react';
import { Tooltip as InfoTooltip } from '../components/Tooltip';
import { getThemeColors } from '../utils/theme';
import { InstallmentSimulator } from '../components/InstallmentSimulator';
// ExpenseModal import removed as we implemented it inline


export const PartyView: React.FC<{ user: any, currentMonth?: string }> = ({ user, currentMonth }) => {
    const themeColors = getThemeColors();

    const [parties, setParties] = useState<any[]>([]);
    const [selectedParty, setSelectedParty] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [partiesLoading, setPartiesLoading] = useState(true);

    const [installments, setInstallments] = useState<any[]>([]);

    // Clock State
    const [currentTime, setCurrentTime] = useState(new Date());

    // Filter Logic
    const [viewYear, viewMonth] = React.useMemo(() => {
        if (currentMonth) {
            const [y, m] = currentMonth.split('-');
            return [parseInt(y), parseInt(m)];
        }
        return [currentTime.getFullYear(), currentTime.getMonth() + 1];
    }, [currentMonth, currentTime]);

    const filteredExpenses = React.useMemo(() => {
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === viewYear && (d.getMonth() + 1) === viewMonth;
        });
    }, [expenses, viewYear, viewMonth]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Nickname System
    const [nicknames, setNicknames] = useState<Record<string, string>>({});
    const [editingNickname, setEditingNickname] = useState<string | null>(null);
    const [nicknameInput, setNicknameInput] = useState('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'resumen' | 'deudas' | 'cuotas'>('resumen');

    // Modal States
    const [showCreateParty, setShowCreateParty] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [showAddExpense, setShowAddExpense] = useState(false);

    // Form Inputs
    const [newPartyName, setNewPartyName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMode, setInviteMode] = useState<'email' | 'guest'>('email');
    const [guestName, setGuestName] = useState('');
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Varios', id: null as string | null, date: '' });

    useEffect(() => {
        loadParties();
    }, []);

    useEffect(() => {
        if (selectedParty) {
            loadPartyDetails(selectedParty.id);
            loadNicknames(selectedParty.id);
            loadInstallments(selectedParty.id);
        }
    }, [selectedParty]);

    const loadInstallments = async (partyId: string) => {
        try {
            const data = await api.getInstallmentPlans(partyId);
            setInstallments((data as any) || []);
        } catch (e) {
            console.error("Error loading installments:", e);
        }
    };

    const loadParties = async () => {
        setPartiesLoading(true);
        try {
            const data = await api.getParties() as any;
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
        } finally {
            setPartiesLoading(false);
        }
    };

    const loadPartyDetails = async (id: string) => {
        setLoading(true);
        try {
            const data = await api.getPartyDetails(id) as any;
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

    const loadNicknames = async (partyId: string) => {
        try {
            const data = await api.getNicknames(partyId) as any;
            if (data && data.nicknames) {
                setNicknames(data.nicknames);
            }
        } catch (e) {
            console.error('Error loading nicknames:', e);
        }
    };

    const handleSetNickname = async (memberId: string, nickname: string) => {
        if (!selectedParty) return;
        try {
            await api.setNickname(selectedParty.id, memberId, nickname);
            setNicknames({ ...nicknames, [memberId]: nickname });
            setEditingNickname(null);
        } catch (e) {
            console.error('Error setting nickname:', e);
            alert('Error al guardar el apodo');
        }
    };

    const getDisplayName = (member: any) => {
        // Try nickname using memberId (Party Member ID), fallback to username/email
        const name = nicknames[member.memberId] || member.username || member.email || 'Usuario';
        // Remove trailing "0" if present at the end of the string
        return String(name).replace(/0+$/, '');
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
            alert(`InvitaciÃ³n enviada a ${inviteEmail}`);
            setInviteEmail('');
            setShowInvite(false);
        } catch (e) {
            alert("Error al invitar usuario");
        }
    };

    const handleAddGuest = async () => {
        if (!selectedParty || !guestName.trim()) return;
        try {
            await api.addGuestMember(selectedParty.id, guestName.trim());
            alert(`Invitado "${guestName}" agregado exitosamente`);
            setGuestName('');
            setShowInvite(false);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al agregar invitado virtual");
        }
    };

    const handleAddExpense = async () => {
        if (!selectedParty || !expenseForm.description || !expenseForm.amount) return;
        try {
            const payload = {
                description: expenseForm.description,
                amount: Number(expenseForm.amount),
                date: expenseForm.date || new Date().toISOString(),
                category: expenseForm.category,
                participants: members.map(m => m.id)
            };

            if (expenseForm.id) {
                await api.updatePartyExpense(selectedParty.id, expenseForm.id, payload);
            } else {
                await api.addPartyExpense(selectedParty.id, payload);
            }
            setShowAddExpense(false);
            setExpenseForm({ description: '', amount: '', category: 'Varios', id: null, date: '' });
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al guardar gasto");
        }
    };

    const handleEditExpense = (expense: any) => {
        setExpenseForm({
            description: expense.description,
            amount: expense.amount,
            category: expense.category || 'Varios',
            id: expense.id,
            date: expense.date
        });
        setShowAddExpense(true);
    };

    const handleDeleteParty = async () => {
        if (!selectedParty || !confirm("Â¿Eliminar este grupo y todos sus gastos? Esta acciÃ³n no se puede deshacer.")) return;
        try {
            await api.deleteParty(selectedParty.id);
            setSelectedParty(null);
            loadParties();
        } catch (e) {
            alert("Error al eliminar grupo");
        }
    };

    const handleLeaveParty = async () => {
        if (!selectedParty || !user || !confirm("Â¿Seguro que quieres salir del grupo?")) return;

        // Find my membership record
        // The 'members' array has objects where 'id' is the user_id (for registered users)
        const myMemberRecord = members.find(m => m.id === user.id);

        if (!myMemberRecord) {
            alert("No se pudo identificar tu membresÃ­a en este grupo.");
            return;
        }

        try {
            await api.removeMember(myMemberRecord.memberId);
            setSelectedParty(null);
            loadParties();
        } catch (e) {
            alert("Error al salir del grupo");
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        if (!selectedParty || !confirm("Â¿Eliminar este gasto?")) return;
        try {
            await api.deletePartyExpense(selectedParty.id, expenseId);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al eliminar gasto");
        }
    };

    const handleRemoveMember = async (memberId: string, memberName: string) => {
        if (!selectedParty || !confirm(`Â¿EstÃ¡s seguro de eliminar a ${memberName} del grupo?`)) return;
        try {
            await api.removeMember(memberId);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al eliminar miembro");
        }
    };

    const calculateBalances = () => {
        // Balances calculation logic
        // 1. One-off expenses
        const spentByUser: Record<string, number> = {};
        let totalOneOff = 0;

        filteredExpenses.forEach(e => {
            spentByUser[e.payer_id] = (spentByUser[e.payer_id] || 0) + e.amount;
            totalOneOff += e.amount;
        });

        const sharePerPersonOneOff = totalOneOff / (members.length || 1);

        // 2. Installments (Use Filter Month)
        // Need to determine if each installment plan is active this month
        const currentYear = viewYear;
        const currentMonthVal = viewMonth; // 1-12

        // Mapping for display
        const installmentImpactByUser: Record<string, number> = {}; // How much they PAID for installments vs DEBT
        // Actually, for installments, it's P2P usually (or 50/50).
        // If Payer Paid X, and Debtor Owes X/2.
        // Impact on Payer: +X/2 (outcome: he paid full, so he is owed half).
        // Impact on Debtor: -X/2 (outcome: he owes half).

        let totalInstallmentsThisMonth = 0;

        // Note: D1 returns snake_case for fields
        installments.forEach(inst => {
            const [startY, startM] = inst.start_date.split('-').map(Number);
            const duration = inst.installments_count;

            // Calc end date
            // Simple check: convert both to month index
            const startIdx = startY * 12 + (startM - 1);
            const currentIdx = currentYear * 12 + (currentMonthVal - 1);
            const endIdx = startIdx + duration - 1;

            if (currentIdx >= startIdx && currentIdx <= endIdx) {
                // Active this month!
                const monthlyAmount = inst.installment_amount; // already calculated as total/count/2 usually? 
                // Wait, DB stores `installment_amount` which is the DEBT part?
                // In InstallmentSimulator: `const monthlyDebt = monthlyTotal / 2;` -> saved as `installment_amount`.
                // So this IS the debt amount.

                const payerId = inst.payer_id;
                const debtorId = inst.debtor_id;

                // Payer is OWED this amount.
                installmentImpactByUser[payerId] = (installmentImpactByUser[payerId] || 0) + monthlyAmount;
                // Debtor OWES this amount.
                installmentImpactByUser[debtorId] = (installmentImpactByUser[debtorId] || 0) - monthlyAmount;

                totalInstallmentsThisMonth += monthlyAmount * 2; // Total valid movement
            }
        });

        const balances = members.map(m => {
            const oneOffBalance = (spentByUser[m.id] || 0) - sharePerPersonOneOff;
            const instBalance = installmentImpactByUser[m.id] || 0;

            return {
                ...m,
                paid: (spentByUser[m.id] || 0), // Show only one-off paid in "PagÃ³"? Or combine? User wants "monto en cuota del mes".
                // I'll keep "paid" as one-off for now to avoid confusion, or should I split it?
                // Let's create a new field "installmentBalance"
                balance: oneOffBalance + instBalance,
                monthlyInstallment: instBalance // +/- amount from installments this month
            };
        });

        return balances;
    };

    const balances = calculateBalances();

    return (
        <div className="p-6 text-white space-y-6 relative">

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
                partiesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-bold animate-pulse">Cargando grupos...</p>
                    </div>
                ) : (
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
                )
            ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white pl-0" onClick={() => setSelectedParty(null)}>
                        ← Volver a mis grupos
                    </Button>

                    {/* VIEW: RESUMEN + CUOTAS (Unified) */}

                    <div className="w-full space-y-6">
                        <Card className={`${themeColors.card} sticky top-6`}>
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-2xl font-bold">{selectedParty.name}</h3>
                                <div className="flex gap-2">
                                    {user && selectedParty.created_by === user.id ? (
                                        <Button variant="ghost" onClick={handleDeleteParty} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10" title="Eliminar grupo">
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" onClick={handleLeaveParty} className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-500/10" title="Salir del grupo">
                                            <LogOut className="w-5 h-5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mb-6">
                                <p className="text-gray-400 text-sm">Resumen de Balances</p>
                                <InfoTooltip content="Muestra el estado financiero de cada miembro. Verde: Se le debe dinero. Rojo: Debe dinero al grupo." position="right" useIcon />
                            </div>

                            <div className="space-y-4">
                                {balances.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg group">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-8 h-8 rounded-full ${themeColors.avatar} flex items-center justify-center text-xs font-bold`}>
                                                {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1">
                                                {editingNickname === m.id ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={nicknameInput}
                                                            onChange={(e) => setNicknameInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSetNickname(m.memberId, nicknameInput);
                                                                if (e.key === 'Escape') setEditingNickname(null);
                                                            }}
                                                            className="bg-white/10 px-2 py-1 rounded text-sm flex-1"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleSetNickname(m.memberId, nicknameInput)}
                                                            className="text-green-400 text-xs"
                                                        >
                                                            ✔
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingNickname(null)}
                                                            className="text-red-400 text-xs"
                                                        >
                                                            ✖
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group/nick">
                                                        <p className="font-bold text-white truncate max-w-[120px]" title={getDisplayName(m)}>
                                                            {getDisplayName(m).split(' ')[0]}
                                                        </p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingNickname(m.id); setNicknameInput(getDisplayName(m)); }}
                                                            className="opacity-0 group-hover/nick:opacity-100 text-slate-600 hover:text-blue-400 transition-all p-1"
                                                            title="Editar apodo"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.memberId, getDisplayName(m)); }}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all p-1"
                                                            title="Eliminar miembro del grupo"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 truncate">Pagó: ${m.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`font-bold ${m.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {m.balance >= 0 ? 'Te debe (Total)' : 'Debes (Total)'}<br />
                                                ${Math.abs(m.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                            {m.monthlyInstallment !== 0 && (
                                                <div className="text-xs text-slate-400 mt-1 bg-slate-800/50 px-2 py-1 rounded">
                                                    Cuotas {new Date(viewYear, viewMonth - 1, 1).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}:
                                                    <span className={`ml-1 font-mono ${m.monthlyInstallment > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {m.monthlyInstallment > 0 ? '+' : ''}${Math.abs(m.monthlyInstallment).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button onClick={() => setShowInvite(true)} className={`w-full mt-6 ${themeColors.secondaryButton}`}>
                                <UserPlus className="w-4 h-4 mr-2" /> Invitar Amigo
                            </Button>
                        </Card>
                    </div>

                    {/* SECTION: PLAN DE CUOTAS */}
                    <div className="mt-12 pt-8 border-t border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                                <Calendar className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Plan de Cuotas</h3>
                                <div className="flex items-center gap-2">
                                    <p className="text-gray-400 text-sm">Simulador y gestión de compras en cuotas</p>
                                    <InfoTooltip content="Simulador para gestionar compras en cuotas y dividir el costo mensual entre los miembros." position="right" useIcon />
                                </div>
                            </div>
                        </div>
                        <InstallmentSimulator
                            members={members}
                            currentUser={user}
                            partyId={selectedParty.id}
                            currentMonth={`${viewYear}-${String(viewMonth).padStart(2, '0')}`}
                        />
                    </div>
                </div>

            )
            }

            {/* MODALS */}
            {
                showCreateParty && (
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
                )
            }

            {
                showInvite && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <Card className="w-full max-w-md bg-[#1e293b]">
                            <h3 className="text-xl font-bold mb-4">Agregar Miembro a {selectedParty?.name}</h3>

                            {/* Tab Selection */}
                            <div className="flex gap-2 mb-6 border-b border-white/10">
                                <button
                                    onClick={() => setInviteMode('email')}
                                    className={`px-4 py-2 font-semibold transition-all ${inviteMode === 'email'
                                        ? 'text-purple-400 border-b-2 border-purple-400'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Invitar Usuario
                                </button>
                                <button
                                    onClick={() => setInviteMode('guest')}
                                    className={`px-4 py-2 font-semibold transition-all ${inviteMode === 'guest'
                                        ? 'text-purple-400 border-b-2 border-purple-400'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Crear Invitado Virtual
                                </button>
                            </div>

                            {/* Email Invite Mode */}
                            {inviteMode === 'email' && (
                                <>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Ingresa el email de la persona. Debe tener cuenta en Nexus Finance.
                                    </p>
                                    <input
                                        type="email"
                                        placeholder="Email del usuario (ej: amigo@gmail.com)"
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white mb-6 focus:border-purple-500 outline-none"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                    />
                                </>
                            )}

                            {/* Guest Creation Mode */}
                            {inviteMode === 'guest' && (
                                <>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Los invitados virtuales no necesitan cuenta. Ãšsalos para simular gastos con personas que no usan la app.
                                    </p>
                                    <input
                                        type="text"
                                        placeholder="Nombre del invitado (ej: Juan PÃ©rez)"
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white mb-6 focus:border-purple-500 outline-none"
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                    />
                                </>
                            )}

                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowInvite(false);
                                        setInviteEmail('');
                                        setGuestName('');
                                        setInviteMode('email');
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={inviteMode === 'email' ? handleInvite : handleAddGuest}
                                    className="bg-purple-600"
                                >
                                    {inviteMode === 'email' ? 'Enviar InvitaciÃ³n' : 'Agregar Invitado'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Simplified Expense Modal reuse or custom */}
            {/* For now reusing concept, in real implementation we might pass props to ExpenseModal or build a small one here */}
            {
                showAddExpense && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <Card className="w-full max-w-md bg-[#1e293b]">
                            <h3 className="text-xl font-bold mb-4">{expenseForm.id ? 'Editar Gasto' : 'Agregar Gasto Compartido'}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">DescripciÃ³n</label>
                                    <input
                                        value={expenseForm.description}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                        type="text"
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Monto</label>
                                    <input
                                        value={expenseForm.amount}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        type="number"
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">CategorÃ­a</label>
                                    <select
                                        value={expenseForm.category}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                                    >
                                        <option value="Comida">Comida</option>
                                        <option value="Transporte">Transporte</option>
                                        <option value="Hospedaje">Hospedaje</option>
                                        <option value="Varios">Varios</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="ghost" onClick={() => {
                                    setShowAddExpense(false);
                                    setExpenseForm({ description: '', amount: '', category: 'Varios', id: null, date: '' });
                                }}>Cancelar</Button>
                                <Button onClick={handleAddExpense} className="bg-emerald-600">{expenseForm.id ? 'Guardar Cambios' : 'Agregar'}</Button>
                            </div>
                        </Card>
                    </div>
                )
            }
        </div >
    );
};
