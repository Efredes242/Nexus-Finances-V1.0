import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Card } from './Card';

export function AdminPanel() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await api.getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error cargando usuarios:', err);
        }
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pass = "";
        for(let i=0; i<12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setPassword(pass);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);
        
        try {
            if (!password) {
                setError('La contraseña es requerida');
                setLoading(false);
                return;
            }
            await api.createUser(username, password, role);
            setMessage(`Usuario "${username}" creado exitosamente.`);
            // Don't clear password immediately so admin can copy it
            setUsername('');
            setRole('user');
            loadUsers();
        } catch (err: any) {
            setError(err.message || 'Error al crear usuario');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            await api.updateUserRole(userId, newRole);
            setMessage('Rol actualizado correctamente');
            loadUsers();
        } catch (err: any) {
            setError(err.message || 'Error al actualizar rol');
        }
    };

    const handleDeleteUser = async (id: string, username: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
        
        try {
            await api.deleteUser(id);
            setMessage(`Usuario "${username}" eliminado correctamente.`);
            loadUsers();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar usuario');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="md:col-span-2">
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                    <i className="fas fa-users-cog text-blue-500"></i>
                    Panel de Administración
                </h2>
                <p className="text-slate-400">Gestión de usuarios y accesos.</p>
             </div>

             <Card className="md:col-span-1" title="Crear Nuevo Usuario" subtitle="Añade un nuevo usuario al sistema." variant="glass">
                <form onSubmit={handleCreateUser} className="space-y-6 mt-4">
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Nombre de Usuario</label>
                        <div className="relative">
                            <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-800/50 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
                                placeholder="ej. juanperez"
                                required
                            />
                        </div>
                    </div>
                    <div>
                         <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Contraseña Inicial</label>
                         <div className="flex gap-2">
                            <div className="relative flex-1">
                                <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                <input 
                                    type="text" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-blue-500 transition-colors font-mono"
                                    placeholder="Contraseña"
                                    required
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={generatePassword}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                                title="Generar contraseña aleatoria"
                            >
                                <i className="fas fa-random"></i>
                            </button>
                         </div>
                    </div>

                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Rol</label>
                        <select 
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                        >
                            <option value="user">Usuario Estándar</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    
                    {message && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <i className="fas fa-check-circle"></i>
                            {message}
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <i className="fas fa-exclamation-circle"></i>
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {loading ? 'Creando...' : 'Crear Usuario'}
                    </button>
                </form>
             </Card>

             <Card className="md:col-span-1" title="Usuarios Registrados" subtitle="Visualiza y gestiona los usuarios del sistema." variant="glass">
                <div className="space-y-4 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {users.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                <i className="fas fa-users text-2xl"></i>
                            </div>
                            <p className="text-slate-500">No hay usuarios registrados.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map(user => (
                                <div key={user.id} className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold uppercase border border-white/5">
                                                {user.username.substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-sm">{user.username}</p>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <select 
                                                        value={user.role} 
                                                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                                        className="bg-slate-900 border border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400 rounded px-2 py-0.5 outline-none focus:border-blue-500 cursor-pointer"
                                                        disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1} // Prevent removing last admin (basic check)
                                                    >
                                                        <option value="user">USER</option>
                                                        <option value="admin">ADMIN</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar usuario"
                                            >
                                                <i className="fas fa-trash-alt text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </Card>
        </div>
    );
}
