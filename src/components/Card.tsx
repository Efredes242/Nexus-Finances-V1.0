
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'glass' | 'neon' | 'outlined';
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  title, 
  subtitle, 
  headerActions, 
  onClick,
  variant = 'default',
  noPadding = false
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'glass':
        return 'glass-card hover:bg-slate-800/50 transition-colors duration-300 border-t border-t-white/10';
      case 'neon':
        return 'glass border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_25px_rgba(59,130,246,0.2)] transition-all duration-300 border-t border-t-blue-400/20';
      case 'outlined':
        return 'bg-transparent border border-white/10 hover:border-white/20 transition-colors';
      default:
        return 'glass';
    }
  };

  return (
    <div 
      className={`${getVariantClasses()} rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle || headerActions) && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-6 lg:pt-6 lg:pb-2 border-b border-white/5 mb-2">
          <div className="space-y-1">
            {title && <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 font-medium tracking-wide">{subtitle}</p>}
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      <div className={`${noPadding ? '' : 'p-4 lg:p-6'} flex-1 min-h-0`}>
        {children}
      </div>
    </div>
  );
};
