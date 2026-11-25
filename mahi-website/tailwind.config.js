/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // The MAHI dashboard ships its own design system (src/legacy/app.css).
  // Tailwind's global reset is disabled so it cannot alter that design; Tailwind
  // utilities style the login, loading and setup screens.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: { forest: '#1B5E20', emerald: '#2E9E4F', navy: '#12263F', gold: '#C9A227' },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
};
