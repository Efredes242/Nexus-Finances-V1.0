import React from 'react';

export const TermsView: React.FC = () => {
    return (
        <div className="h-screen overflow-y-auto bg-[#020617] text-slate-300 font-outfit custom-scrollbar">
            {/* Header with Logo linking back to Home */}
            <header className="fixed top-0 left-0 w-full glass z-50 px-6 py-4 border-b border-white/5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <a href="/" className="flex items-center gap-3 group cursor-pointer">
                        <img src="/logo-n.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform duration-300 mix-blend-screen" />
                        <div>
                            <h1 className="text-lg font-black tracking-wide leading-none text-white">NEXUS<span className="text-blue-500">FINANCE</span></h1>
                        </div>
                    </a>
                </div>
            </header>

            {/* Content */}
            <main className="pt-28 pb-20 px-6 max-w-4xl mx-auto">
                <h1 className="text-4xl font-black text-white mb-8">Términos y Condiciones</h1>

                <div className="space-y-6 text-slate-400 leading-relaxed">
                    <p>Última actualización: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">1. Aceptación de los Términos</h2>
                        <p>
                            Al acceder y utilizar Nexus Finance, usted acepta cumplir y estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">2. Descripción del Servicio</h2>
                        <p>
                            Nexus Finance es una herramienta de gestión de finanzas personales que permite a los usuarios realizar un seguimiento de sus ingresos, gastos, presupuestos y metas de ahorro. El servicio se proporciona "tal cual" y "según disponibilidad".
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">3. Cuentas de Usuario</h2>
                        <p>
                            Cuando crea una cuenta con nosotros, debe proporcionarnos información precisa, completa y actual en todo momento. El incumplimiento de esto constituye una violación de los Términos, lo que puede resultar en la terminación inmediata de su cuenta en nuestro servicio.
                        </p>
                        <p className="mt-2">
                            Usted es responsable de salvaguardar la contraseña que utiliza para acceder al servicio y de cualquier actividad o acción bajo su contraseña.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">4. Propiedad Intelectual</h2>
                        <p>
                            El servicio y su contenido original, características y funcionalidad son y seguirán siendo propiedad exclusiva de Nexus Finance y sus licenciantes. El servicio está protegido por derechos de autor, marcas registradas y otras leyes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">5. Enlaces a Otros Sitios Web</h2>
                        <p>
                            Nuestro servicio puede contener enlaces a sitios web o servicios de terceros que no son propiedad ni están controlados por Nexus Finance. Nexus Finance no tiene control sobre, y no asume ninguna responsabilidad por, el contenido, las políticas de privacidad o las prácticas de sitios web o servicios de terceros.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">6. Terminación</h2>
                        <p>
                            Podemos terminar o suspender su cuenta inmediatamente, sin previo aviso o responsabilidad, por cualquier motivo, incluso, entre otros, si usted incumple los Términos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">7. Limitación de Responsabilidad</h2>
                        <p>
                            En ningún caso Nexus Finance, ni sus directores, empleados, socios, agentes, proveedores o afiliados, serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo, entre otros, pérdida de beneficios, datos, uso, buena voluntad u otras pérdidas intangibles, resultantes de su acceso o uso o incapacidad para acceder o usar el servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">8. Cambios</h2>
                        <p>
                            Nos reservamos el derecho, a nuestra sola discreción, de modificar o reemplazar estos Términos en cualquier momento. Si una revisión es material, intentaremos proporcionar un aviso con al menos 30 días de antelación antes de que entren en vigor los nuevos términos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">9. Contacto</h2>
                        <p>
                            Si tiene alguna pregunta sobre estos Términos, por favor contáctenos.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};
