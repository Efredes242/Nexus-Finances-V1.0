
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Bell, Check, X } from 'lucide-react';

export const InvitationModal = () => {
    const [invitations, setInvitations] = useState<any[]>([]);
    const [checking, setChecking] = useState(false);

    const checkInvitations = async () => {
        try {
            const res = await api.getInvitations();
            setInvitations(res);
        } catch (e) {
            console.error("Error checking invitations", e);
        }
    };

    useEffect(() => {
        // Check on mount
        checkInvitations();

        // Poll every 30 seconds for new invites (simple real-time sim)
        const interval = setInterval(checkInvitations, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRespond = async (id: string, accept: boolean) => {
        try {
            await api.respondToInvitation(id, accept);
            setInvitations(prev => prev.filter(inv => inv.id !== id));
            if (accept) {
                alert("¡Te has unido al grupo!");
                // Optionally trigger a refresh of parties if we were in that view
            }
        } catch (e) {
            console.error("Error responding", e);
            alert("Error al responder invitación");
        }
    };

    if (invitations.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#16161a] border border-[#2cb67d]/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#2cb67d]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-[#2cb67d]/20 rounded-xl">
                        <Bell className="w-6 h-6 text-[#2cb67d]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Invitación Pendiente</h3>
                        <p className="text-gray-400 text-sm">Te han invitado a colaborar</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {invitations.map((inv) => (
                        <div key={inv.id} className="bg-[#242629] p-4 rounded-xl border border-white/5">
                            <p className="text-gray-300 mb-4">
                                <span className="text-white font-semibold">{inv.partyName}</span>
                                <br />
                                <span className="text-xs text-gray-500">Invitado como: {inv.invited_email}</span>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleRespond(inv.id, true)}
                                    className="flex-1 bg-[#2cb67d] hover:bg-[#2cb67d]/80 text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Aceptar
                                </button>
                                <button
                                    onClick={() => handleRespond(inv.id, false)}
                                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Rechazar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
