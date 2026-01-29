import { CategoryType } from '../types';

export const APP_TITLE_PREFIX = "NEXUS";
export const APP_TITLE_SUFFIX = "FINANCE";
export const APP_SUBTITLE = "";

export const categoryConfig: Record<CategoryType, { icon: string; color: string; bg: string; border: string }> = {
  [CategoryType.INCOME]: { 
    icon: 'fa-arrow-trend-up', 
    color: 'text-emerald-400', 
    bg: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/20'
  },
  [CategoryType.FIXED_EXPENSE]: { 
    icon: 'fa-file-invoice', 
    color: 'text-blue-400', 
    bg: 'from-blue-500/20 to-blue-900/10',
    border: 'border-blue-500/20'
  },
  [CategoryType.VARIABLE_EXPENSE]: { 
    icon: 'fa-cart-shopping', 
    color: 'text-amber-400', 
    bg: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-500/20'
  },
  [CategoryType.DEBT]: { 
    icon: 'fa-credit-card', 
    color: 'text-rose-400', 
    bg: 'from-rose-500/20 to-rose-900/10',
    border: 'border-rose-500/20'
  },
  [CategoryType.SAVINGS]: { 
    icon: 'fa-piggy-bank', 
    color: 'text-purple-400', 
    bg: 'from-purple-500/20 to-purple-900/10',
    border: 'border-purple-500/20'
  },
};
