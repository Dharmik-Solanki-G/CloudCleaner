/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#2196F3',
                    dark: '#1976D2',
                    light: '#64B5F6'
                },
                success: '#4CAF50',
                warning: '#FFC107',
                danger: '#F44336',
                surface: '#FFFFFF',
                background: '#F5F7FA'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
            }
        },
    },
    plugins: [],
}
