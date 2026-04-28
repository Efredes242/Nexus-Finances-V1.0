import React, { useState } from 'react';
import { api } from '../services/api';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface LoginProps {
  onLogin: (user: any) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false); // Default to LOGIN
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // New for registration
  const [rememberMe, setRememberMe] = useState(true); // Default true
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoginHistory, setHasLoginHistory] = useState(false);

  const [pendingUser, setPendingUser] = useState<{ message: string, email: string, approval_status?: string } | null>(null);

  // Check if this is first install (no users exist)
  React.useEffect(() => {
    const checkFirstInstall = async () => {
      try {
        const { hasUsers } = await api.hasUsers() as any;
        // If NO users exist → show registration (first install)
        // If users exist → show login
        setIsRegistering(!hasUsers);
      } catch (err) {
        console.error('Failed to check users:', err);
        // Default to login screen if check fails
        setIsRegistering(false);
      }
    };

    checkFirstInstall();

    const history = localStorage.getItem('loginHistory');
    if (history) setHasLoginHistory(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation for registration
    if (isRegistering) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }
    }

    try {
      let data;
      if (isRegistering) {
        data = await api.register(username, password) as any;
      } else {
        data = await api.login(username, password) as any;
      }

      // Storage Logic
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', data.token);
      storage.setItem('user', JSON.stringify(data.user));

      // Mark as having logged in before
      localStorage.setItem('loginHistory', 'true');

      // Clear other storage just in case
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      otherStorage.removeItem('token');
      otherStorage.removeItem('user');

      onLogin(data.user);
    } catch (err: any) {
      if (err.data && (err.data.approval_status === 'PENDING' || err.data.approval_status === 'REJECTED')) {
        setPendingUser(err.data);
      } else {
        setError(err.message || (isRegistering ? 'Error al crear cuenta' : 'Error al iniciar sesión'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    console.log('[FRONTEND] Google login initiated', { hasCredential: !!credentialResponse.credential });
    setLoading(true);
    setError('');
    try {
      if (!credentialResponse.credential) {
        console.error('[FRONTEND] No credential received from Google');
        throw new Error('No credential received');
      }

      console.log('[FRONTEND] Calling backend /api/auth/google...');
      const data = await api.googleLogin(credentialResponse.credential) as any;
      console.log('[FRONTEND] Backend response received:', { hasToken: !!data.token, hasUser: !!data.user });

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', data.token);
      storage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('loginHistory', 'true');

      const otherStorage = rememberMe ? sessionStorage : localStorage;
      otherStorage.removeItem('token');
      otherStorage.removeItem('user');

      console.log('[FRONTEND] Login successful, calling onLogin()');
      onLogin(data.user);
    } catch (err: any) {
      console.error('[FRONTEND] Google login error:', err);
      // Check for approval_status directly on the error object (since we throw raw object now)
      if (err.approval_status === 'PENDING' || err.approval_status === 'REJECTED') {
        setPendingUser(err);
      } else if (err.data && (err.data.approval_status === 'PENDING' || err.data.approval_status === 'REJECTED')) {
        // Fallback for legacy behavior just in case
        setPendingUser(err.data);
      } else {
        setError(err.message || 'Error al iniciar sesión con Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Error al iniciar sesión con Google');
  };

  // Visual Theme Config
  const theme = isRegistering ? {
    gradientIcon: 'from-emerald-500 to-teal-600',
    gradientButton: 'from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500',
    shadowColor: 'shadow-emerald-500/20',
    focusColor: 'focus:border-emerald-500',
    titleHighlight: 'text-emerald-500'
  } : {
    gradientIcon: 'from-blue-600 to-indigo-600',
    gradientButton: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
    shadowColor: 'shadow-blue-500/20',
    focusColor: 'focus:border-blue-500',
    titleHighlight: 'text-blue-500'
  };

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background Blobs - Fixed to viewport */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] transition-colors duration-500 ${isRegistering ? 'bg-emerald-600/20' : 'bg-blue-600/20'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] transition-colors duration-500 ${isRegistering ? 'bg-teal-600/20' : 'bg-indigo-600/20'}`}></div>
      </div>

      {/* Scrollable Container */}
      <div className="w-full h-full overflow-y-auto absolute inset-0 flex flex-col items-center p-4">
        {pendingUser ? (
          /* PENDING/REJECTED MODAL */
          <div className={`w-full max-w-md bg-slate-900/50 p-6 lg:p-8 rounded-3xl border backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-500 my-auto animate-in zoom-in-95 ${pendingUser.approval_status === 'REJECTED' ? 'border-rose-500/30' : 'border-amber-500/30'
            }`}>
            <div className="text-center mb-6">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 animate-pulse ${pendingUser.approval_status === 'REJECTED' ? 'bg-rose-500/10' : 'bg-amber-500/10'
                }`}>
                <i className={`fas text-4xl ${pendingUser.approval_status === 'REJECTED' ? 'fa-ban text-rose-500' : 'fa-clock text-amber-500'
                  }`}></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {pendingUser.approval_status === 'REJECTED' ? 'Acceso Denegado' : 'Solicitud en Revisión'}
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                {pendingUser.message}
              </p>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Cuenta solicitada</p>
                <p className="text-white font-mono text-sm">{pendingUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setPendingUser(null);
                  setError('');
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all border border-white/10"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        ) : (
          /* LOGIN FORM */
          <div className="w-full max-w-md bg-slate-900/50 p-6 lg:p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-500 my-auto">
            <div className="text-center mb-6 lg:mb-8">
              <div className={`w-20 h-20 lg:w-24 lg:h-24 bg-transparent mx-auto flex items-center justify-center mb-4 lg:mb-6 transition-all duration-500`}>
                <img src="/logo-n.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(59,130,246,0.5)]" />
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-white mb-2 tracking-tight">NEXUS<span className={`${theme.titleHighlight} transition-colors duration-500`}>FINANCE</span></h1>
              <p className="text-slate-400 text-sm lg:text-base">
                {isRegistering ? 'Crea tu cuenta gratuita' : (hasLoginHistory ? 'Bienvenido de nuevo' : 'Bienvenido')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
              {/* ... form fields kept ... */}
              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Usuario</label>
                <div className="relative">
                  <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full bg-slate-800/50 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white outline-none ${theme.focusColor} transition-colors placeholder:text-slate-600`}
                    placeholder="usuario"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Contraseña</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-slate-800/50 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white outline-none ${theme.focusColor} transition-colors placeholder:text-slate-600`}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {isRegistering && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Confirmar Contraseña</label>
                  <div className="relative">
                    <i className="fas fa-check-circle absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-slate-800/50 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white outline-none ${theme.focusColor} transition-colors placeholder:text-slate-600`}
                      placeholder="••••••••"
                      required={isRegistering}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/10 bg-slate-800/50 checked:border-blue-500 checked:bg-blue-500 transition-all"
                  />
                  <i className="fas fa-check absolute left-1 top-1 text-[10px] text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></i>
                </div>
                <label htmlFor="rememberMe" className="text-slate-400 text-sm cursor-pointer select-none">
                  Mantener sesión iniciada
                </label>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-pulse">
                  <i className="fas fa-exclamation-circle"></i>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r ${theme.gradientButton} text-white font-bold py-4 rounded-xl transition-all shadow-lg ${theme.shadowColor} transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fas fa-spinner fa-spin"></i> Procesando...
                  </span>
                ) : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-4">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase font-bold">O continúa con</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  shape="pill"
                  text={isRegistering ? "signup_with" : "signin_with"}
                  width="320"
                />
              </div>

              <div className="text-center mt-4">
                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                    setUsername('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                  {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una gratis'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 mb-4 text-center w-full z-10 shrink-0 space-y-2">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Nexus Finance Serverless</p>
          <div className="flex justify-center gap-4">
            <a href="/privacy" className="text-slate-500 hover:text-blue-400 text-xs transition-colors">Política de Privacidad</a>
            <span className="text-slate-700 text-xs">•</span>
            <a href="/terminos" className="text-slate-500 hover:text-blue-400 text-xs transition-colors">Términos del Servicio</a>
          </div>
        </div>
      </div>
    </div>
  );
}
