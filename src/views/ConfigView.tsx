import React, { useState } from 'react';
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

export const ConfigView: React.FC<ConfigViewProps> = ({ user, initialConfig, onUpdateConfig, onCardRenames, usedCardNames = [], onSyncToCloud }) => {
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

  const [syncLoading, setSyncLoading] = useState(false);

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
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 mt-6 pb-32">
        <Card title="Preferencias del Ecosistema" subtitle="Configura la base de tu gestión financiera.">
          <div className="grid grid-cols-2 gap-8 mt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identidad del Usuario</label>
              <div className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-slate-400 font-bold flex items-center gap-3 cursor-not-allowed opacity-80">
                <i className="fas fa-user-lock text-slate-600"></i>
                <span>{user.firstName ? `${user.firstName} ${user.lastName}` : (user.username || 'Usuario')}</span>
              </div>
              <p className="text-[10px] text-slate-600 font-medium px-2">Gestionado por tu perfil de cuenta.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Símbolo Monetario</label>
              <div className="relative">
                <select
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all font-bold text-center appearance-none cursor-pointer"
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
          </div>
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

        <Card title="Sincronización en la Nube" subtitle="Resguarda tus datos en tu cuenta personal de Google Drive.">
          <div className="space-y-6 mt-4">
            <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10">
                  <i className="fab fa-google-drive text-xl"></i>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Respaldo Inmediato</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Crea una copia de seguridad manual ahora mismo.</p>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => handleDriveSync('download')}
                  disabled={syncLoading}
                >
                  <i className={`fas ${syncLoading ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'} mr-2`}></i> Restaurar (Copia Nube)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                  onClick={() => handleDriveSync('upload')}
                  disabled={syncLoading}
                >
                  <i className={`fas ${syncLoading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'} mr-2`}></i> Crear Respaldo
                </Button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic px-2">
              <i className="fas fa-shield-alt mr-2"></i>
              Tus datos se guardan de forma privada en tu propio Google Drive. Nexus no tiene acceso a otros archivos de tu cuenta.
            </p>
          </div>
        </Card>

        <Card title="Respaldo Cloudflare (Base de Datos)" subtitle="Sincronización manual directa con la base de datos de Nexus.">
          <div className="space-y-6 mt-4">
            <div className="p-6 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-500 shadow-lg shadow-indigo-500/10">
                  <i className="fas fa-database text-xl"></i>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Sincronización Forzada</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Envía todos tus datos locales a la nube de Cloudflare.</p>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                  onClick={async () => {
                    if (onSyncToCloud) {
                      if (confirm("Esto enviará todos tus datos locales a la base de datos remota. ¿Continuar?")) {
                        setSyncLoading(true);
                        try {
                          await onSyncToCloud();
                          alert("¡Sincronización completada con éxito!");
                        } catch (e: any) {
                          alert("Error al sincronizar: " + e.message);
                        } finally {
                          setSyncLoading(false);
                        }
                      }
                    }
                  }}
                  disabled={syncLoading}
                >
                  <i className={`fas ${syncLoading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'} mr-2`}></i> Forzar Sincronización
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic px-2">
              <i className="fas fa-info-circle mr-2"></i>
              Úsalo si notas que faltan datos en otros dispositivos.
            </p>
          </div>
        </Card>

        <div className="p-8 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/10 flex items-center justify-between">
          <div>
            <h4 className="text-rose-500 font-black text-sm uppercase tracking-widest">Zona de Reinicio</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">Borrar todos los datos locales de forma irreversible.</p>
          </div>
          <Button variant="danger" size="sm" className="rounded-xl" onClick={() => { if (confirm('¿Eliminar TODOS los datos?')) { localStorage.clear(); window.location.reload(); } }}>Eliminar Base de Datos</Button>
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-4 lg:left-80 p-4 bg-[#020617]/95 backdrop-blur-xl border border-white/5 rounded-2xl flex justify-between items-center animate-in slide-in-from-bottom-4 duration-500 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <h3 className="text-sm font-black text-white/50 uppercase tracking-widest hidden sm:block">Configuración</h3>
        <div className="flex gap-4 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setConfigBuffer(initialConfig);
              setCardTracker((initialConfig.creditCards || []).map(c => ({ originalName: c, currentName: c })));
            }}
          >
            <i className="fas fa-undo mr-2"></i> <span className="hidden sm:inline">Deshacer</span>
          </Button>
          <Button
            variant="primary"
            className="rounded-xl shadow-lg shadow-blue-500/20"
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
            <i className="fas fa-save mr-2"></i> <span className="hidden sm:inline">Guardar</span>
          </Button>
        </div>
      </div>
    </>
  );
};
