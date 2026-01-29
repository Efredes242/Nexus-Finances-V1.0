
import React from 'react';

const TermsPage: React.FC = () => {
  return (
    <div className="pt-32 pb-24 max-w-4xl mx-auto px-6">
      <h1 className="text-4xl font-extrabold text-white mb-8">Términos y Condiciones</h1>
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-lg">Al acceder y utilizar Nexus Finance, aceptas cumplir con los siguientes términos de servicio.</p>
        
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Uso del Servicio</h2>
          <p>Nexus Finance es una herramienta de gestión financiera personal. No somos asesores financieros certificados y el uso de nuestra plataforma es bajo tu propia responsabilidad.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. Responsabilidad de la Cuenta</h2>
          <p>Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades que ocurran bajo tu cuenta.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Propiedad Intelectual</h2>
          <p>Todo el contenido, logos, y algoritmos son propiedad exclusiva de Nexus Finance. Queda prohibida la reproducción total o parcial sin consentimiento previo.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">4. Modificaciones</h2>
          <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado de la plataforma implica la aceptación de los nuevos términos.</p>
        </section>

        <p className="mt-12 text-xs text-slate-500 italic">Última actualización: Octubre 2024</p>
      </div>
    </div>
  );
};

export default TermsPage;
