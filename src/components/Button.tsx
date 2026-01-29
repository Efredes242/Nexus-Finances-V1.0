
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:shadow-blue-500/40",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    outline: "border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20",
    ghost: "hover:bg-white/5 text-slate-400 hover:text-white",
    danger: "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white",
    glass: "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-11 px-5 py-2 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};
