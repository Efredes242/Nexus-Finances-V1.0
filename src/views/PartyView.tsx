

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Plus, Users, DollarSign, Calendar, UserPlus, Trash2, Pencil, LogOut, User, Bell, Check, X } from 'lucide-react';
import { Tooltip as InfoTooltip } from '../components/Tooltip';
import { getThemeColors } from '../utils/theme';
import { InstallmentSimulator } from '../components/InstallmentSimulator';
// ExpenseModal import removed as we implemented it inline

/**
 * Calcula el balance neto del usuario actual en un party.
 * - balance > 0 → al usuario le deben (otros le tienen que pagar)
 * - balance < 0 → el usuario debe (le tiene que pagar a otros)
 * - balance ≈ 0 → al día
 *
 * Replica la lógica de `calculateBalances` (one-off expenses + installments)
 * pero como función pura para poder usarse en el preview de cada card de la lista,
 * sin tocar el state del componente. SI la entrada es ambigua o hay datos faltantes,
 * devuelve `null` (la UI debe ocultar el badge en ese caso — fail-safe).
 */
function computePartyBalanceForUser(args: {
    expenses: any[];
    installments: any[];
    members: any[];
    viewYear: number;
    viewMonth: number;
    currentUserId: string;
}): number | null {
    const { expenses, installments, members, viewYear, viewMonth, currentUserId } = args;
    if (!Array.isArray(members) || members.length === 0) return null;

    // Identificar al miembro del usuario actual en este party.
    // En la respuesta del backend `m.id` es el user_id (la PK de users), y
    // `m.memberId` es el id del registro en party_members. `payer_id` y
    // `participants` referencian el `m.id || m.memberId`, así que usamos esa misma
    // resolución para mantenernos consistentes con `calculateBalances`.
    const myMember = members.find(m => m.id === currentUserId);
    if (!myMember) return null;
    const myMemberKey = myMember.id || myMember.memberId;
    if (!myMemberKey) return null;

    // 1. One-off expenses del mes visible
    const filteredExpenses = (expenses || []).filter(e => {
        if (!e?.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === viewYear && (d.getMonth() + 1) === viewMonth;
    });

    const spentByUser: Record<string, number> = {};
    let totalOneOff = 0;
    filteredExpenses.forEach(e => {
        spentByUser[e.payer_id] = (spentByUser[e.payer_id] || 0) + (e.amount || 0);
        totalOneOff += (e.amount || 0);
    });
    const sharePerPersonOneOff = totalOneOff / (members.length || 1);
    const oneOffBalance = (spentByUser[myMemberKey] || 0) - sharePerPersonOneOff;

    // 2. Installments activas en el mes visible
    let installmentBalance = 0;
    (installments || []).forEach(plan => {
        if (!plan?.start_date) return;
        const [startY, startM] = String(plan.start_date).split('-').map(Number);
        if (!startY || !startM) return;
        const duration = plan.installments_count || 0;
        const startIdx = startY * 12 + (startM - 1);
        const currentIdx = viewYear * 12 + (viewMonth - 1);
        const endIdx = startIdx + duration - 1;
        if (currentIdx < startIdx || currentIdx > endIdx) return;

        let monthlyAmount = plan.installment_amount || 0;
        if (plan.currency === 'USD') monthlyAmount *= (plan.exchange_rate || 1);

        let participants: string[] = [];
        if (Array.isArray(plan.participants)) {
            participants = plan.participants;
        } else if (plan.debtor_id) {
            participants = [plan.debtor_id];
        }

        // Soy el payer → recibo de cada participante
        if (plan.payer_id === myMemberKey) {
            installmentBalance += monthlyAmount * participants.length;
        }
        // Soy participant → debo al payer
        if (participants.includes(myMemberKey)) {
            installmentBalance -= monthlyAmount;
        }
    });

    return oneOffBalance + installmentBalance;
}


export const PartyView: React.FC<{ user: any, currentMonth?: string, navigationParams?: any }> = ({ user, currentMonth, navigationParams }) => {
    const themeColors = getThemeColors();

    const [parties, setParties] = useState<any[]>([]);
    const [selectedParty, setSelectedParty] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [partiesLoading, setPartiesLoading] = useState(true);

    const [installments, setInstallments] = useState<any[]>([]);

    // Preview lazy del balance neto del usuario en cada party — para mostrar en las cards
    // de la lista. Read-only: no escribe nada en backend; sólo lectura para mostrar info.
    type BalancePreview = { net: number | null; status: 'loading' | 'ready' | 'error' };
    const [partyBalancesPreview, setPartyBalancesPreview] = useState<Record<string, BalancePreview>>({});

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
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);

    // Integrity System State
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [pendingAction, setPendingAction] = useState<{ type: 'EDIT' | 'DELETE', targetId: string, payload: any, description: string } | null>(null);

    // Form Inputs
    const [newPartyName, setNewPartyName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMode, setInviteMode] = useState<'email' | 'guest'>('email');
    const [guestName, setGuestName] = useState('');
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Varios', id: null as string | null, date: '' });

    useEffect(() => {
        loadParties();
    }, []);

    // Carga lazy del preview de balance para cada party. Se dispara cuando cambia
    // la lista de parties o el mes visible. Concurrencia limitada a 3 a la vez para
    // no saturar el worker. Si algo falla, dejamos el badge oculto en vez de mostrar
    // datos incorrectos (fail-safe).
    useEffect(() => {
        if (!user || !parties.length) return;
        let cancelled = false;

        const load = async () => {
            const queue = [...parties];
            const inFlight: Promise<void>[] = [];

            const processOne = async (party: any) => {
                if (cancelled) return;
                setPartyBalancesPreview(prev => ({
                    ...prev,
                    [party.id]: prev[party.id] ?? { net: null, status: 'loading' },
                }));
                try {
                    const [details, plans] = await Promise.all([
                        api.getPartyDetails(party.id) as Promise<any>,
                        api.getInstallmentPlans(party.id) as Promise<any>,
                    ]);

                    const expenses = Array.isArray(details?.expenses)
                        ? details.expenses
                        : (Array.isArray(details?.expenses?.results) ? details.expenses.results : []);
                    const members = Array.isArray(details?.members)
                        ? details.members
                        : (Array.isArray(details?.members?.results) ? details.members.results : []);
                    const installments = Array.isArray(plans)
                        ? plans
                        : (Array.isArray(plans?.results) ? plans.results : []);

                    const net = computePartyBalanceForUser({
                        expenses, installments, members,
                        viewYear, viewMonth,
                        currentUserId: user.id,
                    });

                    if (!cancelled) {
                        setPartyBalancesPreview(prev => ({
                            ...prev,
                            [party.id]: { net, status: 'ready' },
                        }));
                    }
                } catch (e) {
                    if (!cancelled) {
                        setPartyBalancesPreview(prev => ({
                            ...prev,
                            [party.id]: { net: null, status: 'error' },
                        }));
                    }
                }
            };

            // Worker pool con concurrencia 3
            const runWorker = async () => {
                while (queue.length > 0 && !cancelled) {
                    const next = queue.shift();
                    if (!next) break;
                    await processOne(next);
                }
            };
            for (let i = 0; i < 3; i++) inFlight.push(runWorker());
            await Promise.all(inFlight);
        };

        load();
        return () => { cancelled = true; };
    }, [parties, user, viewYear, viewMonth]);

    useEffect(() => {
        if (selectedParty) {
            loadPartyDetails(selectedParty.id);
            loadNicknames(selectedParty.id);
            loadInstallments(selectedParty.id);
            loadApprovals(selectedParty.id);
        }
    }, [selectedParty]);

    const loadApprovals = async (partyId: string) => {
        try {
            const data = await api.getPendingApprovals(partyId);
            setPendingApprovals((data as any) || []);
        } catch (e) {
            console.error("Error al cargar aprobaciones:", e);
        }
    };

    // --- DEEP LINKING HANDLER ---
    useEffect(() => {
        if (navigationParams && parties.length > 0) {
            // 1. If partyId provided, select it
            if (navigationParams.partyId && (!selectedParty || selectedParty.id !== navigationParams.partyId)) {
                const targetParty = parties.find(p => p.id === navigationParams.partyId);
                if (targetParty) setSelectedParty(targetParty);
            }
        }
    }, [navigationParams, parties]);

    // Installment/Expense Auto-Open logic
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

    useEffect(() => {
        if (navigationParams && navigationParams.expenseId && selectedParty) {
            // 1. Check Expenses
            if (expenses.length > 0) {
                const targetExpense = expenses.find(e => e.id === navigationParams.expenseId);
                if (targetExpense) {
                    handleEditExpense(targetExpense);
                    return;
                }
            }

            // 2. Check Installment Plans
            if (installments.length > 0) {
                const targetPlan = installments.find(i => i.id === navigationParams.expenseId);
                if (targetPlan) {
                    setEditingPlanId(targetPlan.id);
                    // Ensure we can see the simulator (it's at the bottom)
                    setTimeout(() => {
                        const element = document.getElementById('installment-simulator-form');
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 500);
                }
            }
        }
    }, [navigationParams, expenses, installments, selectedParty]);

    const loadInstallments = async (partyId: string) => {
        try {
            const data = await api.getInstallmentPlans(partyId);
            setInstallments((data as any) || []);
        } catch (e) {
            console.error("Error al cargar las cuotas:", e);
        }
    };

    // Auto-popup for pending reviews if I am the owner
    useEffect(() => {
        if (selectedParty && pendingApprovals.length > 0) {
            const hasMyResponsibility = pendingApprovals.some(pa => {
                const target = expenses.find(e => e.id === pa.target_expense_id) ||
                    installments.find(i => i.id === pa.target_expense_id);
                return target && target.payer_id === user?.id;
            });

            if (hasMyResponsibility && !showReviewModal) {
                setShowReviewModal(true);
            }
        }
    }, [pendingApprovals, selectedParty, expenses, installments, user]);

    const loadParties = async () => {
        setPartiesLoading(true);
        try {
            const data = await api.getParties() as any;
            console.log("Datos de los grupos:", data);
            if (Array.isArray(data)) {
                setParties(data);
            } else if (data && Array.isArray(data.results)) {
                setParties(data.results); // Handle D1 default format
            } else {
                setParties([]);
            }
        } catch (e) {
            console.error("Error al cargar los grupos:", e);
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
            console.error('Error al cargar los apodos:', e);
        }
    };

    const handleSetNickname = async (memberId: string, nickname: string) => {
        if (!selectedParty) return;
        try {
            await api.setNickname(selectedParty.id, memberId, nickname);
            setNicknames({ ...nicknames, [memberId]: nickname });
            setEditingNickname(null);
        } catch (e) {
            console.error('Error al guardar el apodo:', e);
            alert('Error al guardar el apodo');
        }
    };

    const getDisplayName = (member: any) => {
        const name = nicknames[member.memberId] || member.guest_name || member.username || member.email || member.invited_email || 'Usuario (Eliminado)';
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
            alert(`Invitación enviada a ${inviteEmail}`);
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
            loadPartyDetails(selectedParty.id); // Recargar detalles
        } catch (e: any) {
            alert(e.message || "Error al agregar invitado virtual");
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
                participants: members.map(m => m.memberId)
            };

            if (expenseForm.id) {
                // INTEGRITY CHECK: Only Payer can edit directly
                const currentExpense = expenses.find(e => e.id === expenseForm.id);
                if (currentExpense && currentExpense.payer_id !== user.id) {
                    // Open Approval Modal instead
                    setPendingAction({
                        type: 'EDIT',
                        targetId: expenseForm.id,
                        payload: payload,
                        description: `Modificar gasto "${currentExpense.description}" a "${payload.description}" ($${payload.amount})`
                    });
                    setShowApprovalModal(true);
                    setShowAddExpense(false);
                    return;
                }

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
        if (!selectedParty || !confirm("¿Eliminar este grupo y todos sus gastos? Esta acción no se puede deshacer.")) return;
        try {
            await api.deleteParty(selectedParty.id);
            setSelectedParty(null);
            loadParties();
        } catch (e) {
            alert("Error al eliminar grupo");
        }
    };

    const handleLeaveParty = async () => {
        if (!selectedParty || !user || !confirm("¿Seguro que quieres salir del grupo?")) return;
        // Find my membership record
        const myMemberRecord = members.find(m => m.id === user.id);
        if (!myMemberRecord) {
            alert("No se pudo identificar tu membresía en este grupo.");
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
        if (!selectedParty) return;

        // INTEGRITY CHECK: Only Payer can delete directly
        const currentExpense = expenses.find(e => e.id === expenseId);
        if (currentExpense && currentExpense.payer_id !== user.id) {
            // Open Approval Modal instead
            setPendingAction({
                type: 'DELETE',
                targetId: expenseId,
                payload: null,
                description: `Eliminar gasto "${currentExpense.description}" ($${currentExpense.amount})`
            });
            setShowApprovalModal(true);
            return;
        }

        if (!confirm("¿Eliminar este gasto?")) return;
        try {
            await api.deletePartyExpense(selectedParty.id, expenseId);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al eliminar gasto");
        }
    };

    const handleRemoveMember = async (memberId: string, memberName: string) => {
        if (!selectedParty || !confirm(`¿Estás seguro de eliminar a ${memberName} del grupo?`)) return;
        try {
            await api.removeMember(memberId);
            loadPartyDetails(selectedParty.id);
        } catch (e) {
            alert("Error al eliminar miembro");
        }
    };

    // --- INTEGRITY SYSTEM HANDLERS ---
    const handleRequestApproval = (targetId: string | null, type: 'EDIT' | 'DELETE', payload: any, description: string) => {
        setPendingAction({
            type,
            targetId,
            payload,
            description
        });
        setShowApprovalModal(true);
    };

    const submitApprovalRequest = async (reason: string) => {
        if (!selectedParty || !pendingAction) return;

        try {
            await api.createApprovalRequest(selectedParty.id, {
                target_expense_id: pendingAction.targetId,
                action_type: pendingAction.type,
                data_payload: pendingAction.payload,
                reason: reason
            });
            setShowApprovalModal(false);
            setPendingAction(null);
            alert("Solicitud de revisión enviada al propietario del gasto.");
            // Reload approvals
            loadApprovals(selectedParty.id);
        } catch (e) {
            alert("Error al enviar solicitud");
        }
    };

    const handleDecideApproval = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
        if (!selectedParty) return;
        try {
            await api.decideApproval(selectedParty.id, approvalId, decision);
            alert(decision === 'APPROVED' ? "Cambio aprobado y aplicado." : "Solicitud rechazada.");
            loadApprovals(selectedParty.id);
            loadPartyDetails(selectedParty.id); // Reload data if approved
        } catch (e) {
            alert("Error al procesar solicitud");
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

        // 2. Installments (Multi-Participant Support)
        const currentYear = viewYear;
        const currentMonthVal = viewMonth; // 1-12
        const installmentImpactByUser: Record<string, number> = {};

        installments.forEach(plan => {
            const [startY, startM] = plan.start_date.split('-').map(Number);
            const duration = plan.installments_count;

            // Check if plan is active this month
            const startIdx = startY * 12 + (startM - 1);
            const currentIdx = currentYear * 12 + (currentMonthVal - 1);
            const endIdx = startIdx + duration - 1;

            if (currentIdx >= startIdx && currentIdx <= endIdx) {
                // Active this month!
                let monthlyInstallmentAmount = plan.installment_amount; // Amount per person per month

                // Currency Conversion
                if (plan.currency === 'USD') {
                    monthlyInstallmentAmount = monthlyInstallmentAmount * (plan.exchange_rate || 1);
                }

                const payerId = plan.payer_id;

                // Get participants (could be in 'participants' field or fallback to debtor_id)
                let participants = [];
                if (plan.participants && Array.isArray(plan.participants)) {
                    participants = plan.participants;
                } else if (plan.debtor_id) {
                    participants = [plan.debtor_id];
                }

                // For each participant: they OWE the payer
                participants.forEach(participantId => {
                    // Payer RECEIVES from this participant
                    installmentImpactByUser[payerId] = (installmentImpactByUser[payerId] || 0) + monthlyInstallmentAmount;
                    // Participant OWES to payer
                    installmentImpactByUser[participantId] = (installmentImpactByUser[participantId] || 0) - monthlyInstallmentAmount;
                });
            }
        });

        // 3. Combine for Display and Balance
        const displaySpentByUser: Record<string, number> = { ...spentByUser };

        installments.forEach(plan => {
            const [startY, startM] = plan.start_date.split('-').map(Number);
            const duration = plan.installments_count;
            const startIdx = startY * 12 + (startM - 1);
            const currentIdx = currentYear * 12 + (currentMonthVal - 1);
            const endIdx = startIdx + duration - 1;

            if (currentIdx >= startIdx && currentIdx <= endIdx) {
                let monthlyInstallmentAmount = plan.installment_amount;
                if (plan.currency === 'USD') monthlyInstallmentAmount *= (plan.exchange_rate || 1);

                const participants = Array.isArray(plan.participants) ? plan.participants : (plan.debtor_id ? [plan.debtor_id] : []);
                const totalMonthlyCost = monthlyInstallmentAmount * (participants.length + 1);

                // Update ONLY the display spent total
                displaySpentByUser[plan.payer_id] = (displaySpentByUser[plan.payer_id] || 0) + totalMonthlyCost;

                // Balance impact is handled by installmentImpactByUser
            }
        });

        const balances = members.map(m => {
            const memberKey = m.id || m.memberId;
            const oneOffBalance = (spentByUser[memberKey] || 0) - sharePerPersonOneOff;
            const instBalance = installmentImpactByUser[memberKey] || 0;

            return {
                ...m,
                paid: (displaySpentByUser[memberKey] || 0), // Show total including installments
                balance: oneOffBalance + instBalance,
                monthlyInstallment: instBalance
            };
        });

        return balances;
    };

    const balances = React.useMemo(() => calculateBalances(), [members, expenses, installments, viewYear, viewMonth]);

    return (
        <div className="p-4 md:p-6 text-white space-y-6 relative max-w-full overflow-x-hidden">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Gastos Compartidos
                </h2>
                {!selectedParty && (
                    <Button onClick={() => setShowCreateParty(true)} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
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
                        {parties.map(party => {
                            const preview = partyBalancesPreview[party.id];
                            const renderBalanceBadge = () => {
                                if (!preview || preview.status === 'loading') {
                                    return (
                                        <span className="text-[10px] font-bold text-slate-500 italic animate-pulse">Calculando…</span>
                                    );
                                }
                                if (preview.status === 'error' || preview.net === null) {
                                    // Fail-safe: no mostrar nada en lugar de un balance incorrecto
                                    return null;
                                }
                                const net = preview.net;
                                const formatted = `$${Math.abs(net).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
                                if (Math.abs(net) < 1) {
                                    return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/40 border border-slate-500/30 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                                            <i className="fas fa-equals text-[9px]"></i> Al día
                                        </span>
                                    );
                                }
                                if (net > 0) {
                                    return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                            <i className="fas fa-arrow-down text-[9px]"></i> Te deben {formatted}
                                        </span>
                                    );
                                }
                                return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-black text-rose-400 uppercase tracking-wider">
                                        <i className="fas fa-arrow-up text-[9px]"></i> Debés {formatted}
                                    </span>
                                );
                            };
                            return (
                                <Card key={party.id} className="cursor-pointer hover:border-blue-500/50 transition-all group" onClick={() => setSelectedParty(party)}>
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:scale-110 transition-transform relative">
                                            <Users className="w-8 h-8 text-blue-400" />
                                            {party.pending_count > 0 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0f172a] shadow-lg animate-pulse" title="Solicitudes pendientes">
                                                    <span className="text-[10px] font-bold text-white">{party.pending_count}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-bold truncate">{party.name}</h3>
                                            <p className="text-gray-400 text-sm">
                                                {party.created_by === user?.id ? 'Creado por mí' : `Creado por ${party.creator_name || 'otro usuario'}`}
                                            </p>
                                            <div className="mt-2">{renderBalanceBadge()}</div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
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

                    {/* VISTA: RESUMEN + CUOTAS (Unificado) */}

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

                            {/* PENDING APPROVALS BANNER */}
                            {pendingApprovals.some(pa => {
                                // Show banner if I need to act (I am payer of target) OR I requested it (Status tracking)
                                const target = expenses.find(e => e.id === pa.target_expense_id) ||
                                    installments.find(i => i.id === pa.target_expense_id);
                                return (target && target.payer_id === user?.id) || pa.requester_id === user?.id;
                            }) && (
                                    <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-500/20 rounded-full text-orange-400">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-orange-400">Revisiones Pendientes</h4>
                                                <p className="text-xs text-slate-400">
                                                    {pendingApprovals.filter(pa => {
                                                        const target = expenses.find(e => e.id === pa.target_expense_id) ||
                                                            installments.find(i => i.id === pa.target_expense_id);
                                                        return target && target.payer_id === user?.id;
                                                    }).length} para revisar, {pendingApprovals.filter(pa => pa.requester_id === user?.id).length} enviadas.
                                                </p>
                                            </div>
                                        </div>
                                        <Button onClick={() => setShowReviewModal(true)} size="sm" className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30">
                                            Ver <Plus className="w-4 h-4 ml-2 inline-block" />
                                        </Button>
                                    </div>
                                )}

                            <div className="flex items-center gap-2 mb-6">
                                <p className="text-gray-400 text-sm">Resumen de Balances</p>
                                <InfoTooltip content="Muestra el estado financiero de cada miembro. Verde: Se le debe dinero. Rojo: Debe dinero al grupo." position="right" useIcon />
                            </div>

                            <div className="space-y-4">
                                {balances
                                    .sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0))
                                    .map(m => (
                                        <div key={m.memberId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg group">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-8 h-8 rounded-full ${themeColors.avatar} flex items-center justify-center text-xs font-bold relative`}>
                                                    {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || '?'}
                                                    {m.is_guest === 1 && (
                                                        <div className="absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-0.5 border border-[#0f172a]">
                                                            <User className="w-2 h-2 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    {editingNickname === m.memberId ? (
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
                                                            {/* Status Badges */}
                                                            {m.status === 'pending' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">Pendiente</span>}
                                                            {m.status === 'accepted' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Activo</span>}
                                                            {m.status === 'rejected' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Rechazado</span>}
                                                            {m.is_guest === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Virtual</span>}

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingNickname(m.memberId); setNicknameInput(getDisplayName(m)); }}
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
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {m.invited_email && m.status === 'pending' ? m.invited_email : `Pagó: $${m.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${m.balance > 0 ? 'text-teal-400' : m.balance < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {m.balance > 0 ? 'Te deben' : m.balance < 0 ? 'Debes' : 'Al día'}
                                                </div>
                                                <div className={`text-xl md:text-2xl font-black ${m.balance > 0 ? 'text-teal-400' : m.balance < 0 ? 'text-rose-400' : 'text-white'}`}>
                                                    ${Math.abs(m.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                                {m.monthlyInstallment !== 0 && (
                                                    <div className={`text-[9px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded-md inline-block ${m.monthlyInstallment > 0 ? 'bg-teal-500/10 text-teal-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                        Cuotas {new Date(viewYear, viewMonth - 1, 1).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}: {m.monthlyInstallment > 0 ? '+' : ''}${m.monthlyInstallment.toLocaleString()}
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
                            nicknames={nicknames}
                            externalEditingId={editingPlanId}
                            onExternalEditHandled={() => setEditingPlanId(null)}
                            onEdit={(payload) => handleRequestApproval(payload.id!, 'EDIT', payload, `Modificación de plan: ${payload.description}`)}
                            onDelete={(id, desc) => handleRequestApproval(id, 'DELETE', null, `Eliminación de plan: ${desc}`)}
                        />
                    </div>
                </div >

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
                        <Card className="w-[95%] max-w-md bg-[#1e293b]">
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
                                        Los invitados virtuales no necesitan cuenta. Úsalos para simular gastos con personas que no usan la app.
                                    </p>
                                    <input
                                        type="text"
                                        placeholder="Nombre del invitado (ej: Juan Pérez)"
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
                                    {inviteMode === 'email' ? 'Enviar Invitación' : 'Agregar Invitado'}
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
                        <Card className="w-[95%] max-w-md bg-[#1e293b]">
                            <h3 className="text-xl font-bold mb-4">{expenseForm.id ? 'Editar Gasto' : 'Agregar Gasto Compartido'}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">Descripción</label>
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
                                    <label className="text-sm text-gray-400">Fecha</label>
                                    <input
                                        value={expenseForm.date}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                                        type="date"
                                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Categoría</label>
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
            {/* INTEGRITY MODALS - APPROVAL REQUEST */}
            {showApprovalModal && pendingAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#1e293b]">
                        <h3 className="text-xl font-bold mb-4 text-orange-400">Solicitud de Aprobación Requerida</h3>
                        <p className="text-gray-300 mb-4">
                            No puedes realizar esta acción directamente porque no eres el propietario del gasto.
                            Se enviará una solicitud al propietario para que la apruebe.
                        </p>
                        <div className="bg-white/5 p-3 rounded mb-4 text-sm">
                            <span className="font-bold text-gray-400">Acción:</span> {pendingAction.description}
                        </div>
                        <input
                            type="text"
                            id="approval-reason"
                            placeholder="Razón del cambio (opcional)"
                            className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white mb-6 focus:border-orange-500 outline-none"
                        />
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => { setShowApprovalModal(false); setPendingAction(null); }}>Cancelar</Button>
                            <Button onClick={() => submitApprovalRequest((document.getElementById('approval-reason') as HTMLInputElement).value)} className="bg-orange-600">Enviar Solicitud</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* INTEGRITY MODALS - REVIEW PENDING */}
            {showReviewModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#16161a] border border-[#2cb67d]/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#2cb67d]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-[#2cb67d]/20 rounded-xl">
                                    <Bell className="w-6 h-6 text-[#2cb67d]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Revisiones Pendientes</h3>
                                    <p className="text-gray-400 text-sm">Tienes solicitudes para revisar</p>
                                </div>
                            </div>
                            <button onClick={() => setShowReviewModal(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {pendingApprovals.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No hay solicitudes pendientes.</p>
                        ) : (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {pendingApprovals.map(approval => {
                                    // Safe parsing with null check
                                    let parsedPayload = null;
                                    try {
                                        parsedPayload = approval.data_payload ? JSON.parse(approval.data_payload) : null;
                                    } catch (e) {
                                        console.error('Error parsing approval payload:', e);
                                    }

                                    const isInstallment = parsedPayload?.installmentData;
                                    const target = expenses.find(e => e.id === approval.target_expense_id) ||
                                        installments.find(i => i.id === approval.target_expense_id);

                                    const isMyResponsibility = target && target.payer_id === user?.id;
                                    const isMyRequest = approval.requester_id === user?.id;

                                    if (!isMyResponsibility && !isMyRequest) return null;

                                    return (
                                        <div key={approval.id} className="bg-[#242629] p-4 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${approval.action_type === 'DELETE' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        {approval.action_type === 'DELETE' ? 'Eliminación' : 'Edición'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 ml-2">
                                                        {new Date(approval.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-400 block leading-none">Solicitado por</span>
                                                    <span className="text-xs font-bold text-purple-400">{approval.requester_name}</span>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-white text-sm font-medium">
                                                    {approval.action_type === 'DELETE'
                                                        ? `Eliminar ${isInstallment ? 'plan' : 'gasto'} "${target?.description || 'Desconocido'}"`
                                                        : `Editar ${isInstallment ? 'plan' : 'gasto'} "${target?.description || 'Desconocido'}"`
                                                    }
                                                </p>
                                                {approval.reason && (
                                                    <div className="mt-1 flex gap-2">
                                                        <span className="text-gray-500 text-xs">"</span>
                                                        <p className="text-xs text-gray-400 italic flex-1">{approval.reason}</p>
                                                        <span className="text-gray-500 text-xs">"</span>
                                                    </div>
                                                )}
                                            </div>

                                            {isMyResponsibility ? (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleDecideApproval(approval.id, 'APPROVED')}
                                                        className="flex-1 bg-[#2cb67d] hover:bg-[#2cb67d]/80 text-white py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
                                                    >
                                                        <Check className="w-4 h-4" /> Aceptar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecideApproval(approval.id, 'REJECTED')}
                                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <X className="w-4 h-4" /> Rechazar
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-orange-400/70 text-center font-medium py-1 bg-orange-400/5 rounded border border-orange-400/10 italic">
                                                    Esperando aprobación del propietario...
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};
