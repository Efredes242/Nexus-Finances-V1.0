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
            console.log('[LANDING] Google login success, accessToken received');
            try {
                // Use access_token to login via backend (which will fetch user profile)
                console.log('[LANDING] Calling backend with accessToken...');
                const data = await api.googleLogin({ accessToken: tokenResponse.access_token }) as any;
                console.log('[LANDING] Backend response:', { hasToken: !!data.token, hasUser: !!data.user });

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('loginHistory', 'true');
                console.log('[LANDING] Token and user saved to localStorage');

                console.log('[LANDING] Calling onAppLogin with user:', data.user);
                onAppLogin(data.user);
                console.log('[LANDING] onAppLogin called successfully');
            } catch (err: any) {
                console.error('[LANDING] Google login error:', err);
                setError(err.message || 'Error al iniciar sesión con Google');
            }
        },
        onError: () => {
            console.error('[LANDING] Google login failed');
            setError('Login Failed');
        },
        flow: 'implicit', // Returns access_token
        prompt: 'select_account' // 👈 This forces the account selector!
    });

    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleLoginClick = () => {
        setShowLoginModal(true);
    };

    // Standard handler (kept if needed, but unused with hook)
    const handleGoogleSuccess = async (credentialResponse: any) => {
        // ... legacy component handler
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
                            <button
                                onClick={() => googleLogin()}
                                className="flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-3 px-6 rounded-full hover:bg-slate-100 transition-colors w-full max-w-xs shadow-lg"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                <span>Continuar con Google</span>
                            </button>
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
