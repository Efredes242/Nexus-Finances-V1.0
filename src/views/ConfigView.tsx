import React, { useState } from 'react';
import { getThemeColors } from '../utils/theme';
import { AppConfig } from '../types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '../services/api';

interface ConfigViewProps {
  user: any;
  initialConfig: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onCardRenames?: (renames: Record<string, string>) => void;
  usedCardNames?: string[];
  onSyncToCloud?: () => Promise<void>;
}

export const ConfigView: React.FC<ConfigViewProps & { onLogout: () => void, onExport: () => void }> = ({ user, initialConfig, onUpdateConfig, onCardRenames, usedCardNames = [], onSyncToCloud, onLogout, onExport }) => {
  const theme = localStorage.getItem('colorTheme') || 'new';
  const themeColors = getThemeColors();
  const [configBuffer, setConfigBuffer] = useState<AppConfig>(initialConfig);
  // Track cards with their original names to handle renames correctly
  const [cardTracker, setCardTracker] = useState<{ originalName: string | null, currentName: string }[]>(
    (initialConfig.creditCards || []).map(c => ({ originalName: c, currentName: c }))
  );
  const [orphanResolutions, setOrphanResolutions] = useState<Record<string, string>>({});

  const orphanCards = React.useMemo(() => {
    const configNames = new Set(cardTracker.map(c => c.currentName));
    // Also exclude cards that are already being resolved
    return usedCardNames.filter(name => !configNames.has(name) && !orphanResolutions[name]);
  }, [usedCardNames, cardTracker, orphanResolutions]);

  const [draggedTag, setDraggedTag] = useState<{ category: string, index: number } | null>(null);

  // Update tracker when cards are modified
  const updateCards = (newTracker: typeof cardTracker) => {
    setCardTracker(newTracker);
    setConfigBuffer(prev => ({
      ...prev,
      creditCards: newTracker.map(c => c.currentName)
    }));
  };


  const handleDragStart = (e: React.DragEvent, category: string, index: number) => {
    setDraggedTag({ category, index });
    e.dataTransfer.effectAllowed = 'move';
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
    setDraggedTag(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Delete Data Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<{ scope: 'monthly' | 'annual' | 'all', step: 'confirm' | 'executing' } | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [isD1Syncing, setIsD1Syncing] = useState(false);

  const handleD1Sync = async () => {
    if (!confirm('Esto reemplazará toda tu base de datos local con los datos de producción de Cloudflare D1. ¿Estás seguro?')) return;

    setIsD1Syncing(true);
    try {
      await api.syncFromD1();
      alert('¡Sincronización completada con éxito! La aplicación se reiniciará.');
      window.location.reload();
    } catch (err: any) {
      alert('Error al sincronizar desde D1: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsD1Syncing(false);
    }
  };

  const loginToDrive = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSyncLoading(true);
      try {
        const action = localStorage.getItem('drive_action');
        if (action === 'upload') {
          await api.driveUpload(tokenResponse.access_token);
          alert('¡Base de datos subida a Google Drive con éxito!');
        } else if (action === 'download') {
          if (confirm('Esto reemplazará tus datos locales con los de la nube. ¿Continuar?')) {
            await api.driveDownload(tokenResponse.access_token);
            alert('¡Datos restaurados desde Google Drive! La aplicación se reiniciará.');
            window.location.reload();
          }
        }
      } catch (err: any) {
        alert('Error en la sincronización: ' + (err.message || 'Error desconocido'));
      } finally {
        setSyncLoading(false);
        localStorage.removeItem('drive_action');
      }
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
    onError: () => alert('Error al autorizar Google Drive')
  });

  const handleDriveSync = (action: 'upload' | 'download') => {
    localStorage.setItem('drive_action', action);
    loginToDrive();
  };

  const handleDrop = (e: React.DragEvent, targetCategory: string, targetIndex: number) => {
    e.preventDefault();
    if (!draggedTag || draggedTag.category !== targetCategory) return;
    if (draggedTag.index === targetIndex) return;

    setConfigBuffer(prev => {
      const newCategories = { ...prev.categories };
      const tags = [...newCategories[targetCategory]];
      const [movedTag] = tags.splice(draggedTag.index, 1);
      tags.splice(targetIndex, 0, movedTag);
      newCategories[targetCategory] = tags;

      return {
        ...prev,
        categories: newCategories
      };
    });
    setDraggedTag(null);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 mt-6 pb-40">
        <Card title="Preferencias del Ecosistema" subtitle="Configura la base de tu gestión financiera.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identidad del Usuario</label>
              <div className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-slate-400 font-bold flex items-center gap-3 cursor-not-allowed opacity-80 overflow-hidden">
                <i className="fas fa-user-lock text-slate-600 flex-shrink-0"></i>
                <span className="truncate">{user.firstName ? `${user.firstName} ${user.lastName}` : (user.username || 'Usuario')}</span>
              </div>
              <p className="text-[10px] text-slate-600 font-medium px-2">Gestionado por tu perfil de cuenta.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Símbolo Monetario</label>
              <div className="relative">
                <select
                  className={`w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none ${theme === 'new' ? 'focus:border-teal-500' : 'focus:border-blue-500'} transition-all font-bold text-center appearance-none cursor-pointer`}
                  value={configBuffer.currency}
                  onChange={e => setConfigBuffer(prev => ({ ...prev, currency: e.target.value }))}
                >
                  <option value="$">$ (Peso/Dólar)</option>
                  <option value="€">€ (Euro)</option>
                  <option value="£">£ (Libra)</option>
                  <option value="¥">¥ (Yen)</option>
                  <option value="R$">R$ (Real)</option>
                  <option value="S/">S/ (Sol Peruano)</option>
                  <option value="Q">Q (Quetzal)</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vista Predeterminada</label>
              <div className="relative">
                <select
                  className={`w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none ${theme === 'new' ? 'focus:border-teal-500' : 'focus:border-blue-500'} transition-all font-bold text-center appearance-none cursor-pointer`}
                  value={configBuffer.viewMode || 'monthly'}
                  onChange={e => setConfigBuffer(prev => ({ ...prev, viewMode: e.target.value as 'monthly' | 'biweekly' }))}
                >
                  <option value="monthly">Mensual (Mes Completo)</option>
                  <option value="biweekly">Quincenal (1-15 / 16-Fin)</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 font-medium px-2">Modo de visualización inicial en Movimientos.</p>
            </div>
          </div>

          {/* Theme Enforced: Teal/Verde */}
        </Card>

        {orphanCards.length > 0 && (
          <Card title="Sincronización de Tarjetas" subtitle="Hemos detectado nombres de tarjetas en tus movimientos que no coinciden con la configuración." className="border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
            <div className="space-y-4 mt-4">
              <p className="text-sm text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <i className="fas fa-info-circle text-blue-400 mr-2"></i>
                Selecciona "Fusionar" si quieres que los movimientos de la tarjeta antigua pasen a una de las nuevas. O "Añadir" para registrarla como nueva.
              </p>
              {orphanCards.map(orphan => (
                <div key={orphan} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                      <i className="fas fa-credit-card"></i>
                    </div>
                    <div>
                      <span className="font-bold text-white block">{orphan}</span>
                      <span className="text-[10px] uppercase font-black text-orange-500">No configurada</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        updateCards([...cardTracker, { originalName: null, currentName: orphan }]);
                      }}
                    >
                      <i className="fas fa-plus mr-2"></i> Añadir
                    </Button>
                    <div className="relative flex-1 sm:flex-none">
                      <select
                        className="w-full appearance-none bg-slate-900 border border-white/10 rounded-xl pl-4 pr-10 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all h-full"
                        onChange={(e) => {
                          if (e.target.value) {
                            setOrphanResolutions(prev => ({ ...prev, [orphan]: e.target.value }));
                          }
                        }}
                        value=""
                      >
                        <option value="">Fusionar con...</option>
                        {cardTracker.map(c => (
                          <option key={c.currentName} value={c.currentName}>{c.currentName}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                        <i className="fas fa-chevron-down text-[10px]"></i>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ACTIONS CARD */}
        <Card title="Acciones de Cuenta" subtitle="Gestiona tu sesión y datos.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <button
              onClick={onExport}
              className="group relative w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-300 flex items-center justify-between overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <i className="fas fa-file-excel text-xl"></i>
                </div>
                <div className="text-left">
                  <p className="font-bold text-emerald-400 text-lg">Exportar Excel</p>
                  <p className="text-xs text-slate-400">Descarga tu historial completo</p>
                </div>
              </div>
            </button>

            <button
              onClick={onLogout}
              className="group relative w-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 rounded-2xl p-6 transition-all duration-300 flex items-center justify-between overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  <i className="fas fa-sign-out-alt text-xl"></i>
                </div>
                <div className="text-left">
                  <p className="font-bold text-rose-400 text-lg">Cerrar Sesión</p>
                  <p className="text-xs text-slate-400">Salir de Nexus Finance</p>
                </div>
              </div>
            </button>

            {/* DEV TOOLS - ONLY LOCALHOST */}
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <button
                onClick={handleD1Sync}
                disabled={isD1Syncing}
                className={`group relative w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-6 transition-all duration-300 flex items-center justify-between overflow-hidden ${isD1Syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="relative z-10 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:rotate-180 transition-transform ${isD1Syncing ? 'animate-spin' : ''}`}>
                    <i className="fas fa-sync-alt text-xl"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-amber-400 text-lg">DB Sync (D1 Prod)</p>
                    <p className="text-xs text-slate-400">Sincronizar datos reales desde Cloudflare</p>
                  </div>
                </div>
                {isD1Syncing && <div className="text-[10px] font-black text-amber-500 animate-pulse">SINCRONIZANDO...</div>}
              </button>
            )}
          </div>
        </Card>

        <div className="p-8 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/10 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <h4 className="text-rose-500 font-black text-sm uppercase tracking-widest">Zona de Reinicio</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">Gestiona la eliminación de datos de tu cuenta.</p>
          </div>
          <Button variant="danger" size="sm" className="rounded-xl w-full md:w-auto" onClick={() => setShowDeleteModal(true)}>
            <i className="fas fa-trash-alt mr-2"></i> Borrar Datos
          </Button>
        </div>
      </div>

      {/* DELETE DATA MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(225,29,72,0.2)]">
            <div className="p-6 bg-rose-500/10 border-b border-rose-500/20">
              <h3 className="text-xl font-black text-rose-500 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i>
                Eliminar Datos
              </h3>
              <p className="text-xs text-rose-300 mt-1">Esta acción es irreversible. Por favor selecciona qué deseas eliminar.</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Option: Monthly */}
              <button
                onClick={() => setDeleteStep({ scope: 'monthly', step: 'confirm' })}
                className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-slate-800 hover:border-blue-500/50 transition-all group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white group-hover:text-blue-400 transition-colors">Mes Actual</span>
                  <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md uppercase">
                    {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Borra solo los movimientos de este mes.</p>
              </button>

              {/* Option: Annual */}
              <button
                onClick={() => setDeleteStep({ scope: 'annual', step: 'confirm' })}
                className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-slate-800 hover:border-amber-500/50 transition-all group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white group-hover:text-amber-400 transition-colors">Año Actual</span>
                  <span className="text-[10px] font-black bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md uppercase">
                    {new Date().getFullYear()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Borra todos los movimientos de este año.</p>
              </button>

              {/* Option: All Data */}
              <button
                onClick={() => setDeleteStep({ scope: 'all', step: 'confirm' })}
                className="w-full text-left p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-rose-900/20 hover:border-rose-500/50 transition-all group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white group-hover:text-rose-500 transition-colors">TODO</span>
                  <span className="text-[10px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-md uppercase">
                    PELIGRO
                  </span>
                </div>
                <p className="text-xs text-slate-500">Borra movimientos, metas y cuotas de TODA la cuenta.</p>
              </button>
            </div>

            <div className="p-4 bg-slate-950 border-t border-white/10 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowDeleteModal(false); setDeleteStep(null); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {deleteStep && (deleteStep.step === 'confirm' || deleteStep.step === 'executing') && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[110] flex items-center justify-center p-4 animate-in zoom-in-95 duration-300">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl w-full max-w-sm overflow-hidden text-center p-8 space-y-6 relative">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
              {deleteStep.step === 'executing' ? (
                <i className="fas fa-circle-notch fa-spin text-3xl text-rose-500"></i>
              ) : (
                <i className="fas fa-trash-alt text-3xl text-rose-500"></i>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">
                {deleteStep.step === 'executing' ? 'Eliminando...' : '¿Estás seguro?'}
              </h3>
              <p className="text-sm text-slate-400">
                Vas a eliminar los datos de: <br />
                <span className="text-rose-400 font-bold text-lg uppercase">
                  {deleteStep.scope === 'monthly' ? 'Este Mes' : deleteStep.scope === 'annual' ? 'Este Año' : 'TODA LA CUENTA'}
                </span>
              </p>
              <p className="text-xs text-slate-500 bg-black/30 p-2 rounded-lg">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setDeleteStep(null)} disabled={deleteStep.step === 'executing'}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={deleteStep.step === 'executing'}
                onClick={async () => {
                  setDeleteStep(prev => prev ? { ...prev, step: 'executing' } : null);
                  try {
                    const now = new Date();
                    let dateParam = ''; // Format: YYYY-MM or YYYY

                    if (deleteStep.scope === 'monthly') {
                      const year = now.getFullYear();
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      dateParam = `${year}-${month}`;
                    }
                    if (deleteStep.scope === 'annual') {
                      dateParam = now.getFullYear().toString();
                    }

                    await api.deleteUserData(deleteStep.scope, dateParam);
                    alert('¡Datos eliminados correctamente!');
                    window.location.reload();
                  } catch (e: any) {
                    alert('Error al eliminar: ' + (e.message || e));
                    setDeleteStep(null);
                  }
                }}
              >
                {deleteStep.step === 'executing' ? 'Borrando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed bottom-4 left-4 right-4 lg:left-80 p-3 md:p-4 ${themeColors.sidebarBg} backdrop-blur-xl border border-white/5 rounded-2xl flex justify-center items-center animate-in slide-in-from-bottom-4 duration-500 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`}>
        <div className="flex gap-4 w-full justify-center">
          <Button
            variant="outline"
            className="rounded-xl w-14 h-14 p-0 md:w-auto md:h-auto md:px-6 md:py-3 flex items-center justify-center flex-1 md:flex-none max-w-[120px]"
            onClick={() => {
              setConfigBuffer(initialConfig);
              setCardTracker((initialConfig.creditCards || []).map(c => ({ originalName: c, currentName: c })));
            }}
          >
            <i className="fas fa-rotate-left md:mr-2 text-xl md:text-base"></i> <span className="hidden md:inline">Deshacer</span>
          </Button>
          <Button
            variant="primary"
            className="rounded-xl shadow-lg shadow-blue-500/20 w-14 h-14 p-0 md:w-auto md:h-auto md:px-6 md:py-3 flex items-center justify-center flex-1 md:flex-none max-w-[120px]"
            onClick={() => {
              if (onCardRenames) {
                const renames: Record<string, string> = { ...orphanResolutions };
                cardTracker.forEach(c => {
                  if (c.originalName && c.originalName !== c.currentName) {
                    renames[c.originalName] = c.currentName;
                  }
                });
                if (Object.keys(renames).length > 0) {
                  onCardRenames(renames);
                  setOrphanResolutions({}); // Clear after apply
                }
              }
              onUpdateConfig(configBuffer);
              alert('¡Configuración guardada exitosamente!');
            }}
          >
            <i className="fas fa-check md:mr-2 text-xl md:text-base"></i> <span className="hidden md:inline">Guardar</span>
          </Button>
        </div>
      </div>
    </>
  );
};
