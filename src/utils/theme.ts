// Theme utility to get color classes based on user preference
export const getThemeColors = () => {
    const theme = typeof window !== 'undefined' ? (localStorage.getItem('colorTheme') || 'new') : 'new';

    return {
        // Avatar colors
        avatar: theme === 'new'
            ? 'bg-gradient-to-br from-teal-400 to-emerald-500'
            : 'bg-blue-500',

        // Button colors
        primaryButton: theme === 'new'
            ? 'bg-teal-500 hover:bg-teal-600'
            : 'bg-emerald-600 hover:bg-emerald-700',

        // Secondary button (invite)
        secondaryButton: theme === 'new'
            ? 'bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 border border-teal-500/30'
            : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30',

        // Tab active colors
        tabActive: theme === 'new'
            ? 'text-teal-400 border-b-2 border-teal-400'
            : 'text-blue-400 border-b-2 border-blue-400',

        // Hover colors
        hoverText: theme === 'new'
            ? 'hover:text-teal-400'
            : 'hover:text-blue-400',

        // Icon colors
        iconBg: theme === 'new'
            ? 'bg-teal-500/20 text-teal-400'
            : 'bg-blue-500/20 text-blue-400',

        // Amount display
        amountText: theme === 'new'
            ? 'text-teal-400'
            : 'text-blue-400',

        // Backgrounds
        background: theme === 'new'
            ? 'bg-[#020617]' // Slate 950 (Darker for New)
            : 'bg-[#0f172a]', // Slate 900 (Original)

        card: theme === 'new'
            ? 'bg-[#0f172a]' // Slate 900
            : 'bg-[#1e293b]', // Slate 800

        text: 'text-slate-300', // Shared for now

        input: theme === 'new'
            ? 'bg-slate-900/50 border-slate-800 focus:border-teal-500'
            : 'bg-slate-900/50 border-slate-700 focus:border-blue-500',

        accent: theme === 'new'
            ? 'text-teal-400'
            : 'text-blue-400',

        border: theme === 'new'
            ? 'border-slate-800'
            : 'border-slate-700',

        // Sidebar specific
        sidebarBg: theme === 'new'
            ? 'bg-[#020617]/90'
            : 'bg-[#0f172a]/90',

        logoGradient: theme === 'new'
            ? 'from-teal-500 to-emerald-600'
            : 'from-blue-600 to-indigo-600',

        sidebarActive: theme === 'new'
            ? 'bg-gradient-to-r from-teal-600/20 to-transparent text-white shadow-lg shadow-teal-500/10 border-l-4 border-teal-500'
            : 'bg-gradient-to-r from-blue-600/20 to-transparent text-white shadow-lg shadow-blue-500/10 border-l-4 border-blue-500',

        sidebarIconActive: theme === 'new'
            ? 'text-teal-400 drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]'
            : 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    };
};

// Toggle theme function
export const toggleTheme = () => {
    const currentTheme = localStorage.getItem('colorTheme') || 'new';
    const newTheme = currentTheme === 'new' ? 'original' : 'new';
    localStorage.setItem('colorTheme', newTheme);
    window.location.reload();
};

// Get current theme
export const getCurrentTheme = () => {
    return typeof window !== 'undefined' ? (localStorage.getItem('colorTheme') || 'new') : 'new';
};
