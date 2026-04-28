
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  MoreVertical,
  Trash2,
  ShieldCheck,
  TrendingUp,
  CheckCircle,
  UserPlus,
  Clock,
  ShieldAlert,
  CreditCard,
  Mail,
  MoreHorizontal,
  Check,
  X
} from 'lucide-react';

// Simple API URL resolver
const getApiUrl = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('pages.dev') || hostname.includes('ezequielfredes.com.ar')) {
    return 'https://nexusfinance.ezequiel-fredes-mondragon.workers.dev/api';
  } else if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    if (window.location.port === '5173') {
      return 'http://localhost:3001/api';
    }
    return '/api';
  }
  return '/api';
};

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type Status = 'Active' | 'Inactive' | 'Pending' | 'Banned';
type Role = 'Admin' | 'User' | 'Moderator';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: string;
  approval_status?: ApprovalStatus;
  created_at: string;
  last_login_at?: string;
  firstName?: string;
  lastName?: string;
}

interface AdminPanelProps {
  token: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ token }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ApprovalStatus | 'All'>('All');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch users from API
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const fullUrl = `${apiUrl}/admin/users`;
      console.log('[ADMIN PANEL] Fetching users from:', fullUrl);
      console.log('[ADMIN PANEL] Token:', token?.substring(0, 20) + '...');

      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[ADMIN PANEL] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ADMIN PANEL] Error response:', errorText);
        throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
      }

      const data: { users: AdminUser[] } = await response.json();
      console.log('[ADMIN PANEL] Users loaded:', data.users?.length);
      setUsers(data.users || []);
      setError(null);
    } catch (e: any) {
      console.error('Error fetching users:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to approve user');

      // Refresh users list
      await fetchUsers();
    } catch (e: any) {
      console.error('Error approving user:', e);
      alert('Error al aprobar usuario: ' + e.message);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to reject user');

      // Refresh users list
      await fetchUsers();
    } catch (e: any) {
      console.error('Error rejecting user:', e);
      alert('Error al rechazar usuario: ' + e.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    if (!window.confirm("¿Estás seguro de que deseas eliminar este usuario?\n\nESTA ACCIÓN ES IRREVERSIBLE.\n\nSe eliminarán:\n- El usuario y su acceso.\n- Sus planes de cuotas y deudas.\n- Sus aprobaciones pendientes.\n- Sus membresías en grupos.")) {
      return;
    }

    try {
      setIsDeleting(userId);
      const response = await fetch(`${getApiUrl()}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(errorData.details || errorData.error || 'Failed to delete user');
      }

      // Remove from UI
      setTimeout(() => {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setIsDeleting(null);
        alert('Usuario eliminado correctamente.');
      }, 400);
    } catch (e: any) {
      console.error('Error deleting user:', e);
      alert('Error al eliminar usuario: ' + e.message);
      setIsDeleting(null);
    }
  };

  const getStatusFromApproval = (approvalStatus?: ApprovalStatus): Status => {
    if (!approvalStatus || approvalStatus === 'APPROVED') return 'Active';
    if (approvalStatus === 'PENDING') return 'Pending';
    if (approvalStatus === 'REJECTED') return 'Banned';
    return 'Inactive';
  };

  const getStatusStyles = (approvalStatus?: ApprovalStatus) => {
    const status = getStatusFromApproval(approvalStatus);
    switch (status) {
      case 'Active': return {
        container: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      };
      case 'Inactive': return {
        container: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        dot: 'bg-slate-400'
      };
      case 'Pending': return {
        container: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
      };
      case 'Banned': return {
        container: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
      };
      default: return { container: 'bg-slate-500/10 text-slate-400', dot: 'bg-slate-400' };
    }
  };

  const getRoleBadge = (role: string) => {
    const roleUpper = role.toUpperCase();
    if (roleUpper === 'ADMIN') return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
        <ShieldAlert size={10} /> Admin
      </span>
    );
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold uppercase tracking-wider">
        <Users size={10} /> User
      </span>
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
      const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || user.approval_status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, selectedStatus]);

  const stats = [
    { label: 'Usuarios Registrados', value: users.length, icon: Users, color: 'text-teal-400', bg: 'bg-teal-400/10' },
    { label: 'Usuarios Aprobados', value: users.filter(u => u.approval_status === 'APPROVED').length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Solicitudes Pendientes', value: users.filter(u => u.approval_status === 'PENDING').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Usuarios Rechazados', value: users.filter(u => u.approval_status === 'REJECTED').length, icon: X, color: 'text-rose-400', bg: 'bg-rose-400/10' },
  ];

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-[#05070a]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-[#05070a] p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <X size={32} className="text-rose-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Error al cargar datos</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={fetchUsers}
            className="px-6 py-3 bg-teal-500 text-black font-bold rounded-xl hover:bg-teal-400 transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#05070a] p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">Control</span>
          </h1>
          <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-xl">
            Monitoreo en tiempo real de la base de usuarios de Nexus.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="relative overflow-hidden bg-[#0d1117] border border-slate-800/60 p-4 rounded-2xl group hover:border-teal-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={60} />
            </div>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3 border border-white/5`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{stat.label}</p>
            <h3 className="text-2xl font-bold text-white mt-0.5 tabular-nums">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Table Container */}
      <div className="bg-[#0d1117] border border-slate-800/60 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
        {/* Table Controls */}
        <div className="p-6 md:p-8 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#161b22] border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#161b22] p-1 rounded-2xl border border-slate-800">
              {['All', 'APPROVED', 'PENDING', 'REJECTED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedStatus === s
                    ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {s === 'All' ? 'Todos' : s === 'APPROVED' ? 'Aprobados' : s === 'PENDING' ? 'Pendientes' : 'Rechazados'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-800/50 bg-slate-900/20">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Usuario</th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Privilegios</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Estado</th>
                <th className="hidden lg:table-cell px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Registro</th>
                <th className="hidden xl:table-cell px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Última Conexión</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Operaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredUsers.length > 0 ? filteredUsers.map((user) => {
                const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
                const status = getStatusFromApproval(user.approval_status);

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-teal-500/[0.02] transition-colors group ${isDeleting === user.id ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100'} duration-300`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative group/avatar shrink-0">
                          <div className="absolute -inset-1 bg-gradient-to-tr from-teal-500 to-blue-500 rounded-full opacity-0 group-hover/avatar:opacity-30 transition-opacity blur-sm"></div>
                          <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0ea5e9&color=fff`}
                            alt={displayName}
                            className="relative w-10 h-10 rounded-full border-2 border-slate-800 object-cover aspect-square"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors truncate">{displayName}</span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                            <Mail size={12} className="opacity-60 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusStyles(user.approval_status).container}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusStyles(user.approval_status).dot} shrink-0`}></div>
                        {status}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="text-slate-300 font-medium">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Desconocido'}
                        </span>
                        <span className="text-slate-500 italic">ID: {user.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="text-slate-300 font-medium">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.approval_status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                              title="Aprobar"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleReject(user.id)}
                              className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Rechazar"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Eliminar Usuario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-700">
                        <Search size={32} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold">No se encontraron usuarios</h4>
                        <p className="text-slate-500 text-sm">Ajusta los filtros de búsqueda para encontrar lo que necesitas.</p>
                      </div>
                      <button
                        onClick={() => { setSearchTerm(''); setSelectedStatus('All'); }}
                        className="mt-2 text-teal-400 text-sm font-bold hover:underline"
                      >
                        Limpiar todos los filtros
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-8 py-6 bg-slate-900/10 border-t border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="text-slate-300 font-bold">{filteredUsers.length}</span> registros de un total de <span className="text-slate-300 font-bold">{users.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
