import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { api } from '../services/api';

interface OnboardingModalProps {
    user: any;
    onComplete: (updatedUser: any) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onComplete }) => {
    const [formData, setFormData] = useState({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        birthDate: user.birthDate || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.birthDate) {
            setError('Por favor completa todos los campos para continuar.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.updateProfile(formData);
            // The response.user contains the updated user object
            onComplete(response.user);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al guardar los datos.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#020617] z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
            {/* Background blobs for styling */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                        <i className="fas fa-user-astronaut text-white text-3xl"></i>
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">¡Hola, {user.username}!</h1>
                    <p className="text-slate-400">
                        Antes de comenzar, necesitamos conocerte un poco mejor para personalizar tu experiencia.
                    </p>
                </div>

                <Card className="shadow-2xl border border-white/10 backdrop-blur-xl" noPadding>
                    <div className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-white font-bold"
                                        placeholder="Ej. Juan"
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Apellido</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-white font-bold"
                                        placeholder="Pérez"
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha de Nacimiento</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-white font-bold"
                                    value={formData.birthDate}
                                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                                    <i className="fas fa-exclamation-circle"></i>
                                    {error}
                                </div>
                            )}

                            <Button
                                className="w-full py-4 rounded-xl text-base shadow-lg shadow-blue-500/20"
                                disabled={loading}
                            >
                                {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Continuar a Nexus'}
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
};
