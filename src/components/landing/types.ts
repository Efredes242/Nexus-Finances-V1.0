
import React from 'react';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface Transaction {
  id: string;
  concept: string;
  label: string;
  method: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

export type View = 'home' | 'privacy' | 'terms';
