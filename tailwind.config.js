/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                outfit: ['"Outfit"', 'sans-serif'],
            },
            colors: {
                border: "rgba(255, 255, 255, 0.1)",
                input: "rgba(255, 255, 255, 0.05)",
                ring: "#3b82f6",
                background: "#020617",
                foreground: "#f8fafc",
                primary: {
                    DEFAULT: "#3b82f6",
                    foreground: "#ffffff",
                },
                secondary: {
                    DEFAULT: "#1e293b",
                    foreground: "#f8fafc",
                },
                accent: {
                    DEFAULT: "#6366f1",
                    foreground: "#ffffff",
                },
                destructive: {
                    DEFAULT: "#f43f5e",
                    foreground: "#ffffff",
                },
                card: {
                    DEFAULT: "rgba(15, 23, 42, 0.6)",
                    foreground: "#f8fafc",
                }
            },
        },
    },
    plugins: [],
}
