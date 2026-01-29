import React from 'react';

export const PrivacyView: React.FC = () => {
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
                <h1 className="text-4xl font-black text-white mb-8">Política de Privacidad</h1>

                <div className="space-y-6 text-slate-400 leading-relaxed">
                    <p>Última actualización: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">1. Introducción</h2>
                        <p>
                            Bienvenido a Nexus Finance. Respetamos su privacidad y nos comprometemos a proteger sus datos personales.
                            Esta política de privacidad le informará sobre cómo cuidamos sus datos personales cuando utiliza nuestra aplicación y le informará sobre sus derechos de privacidad y cómo la ley lo protege.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">2. Datos que recopilamos</h2>
                        <p>
                            Podemos recopilar, usar, almacenar y transferir diferentes tipos de datos personales sobre usted, que hemos agrupado de la siguiente manera:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Datos de Identidad:</strong> incluye nombre, apellido, nombre de usuario.</li>
                            <li><strong>Datos de Contacto:</strong> incluye dirección de correo electrónico.</li>
                            <li><strong>Datos Financieros:</strong> incluye detalles de ingresos, gastos, metas de ahorro y presupuestos que usted ingrese en la aplicación.</li>
                            <li><strong>Datos Técnicos:</strong> incluye dirección IP, datos de inicio de sesión, tipo y versión del navegador.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">3. Cómo usamos sus datos</h2>
                        <p>
                            Solo usaremos sus datos personales cuando la ley nos lo permita. Más comúnmente, usaremos sus datos personales en las siguientes circunstancias:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Para registrarlo como nuevo usuario.</li>
                            <li>Para proporcionarle las funcionalidades de gestión financiera de la aplicación.</li>
                            <li>Para gestionar nuestra relación con usted.</li>
                            <li>Para mejorar nuestro sitio web, productos/servicios, marketing, relaciones con los clientes y experiencias.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">4. Seguridad de los datos</h2>
                        <p>
                            Hemos implementado medidas de seguridad adecuadas para evitar que sus datos personales se pierdan accidentalmente, se usen o accedan de forma no autorizada, se alteren o divulguen.
                            Además, limitamos el acceso a sus datos personales a aquellos empleados, agentes, contratistas y otros terceros que tengan una necesidad comercial de conocerlos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">5. Sus derechos legales</h2>
                        <p>
                            Bajo ciertas circunstancias, usted tiene derechos bajo las leyes de protección de datos en relación con sus datos personales, incluyendo el derecho a solicitar acceso, corrección, borrado, restricción, transferencia de sus datos personales u objetar el procesamiento de los mismos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-blue-400 mb-2">6. Contacto</h2>
                        <p>
                            Si tiene preguntas sobre esta política de privacidad o nuestras prácticas de privacidad, por favor contáctenos a través de los canales de soporte de la aplicación.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};
