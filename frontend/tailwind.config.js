/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b111e',
        panelBg: '#131c2e',
        borderSlate: '#1e293b',
        brandBlue: '#2563eb',
        statusGreen: '#10b981',
        statusOrange: '#f59e0b',
        statusRed: '#ef4444',
        statusPurple: '#8b5cf6'
      }
    },
  },
  plugins: [],
}
