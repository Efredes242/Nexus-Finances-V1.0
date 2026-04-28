
import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Trash2, Calendar, DollarSign, TrendingUp, Loader2, Pencil } from 'lucide-react';
import { Tooltip as InfoTooltip } from './Tooltip';
import { getThemeColors } from '../utils/theme';
import { api } from '../services/api';

interface InstallmentItem {
    id: string;
    description: string;
    totalAmount: number;
    installments: number;
    installmentAmount: number;
    payerId: string;
    debtorId: string;
    startDate: string; // YYYY-MM
    createdBy?: string;
    participants?: string[];
    isRecurring?: boolean;
}

interface MonthlyProjection {
    month: string; // YYYY-MM
    items: {
        id: string;
        description: string;
        amount: number;
        originalAmount?: number;
        currency?: string;
        type: 'pay' | 'receive';
        fromTo: string;
    }[];
    netAmount: number;
}

interface InstallmentSimulatorProps {
    members: any[];
    currentUser: any;
    partyId: string;
    currentMonth?: string;
    nicknames?: Record<string, string>;
    externalEditingId?: string | null;
    onExternalEditHandled?: () => void;
    onEdit?: (planData: any) => void;
    onDelete?: (planId: string, description: string) => void;
}

export const InstallmentSimulator: React.FC<InstallmentSimulatorProps> = ({ members, currentUser, partyId, currentMonth, nicknames, externalEditingId, onExternalEditHandled, onEdit, onDelete }) => {
    const themeColors = getThemeColors();
    const [items, setItems] = useState<InstallmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Sync member names (if they change in parent via nicknames)
    const getMemberName = (id: string) => {
        if (!id) return 'Usuario';
        if (id === currentUser.id) return currentUser.firstName || currentUser.username || 'Yo';

        // Find in members list (handling both local and DB formats)
        const member = members.find(m =>
            m.id === id ||
            m.memberId === id ||
            m.user_id === id ||
            m.email === id ||
            m.username === id ||
            m.guest_name === id ||
            m.nickname === id
        );

        if (member) return member.guest_name || member.nickname || member.firstName || member.username || 'Miembro';

        // Last resort: Clean up ID if it looks like a name/email
        if (id.includes('@')) return id.split('@')[0];
        if (id.length < 30) return id; // Likely a nickname or short ID

        return 'Usuario (Eliminado)';
    };

    // Form State
    // Find my member ID
    const myMemberId = React.useMemo(() => {
        const me = members.find(m => m.user_id === currentUser.id);
        return me ? (me.id || me.memberId) : currentUser.id;
    }, [members, currentUser.id]);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState('1');
    const [payerId, setPayerId] = useState(myMemberId || ((members[0]?.id || members[0]?.memberId) || currentUser.id));
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    const [currency, setCurrency] = useState('ARS');
    const [exchangeRate, setExchangeRate] = useState('');
    const [estimatedRate, setEstimatedRate] = useState(''); // Visual match for UI

    // Projection
    const [projection, setProjection] = useState<MonthlyProjection[]>([]);

    useEffect(() => {
        loadItems();
    }, [partyId]);

    // Handle External Edit Trigger
    useEffect(() => {
        if (externalEditingId && items.length > 0) {
            const itemToEdit = items.find(i => i.id === externalEditingId);
            if (itemToEdit) {
                // Populate form
                setDescription(itemToEdit.description);
                setAmount(itemToEdit.totalAmount.toString());
                setInstallments(itemToEdit.installments.toString());
                setPayerId(itemToEdit.payerId);
                setStartMonth(itemToEdit.startDate);

                // Get participants
                const participants = itemToEdit.participants || [itemToEdit.debtorId];
                setParticipantIds(participants);
                setCurrency((itemToEdit as any).currency || 'ARS');
                setExchangeRate((itemToEdit as any).exchangeRate ? String((itemToEdit as any).exchangeRate) : '');

                setEditingId(itemToEdit.id);

                // Scroll to form
                const element = document.getElementById('installment-simulator-form');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Notify parent strictly once if needed, but usually parent just resets prop
                if (onExternalEditHandled) onExternalEditHandled();
            }
        }
    }, [externalEditingId, items, onExternalEditHandled]);


    const [isRecurring, setIsRecurring] = useState(false);

    const loadItems = async () => {
        try {
            setLoading(true);
            if (!api.getInstallmentPlans) return;
            const data = await api.getInstallmentPlans(partyId);
            const mappedItems = (data as any[]).map((d: any) => ({
                id: d.id,
                description: d.name || d.description, // Support both
                totalAmount: d.total_amount,
                installments: d.installments_count,
                installmentAmount: d.installment_amount,
                payerId: d.payer_id,
                debtorId: d.debtor_id,
                startDate: d.start_date,
                createdBy: d.created_by,
                participants: d.participants ? (typeof d.participants === 'string' ? JSON.parse(d.participants) : d.participants) : [],
                currency: d.currency || 'ARS',
                exchangeRate: d.exchange_rate || 1,
                isRecurring: d.is_recurring === 1
            }));
            setItems(mappedItems);
        } catch (error) {
            console.error("Error loading installments:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!description || !amount || participantIds.length === 0) {
            alert("Por favor completa todos los campos y selecciona al menos un participante");
            return;
        }

        try {
            setSubmitting(true);
            const monthlyAmount = parseFloat(amount);
            const count = parseInt(installments);
            const rate = parseFloat(exchangeRate) || 1;

            // Decide if totalAmount is just monthlyAmount or calculated
            const total = isRecurring ? (monthlyAmount * count) : monthlyAmount;

            const totalParticipants = participantIds.length + 1; // Payer + Selected others

            // Per person per month calculation
            const perPersonPerMonth = isRecurring
                ? (monthlyAmount / totalParticipants)
                : (total / totalParticipants / count);

            const payload = {
                name: description,
                description: description,
                total_amount: total,
                installments_count: count,
                installment_amount: perPersonPerMonth,
                start_date: startMonth,
                payer_id: payerId,
                participants: participantIds,
                currency,
                exchangeRate: currency === 'USD' ? rate : 1,
                is_recurring: isRecurring ? 1 : 0
            };

            // INTERCEPTION LOGIC: If editing existing plan and NOT payer -> Request Approval
            if (editingId && payerId !== currentUser.id && onEdit) {
                // Prepare payload for approval request
                const approvalPayload = {
                    ...payload,
                    id: editingId,
                    installmentData: { // Specific marker for installment updates in backend
                        installments: count,
                        first_payment_date: startMonth,
                        issuer: description // Reusing field for description/name
                    }
                };
                onEdit(approvalPayload);

                // Reset form locally
                setDescription('');
                setAmount('');
                setInstallments('1');
                setParticipantIds([]);
                setEditingId(null);
                setCurrency('ARS');
                setExchangeRate('');
                setEstimatedRate('');
                setIsRecurring(false);
                setSubmitting(false);
                return;
            }

            if (editingId) {
                await api.updateInstallmentPlan(partyId, editingId, payload);
            } else {
                await api.createInstallmentPlan(partyId, payload);
            }

            // Reset Form and State
            setDescription('');
            setAmount('');
            setInstallments('1');
            setParticipantIds([]);
            setEditingId(null);
            setCurrency('ARS');
            setExchangeRate('');
            setEstimatedRate('');
            setIsRecurring(false);
            loadItems();
        } catch (e) {
            console.error('Error saving installment plan:', e);
            alert("Error al guardar el plan de cuotas: " + (e as any).message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        const item = items.find(i => i.id === id);
        // INTERCEPTION LOGIC
        if (onDelete && item && item.payerId !== currentUser.id && item.createdBy !== currentUser.id) {
            onDelete(id, item.description);
            return;
        }

        if (!confirm('¿Eliminar este plan?')) return;
        try {
            setLoading(true);
            await api.deleteInstallmentPlan(partyId, id);
            await loadItems();
        } catch (error) {
            console.error("Error deleting plan:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate projection
    useEffect(() => {
        const projections: Record<string, MonthlyProjection> = {};

        items.forEach(item => {
            const [startYear, startMonth] = item.startDate.split('-').map(Number);
            const participants = (item as any).participants || [item.debtorId];

            // CORRECT CALCULATION LOGIC
            // The item.installmentAmount is in the PLAN's currency (e.g., 20 USD).
            // We need to convert it to ARS for the "netAmount" summation.
            const rate = (item as any).exchangeRate || 1;
            const isUSD = (item as any).currency === 'USD';
            const installmentAmountNative = item.installmentAmount;
            const installmentAmountARS = isUSD ? installmentAmountNative * rate : installmentAmountNative;

            for (let i = 0; i < item.installments; i++) {
                let month = startMonth + i;
                let year = startYear;
                while (month > 12) {
                    month -= 12;
                    year += 1;
                }
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;

                if (!projections[monthKey]) {
                    projections[monthKey] = {
                        month: monthKey,
                        items: [],
                        netAmount: 0 // Always in ARS
                    };
                }

                const isPayerMe = item.payerId === currentUser.id;
                const isParticipantMe = participants.includes(currentUser.id);

                if (isPayerMe) {
                    // Current fixed split expects others to pay the payer
                    participants.forEach((participantId: string) => {
                        if (participantId === currentUser.id) return; // Skip self if somehow included

                        projections[monthKey].items.push({
                            id: item.id,
                            description: `${item.description} (Cobro ${i + 1}/${item.installments})`,
                            amount: installmentAmountARS,
                            originalAmount: installmentAmountNative,
                            currency: (item as any).currency || 'ARS',
                            type: 'receive',
                            fromTo: getMemberName(participantId)
                        });
                        projections[monthKey].netAmount += installmentAmountARS;
                    });
                } else if (isParticipantMe) {
                    projections[monthKey].items.push({
                        id: item.id,
                        description: `${item.description} (Pago ${i + 1}/${item.installments})`,
                        amount: installmentAmountARS,
                        originalAmount: installmentAmountNative,
                        currency: (item as any).currency || 'ARS',
                        type: 'pay',
                        fromTo: getMemberName(item.payerId)
                    });
                    projections[monthKey].netAmount -= installmentAmountARS;
                }
            }
        });

        const sortedProjections = Object.values(projections).sort((a, b) => a.month.localeCompare(b.month));

        const finalProjections = currentMonth
            ? sortedProjections.filter(p => p.month === currentMonth)
            : sortedProjections;

        setProjection(finalProjections);

    }, [items, currentUser.id, currentMonth, members]);

    const totalItemsAmount = items.reduce((sum, item) => {
        // Approximate total in ARS for summary
        const rate = (item as any).exchangeRate || 1;
        return sum + (item.totalAmount * rate);
    }, 0);

    if (loading && items.length === 0) {
        return <div className="p-8 text-center text-slate-400 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-teal-400" />
            Cargando plan de cuotas...
        </div>;
    }

    return (
        <div id="installment-simulator-form" className="space-y-6 animate-in fade-in duration-500 pb-20">
            <Card className={`${themeColors.card} ${themeColors.border} border`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className={`w-5 h-5 ${themeColors.amountText}`} />
                        {editingId ? 'Editando Plan de Cuotas' : 'Simulador de Plan de Cuotas'}
                        <InfoTooltip content="Registra compras en cuotas para calcular automáticamente cuánto debe transferir cada mes quien no pagó." position="right" useIcon />
                    </h3>
                    {editingId && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setDescription('');
                                setAmount('');
                                setCurrency('ARS');
                                setExchangeRate('');
                                setEstimatedRate('');
                                setInstallments('1');
                                setPayerId(currentUser.id);
                                setParticipantIds([]);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-500/10 rounded-lg transition-colors"
                        >
                            Cancelar Edición
                        </button>
                    )}
                </div>

                {/* --- REFINED FORM UI START --- */}
                {/* Recurrence Mode Toggle */}
                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 mb-6">
                    <button
                        onClick={() => setIsRecurring(false)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isRecurring ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        DIVIDIR TOTAL EN CUOTAS
                    </button>
                    <button
                        onClick={() => setIsRecurring(true)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isRecurring ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        GASTO FIJO MENSUAL (REPETIR)
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Description & Plan Config */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción / Servicio</label>
                        <input
                            type="text"
                            placeholder={isRecurring ? "Ej: Suscripción Claude AI" : "Ej: Regalo Cumpleaños"}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isRecurring ? 'Repetir por' : 'Cuotas'}</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <select
                                    value={installments}
                                    onChange={e => setInstallments(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                                >
                                    {[1, 2, 3, 6, 9, 12, 18, 24].map(n => (
                                        <option key={n} value={n}>{n} {isRecurring ? (n === 1 ? 'Mes' : 'Meses') : (n === 1 ? 'Pago' : 'Cuotas')}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                                    <span className="text-[10px]">▼</span>
                                </div>
                            </div>
                            <input
                                type="date"
                                value={startMonth}
                                onChange={e => setStartMonth(e.target.value)}
                                className="w-40 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        {isRecurring && (
                            <p className="text-[10px] text-purple-400 font-bold mt-1 px-1">
                                {parseInt(installments) > 1 ? `Se cobrará el monto completo cada mes durante ${installments} meses.` : 'Cobro mensual único.'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Styled Currency/Amount Box (Matching Screenshot) */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Currency Selector */}
                        <div className="w-full sm:w-1/3 space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moneda</label>
                            <select
                                className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-black text-white appearance-none"
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                            >
                                <option value="ARS">ARS</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>

                        {/* Amount Input */}
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isRecurring ? `Cuota Mensual ${currency}` : `Monto Total ${currency}`}</label>
                            <input
                                type="number"
                                className={`w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none font-black text-lg ${currency === 'USD' ? 'text-green-400' : 'text-blue-400'}`}
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Exchange Rates and Total (Conditional) */}
                    {currency === 'USD' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            {/* Estimated Rate */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cotiz. Estimada</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={estimatedRate}
                                    onChange={e => setEstimatedRate(e.target.value)}
                                    className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-sm font-bold text-slate-500"
                                />
                            </div>
                            {/* Actual Rate */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-blue-400">Cotiz. Real (Compra)</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 1215"
                                    value={exchangeRate}
                                    onChange={e => setExchangeRate(e.target.value)}
                                    className="w-full bg-slate-900 rounded-xl p-3 border border-blue-500/50 focus:border-blue-400 outline-none text-sm font-bold text-white shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                />
                            </div>

                            {/* Calculated Total */}
                            <div className="col-span-2 space-y-1 pt-2 border-t border-white/5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Calculado (ARS)</label>
                                <div className="w-full bg-slate-900/30 rounded-xl p-3 border border-white/5 font-black text-blue-400 text-xl tracking-tight">
                                    ${(parseFloat(amount || '0') * (parseFloat(exchangeRate || '0') || 0)).toLocaleString('es-AR')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* --- REFINED FORM UI END --- */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Quién Pagó</label>
                        <select
                            value={payerId}
                            onChange={e => {
                                const newPayerId = e.target.value;
                                setPayerId(newPayerId);
                                setParticipantIds(prev => prev.filter(id => id !== newPayerId));
                            }}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            {members.map(m => (
                                <option key={m.memberId} value={m.id || m.memberId}>{getMemberName(m.id || m.memberId)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">
                            Quiénes deben pagar su parte
                            {participantIds.length > 0 && amount && (
                                <span className="ml-2 text-teal-400 font-semibold">
                                    (${(
                                        (parseFloat(amount || '0') * (currency === 'USD' ? (parseFloat(exchangeRate || '1') || 1) : 1)) /
                                        ((participantIds.length + 1) * (isRecurring ? 1 : parseInt(installments || '1')))
                                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })} c/u por mes)
                                </span>
                            )}
                        </label>
                        <div className="bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 max-h-40 overflow-y-auto space-y-2">
                            {members.filter(m => (m.id || m.memberId) !== payerId).map(m => (
                                <label key={m.memberId} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={participantIds.includes(m.id || m.memberId)}
                                        onChange={e => {
                                            const val = m.id || m.memberId;
                                            if (e.target.checked) setParticipantIds(prev => [...prev, val]);
                                            else setParticipantIds(prev => prev.filter(id => id !== val));
                                        }}
                                        className="w-4 h-4 rounded border-white/20 bg-slate-800 text-teal-500 focus:ring-2 focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-white">{getMemberName(m.id || m.memberId)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <Button onClick={handleAddItem} disabled={submitting} className={`${editingId ? 'bg-blue-600 hover:bg-blue-700' : themeColors.primaryButton} w-full flex items-center justify-center gap-2`}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                    {editingId ? 'Guardar Cambios' : 'Agregar al Plan'}
                </Button>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-300">Proyección Mensual</h3>
                    <InfoTooltip content="Muestra el flujo de dinero mes a mes basado en las cuotas activas." position="right" useIcon />
                </div>

                {projection.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-white/5 rounded-2xl">
                        No hay cuotas registradas.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {projection.map((proj) => (
                            <Card key={proj.month} className="bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                                    <div className="bg-slate-800 p-2 rounded-lg text-slate-300 font-bold">
                                        {new Date(proj.month + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </div>
                                    <div className={`text-xl font-bold ${proj.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {proj.netAmount >= 0 ? 'Recibes' : 'Pagas'} ${Math.abs(proj.netAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {proj.items.map((item: any, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-xl bg-slate-900/30 hover:bg-slate-900/50 border border-white/5 group transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${item.type === 'receive' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className="text-slate-200 font-medium">{item.description}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-slate-500 text-xs text-right">
                                                    {item.type === 'receive' ? `de ${item.fromTo}` : `a ${item.fromTo}`}
                                                </span>
                                                <div className="text-right">
                                                    {/* Primary Amount (ARS) */}
                                                    <div className={`font-mono font-bold text-lg ${item.type === 'receive' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {item.type === 'receive' ? '+' : '-'}${Math.abs(item.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </div>
                                                    {/* Secondary Amount Badge (USD) */}
                                                    {item.currency === 'USD' && (
                                                        <div className="flex justify-end mt-1">
                                                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                                USD {item.originalAmount.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-2">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {proj.items.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-end items-center gap-2">
                                            <span className="text-xs text-slate-400 uppercase font-bold">Neto Mes:</span>
                                            <span className={`font-bold ${proj.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {proj.netAmount >= 0
                                                    ? `Te transfieren $${proj.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                    : `Transfieres $${Math.abs(proj.netAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Manage Plans List - Allows deleting items */}
            {items.length > 0 && (
                <div className="mt-8 pt-8 border-t border-white/10 px-4 mb-24">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                        Historial de Planes (Administrar)
                    </h3>
                    <div className="space-y-3">
                        {items.map(item => {
                            const isOwned = item.payerId === currentUser.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`flex justify-between items-center p-4 rounded-xl border-l-4 transition-all ${isOwned
                                            ? 'bg-emerald-500/5 border-emerald-500 hover:bg-emerald-500/10'
                                            : 'bg-amber-500/5 border-amber-500 hover:bg-amber-500/10'
                                        }`}
                                >
                                    <div>
                                        <div className="text-white font-medium flex items-center gap-2">
                                            {item.description}
                                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{item.installments} cuotas</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isOwned
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                }`}>
                                                {isOwned ? 'Admin' : 'Invitado'}
                                            </span>
                                            {(() => {
                                                if (!currentMonth) return null;
                                                const [cY, cM] = currentMonth.split('-').map(Number);
                                                const [sY, sM] = item.startDate.split('-').map(Number);
                                                const startTotal = sY * 12 + (sM - 1);
                                                const endTotal = startTotal + item.installments;
                                                const currentTotal = cY * 12 + (cM - 1);

                                                if (currentTotal >= endTotal) {
                                                    return <span className="text-xs bg-emerald-500 text-white font-bold px-2 py-0.5 rounded shadow-lg border border-emerald-400">Finalizado</span>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {item.isRecurring ? `Mensual: $${(item.totalAmount / item.installments).toLocaleString()}` : `Total: $${item.totalAmount.toLocaleString()}`}
                                            {item.isRecurring && <span className="text-slate-600 ml-1">(Total: ${item.totalAmount.toLocaleString()})</span>}
                                            • Inicio: {item.startDate}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                            <span>Pagó: <span className="text-teal-400">{getMemberName(item.payerId)}</span></span>
                                            <span>→</span>
                                            <span>Debe: <span className="text-indigo-400">{getMemberName(item.debtorId)}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {(item.createdBy === currentUser.id || item.payerId === currentUser.id || !!onEdit) && (
                                            <button
                                                onClick={() => {
                                                    // Populate form with existing data
                                                    setDescription(item.description);

                                                    // FIX: If it's recurring, show the monthly amount, NOT the total sum.
                                                    const isRec = (item as any).isRecurring;
                                                    const displayAmount = isRec
                                                        ? (item.totalAmount / item.installments).toString()
                                                        : item.totalAmount.toString();

                                                    setAmount(displayAmount);
                                                    setInstallments(item.installments.toString());
                                                    setPayerId(item.payerId);
                                                    setStartMonth(item.startDate);
                                                    // Get participants from item
                                                    const participants = item.participants || [item.debtorId];
                                                    setParticipantIds(participants);
                                                    setCurrency((item as any).currency || 'ARS');
                                                    setExchangeRate((item as any).exchangeRate ? String((item as any).exchangeRate) : '');
                                                    setIsRecurring(isRec);
                                                    setEditingId(item.id);

                                                    // Scroll to form (to the beginning of the component)
                                                    const element = document.getElementById('installment-simulator-form');
                                                    if (element) {
                                                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    } else {
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }
                                                }}
                                                className="text-slate-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Editar Plan"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Eliminar Plan Completo"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {items.length > 0 && (
                <div className="mt-6 bg-slate-900/50 rounded-xl border border-white/10 p-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-medium">Total Acumulado en Cuotas:</span>
                        <span className={`text-2xl font-bold ${themeColors.amountText}`}>${totalItemsAmount.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
