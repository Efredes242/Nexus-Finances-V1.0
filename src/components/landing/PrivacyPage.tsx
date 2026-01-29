
import React from 'react';

const PrivacyPage: React.FC = () => {
  return (
    <div className="pt-32 pb-24 max-w-4xl mx-auto px-6">
      <h1 className="text-4xl font-extrabold text-white mb-8">Política de Privacidad</h1>
      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-lg">En Nexus Finance, tu privacidad es nuestra prioridad absoluta. Esta política describe cómo recopilamos, utilizamos y protegemos tu información.</p>
        
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Recopilación de Datos</h2>
          <p>Recopilamos información que proporcionas directamente al crear una cuenta, como tu nombre y correo electrónico, así como datos financieros que decidas integrar para el funcionamiento del dashboard.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. Uso de la Información</h2>
          <p>Utilizamos tus datos exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Proporcionar el análisis financiero y visualización de datos.</li>
            <li>Mejorar la experiencia del usuario y las funcionalidades de la app.</li>
            <li>Enviar comunicaciones críticas sobre tu cuenta o actualizaciones de seguridad.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Seguridad</h2>
          <p>Implementamos encriptación de grado bancario (AES-256) para asegurar que tus datos financieros nunca sean accesibles por terceros no autorizados.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">4. Tus Derechos</h2>
          <p>Puedes solicitar la exportación o eliminación total de tus datos en cualquier momento desde la configuración de tu perfil.</p>
        </section>

        <p className="mt-12 text-xs text-slate-500 italic">Última actualización: Octubre 2024</p>
      </div>
    </div>
  );
};

export default PrivacyPage;
