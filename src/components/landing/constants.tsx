
import React from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  CreditCard,
  Settings
} from 'lucide-react';
import { Feature, PricingPlan } from './types';

export const FEATURES: Feature[] = [
  {
    id: 'f1',
    title: 'Dashboard Inteligente',
    description: 'Toda tu información financiera resumida en un solo lugar con métricas de alto impacto.',
    icon: <LayoutDashboard className="w-6 h-6 text-blue-400" />
  },
  {
    id: 'f2',
    title: 'Análisis Predictivo',
    description: 'Visualiza tendencias y prevé tus gastos futuros mediante algoritmos avanzados.',
    icon: <TrendingUp className="w-6 h-6 text-blue-400" />
  },
  {
    id: 'f3',
    title: 'Seguridad de Nivel Bancario',
    description: 'Tus datos están protegidos con encriptación AES-256 de extremo a extremo.',
    icon: <ShieldCheck className="w-6 h-6 text-blue-400" />
  },
  {
    id: 'f4',
    title: 'Integración Instantánea',
    description: 'Conecta tus cuentas bancarias y tarjetas en cuestión de segundos.',
    icon: <Zap className="w-6 h-6 text-blue-400" />
  }
];

export const PRICING: PricingPlan[] = [
  {
    name: 'Básico',
    price: '0',
    features: ['Hasta 2 cuentas', 'Reportes mensuales', 'Soporte vía email']
  },
  {
    name: 'Pro',
    price: '19',
    recommended: true,
    features: ['Cuentas ilimitadas', 'IA de predicción', 'Soporte prioritario', 'Exportación avanzada']
  },
  {
    name: 'Empresa',
    price: '49',
    features: ['Múltiples usuarios', 'API Access', 'Account Manager', 'Custom Dashboards']
  }
];

export const MOCK_TRANSACTIONS = [
  { id: '1', concept: 'Salario Tech Corp', label: 'Ingresos', method: 'Transferencia', amount: 3500000, type: 'income', date: '01/10/2024' },
  { id: '2', concept: 'Alquiler Casa', label: 'Gastos Fijos', method: 'Efectivo', amount: 715820, type: 'expense', date: '05/10/2024' },
  { id: '3', concept: 'Supermercado', label: 'Gastos Variables', method: 'Tarjeta', amount: 120500, type: 'expense', date: '08/10/2024' },
  { id: '4', concept: 'Suscripción SaaS', label: 'Gastos Fijos', method: 'Tarjeta', amount: 15400, type: 'expense', date: '10/10/2024' },
];
