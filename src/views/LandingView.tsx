import React, { useState, useEffect, useRef } from 'react';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';

import Footer from '../components/landing/Footer';
import PrivacyPage from '../components/landing/PrivacyPage';
import TermsPage from '../components/landing/TermsPage';
import { View } from '../components/landing/types';
import { api } from '../services/api';

interface LandingViewProps {
    onLogin: (user: any) => void;
    defaultView?: View;
}

export const LandingView: React.FC<LandingViewProps> = ({ onLogin: onAppLogin, defaultView = 'home' }) => {
    const [view, setView] = useState<View>(defaultView);
    const [error, setError] = useState('');

    // Google Login Hook
    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Exchange code/token for backend session
                // Note: The original implementation used credentialResponse.credential (ID Token)
                // useGoogleLogin implicitly provides an access token flow usually, but we need ID token or similar?
                // Actually, api.googleLogin expects an ID Token string.
                // useGoogleLogin default flow is 'implicit' (access_token).
                // WE NEED 'id_token' flow or handle access_token in backend.
                // BUT my backend (previous checks) seemed to verify default credentials.
                // Let's stick to the Component <GoogleLogin> if possible? 
                // NO, the buttons are custom.
                // I need useGoogleLogin with flow: 'auth-code' or just use the google button logic?
                // Wait, standard useGoogleLogin 'implicit' flow returns access_token.
                // If my backend validates ID Token, this might fail.
                // Let's use flow: 'auth-code' if backend exchanges it, or check what api.googleLogin does.
                // Checking previous code: api.googleLogin(credential) -> calls /api/auth/google with { token: credential }
                // The credential from <GoogleLogin> is a JWT ID Token.
                // useGoogleLogin with default options gives access_token (Opaque).
                // I should request flow inside useGoogleLogin?
                // OR: I can render the <GoogleLogin> invisible and trigger it? No.
                // Correct way: useGoogleLogin({ onSuccess: ... }) gives TokenResponse (access_token).
                // I need user info. 
                // Let's fetch user info using the access token then send to backend? or send access_token to backend?
                // My backend likely expects ID TOKEN.
                // I will assume I need to fetch the user profile with the access token, 
                // OR I can try to get the ID Token via useGoogleLogin if configured?
                // Actually, easier path: use the `onLogin` to just scroll to a "Login Section" where I put the standard button?
                // User requested "Login with Google" button. The new design has "Empieza Gratis".
                // I'll try to use the hook. If I need ID token, I can get it via `onSuccess` response if `flow: 'implicit'`?
                // Actually, google's new Identity Services SDK (GSI) used by @react-oauth/google returns ID Token in <GoogleLogin> but access token in useGoogleLogin.
                // I will try to use the access token. 
                // WARNING: If backend expects ID token, I must change backend or frontend.
                // Let's look at `api.googleLogin` logic if I can.

                // TEMPORARY FIX: I will use a simple function that calls the /userinfo endpoint of Google 
                // with the access token, and then... wait, my backend validates the token.
                // If I can't verify backend, I should probably stick to what works:
                // The previous LandingView used <GoogleLogin>.
                // I will Overlay the <GoogleLogin> button on top of the "Empezar" button? No, that's ugly.
                // I will try to implement the `googleLogin` function to get the response.

            } catch (err) {
                console.error(err);
                setError('Login failed');
            }
        },
        onError: () => setError('Login Failed'),
    });

    // Re-evaluating: usage of useGoogleLogin.
    // Ideally, I'd fetch https://www.googleapis.com/oauth2/v3/userinfo with the access_token.
    // Then send that profile to my backend? Or creates a session?
    // Previous `api.googleLogin` sends `token` to server. `server` uses `oauth2Client.verifyIdToken`.
    // So the server EXPECTS AN ID TOKEN.
    // `useGoogleLogin` does NOT return an ID Token easily in the implicit flow (it returns access_token).
    // I can switch to `flow: 'auth-code'`, get a code, and swap it?

    // ALTERNATIVE:
    // Render the <GoogleLogin> component but STYLE IT to match the design?
    // <GoogleLogin> renders an iframe. Hard to style.

    // WORKAROUND:
    // I will use the `useGoogleLogin` hook, get the `access_token`.
    // Then I will call `https://www.googleapis.com/oauth2/v3/userinfo` manually to get the user's email/sub.
    // THEN... I can't sign a JWT for the backend. The backend needs to verify it.

    // WAIT. I can use `useGoogleLogin` with `flow: 'implicit'` and scope `openid email profile`.
    // Does it return `id_token` in the response?
    // Docs say: For implicit flow, it returns `access_token`.

    // Okay, I will modify `api.ts` or add a new endpoint? No, can't touch backend easily (it's verified).
    // I must provide an ID Token.
    // There is a way! `useGoogleLogin` can return ID Token if configured?
    // Actually, I can use the `<GoogleLogin render={...} />` prop?
    // The newer `@react-oauth/google` removed the `render` prop. It only supports the standard button or the hook.

    // Let's look at the `api.googleLogin` from previous turns to be sure.

    // DECISION:
    // I will assume for now I can figure this out.
    // But to be safe and deliver quickly, I will add a "Login" Modal or Section that renders the STANDARD <GoogleLogin> button which I KNOW works, 
    // when the user clicks "Empezar Gratis".
    // This is safer.

    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleLoginClick = () => {
        // Instead of direct hook, show modal with the official button
        setShowLoginModal(true);
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
            if (!credentialResponse.credential) throw new Error('No credential received');
            const data = await api.googleLogin(credentialResponse.credential) as any;

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('loginHistory', 'true');

            onAppLogin(data.user);
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión con Google');
        }
    };

    // Scroll Container Ref
    const containerRef = useRef<HTMLDivElement>(null);

    // Internal Routing Logic
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');

            if (hash === 'privacy' || hash === 'terms') {
                setView(hash as View);
                if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if (!hash) {
                    setView('home');
                    if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    setView('home');
                    // Scroll to section
                    setTimeout(() => {
                        const element = document.getElementById(hash);
                        if (element) element.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        // Initial check
        if (window.location.hash) {
            handleHashChange();
        } else {
            setView(defaultView);
        }

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [defaultView]);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            window.history.pushState(null, '', `#${id}`);
        }
    };

    const handleNavigate = (newView: View, sectionId?: string) => {
        if (newView === 'home') {
            if (sectionId) {
                window.location.hash = sectionId;
                setView('home');
                setTimeout(() => scrollToSection(sectionId), 50);
            } else {
                window.location.hash = '';
                setView('home');
                if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            window.location.hash = newView;
            setView(newView);
            if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'privacy':
                return <PrivacyPage />;
            case 'terms':
                return <TermsPage />;
            default:
                return (
                    <>
                        <Hero
                            onScrollToDemo={() => scrollToSection('demo')}
                            onScrollToPricing={() => scrollToSection('pricing')}
                            onLogin={handleLoginClick}
                        />

                        <section className="py-20 border-y border-white/5 bg-slate-900/20">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                    {[
                                        { label: 'Usuarios Activos', value: '500k+' },
                                        { label: 'Transacciones', value: '$2B+' },
                                        { label: 'Países', value: '45+' },
                                        { label: 'Rating App Store', value: '4.9/5' },
                                    ].map((stat) => (
                                        <div key={stat.label} className="text-center group cursor-default">
                                            <p className="text-3xl md:text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors">{stat.value}</p>
                                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div id="features">
                            <Features />
                        </div>
                    </>
                );
        }
    };

    return (
        <div ref={containerRef} className="h-screen overflow-y-auto text-slate-200 selection:bg-blue-500/30 overflow-x-hidden bg-slate-950 font-sans scroll-smooth">
            <Navbar onNavigate={handleNavigate} onLogin={handleLoginClick} />
            <main className="pt-20">{renderContent()}</main>
            <Footer onNavigate={handleNavigate} />

            {/* Login Modal */}
            {showLoginModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative shadow-2xl">
                        <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                            <i className="fas fa-times text-xl"></i>
                        </button>
                        <h3 className="text-2xl font-bold text-white mb-2 text-center">Bienvenido a Nexus</h3>
                        <p className="text-slate-400 text-center mb-8">Inicia sesión para continuar</p>

                        <div className="flex justify-center mb-6">
                            {/* Dynamically import GoogleLogin to avoid SSR issues if any, but standard import is fine */}
                            {/* We use a wrapper to style it or just center it */}
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError('Error al conectar con Google')}
                                theme="filled_black"
                                shape="pill"
                                text="continue_with"
                                width="250"
                            />
                        </div>
                        {error && <p className="text-rose-500 text-center text-sm">{error}</p>}

                        <div className="text-center mt-6">
                            <a href="/login-manual" className="text-xs text-slate-500 hover:text-white uppercase tracking-wider font-bold">
                                Usar contraseña
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
