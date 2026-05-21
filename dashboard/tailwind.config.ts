import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ks: {
          navy: '#0C4A6E',
          blue: '#0284C7',
          sky: '#0EA5E9',
          mist: '#E0F2FE',
          paper: '#F8FAFC',
          slate: '#0F172A',
          muted: '#64748B',
          line: '#E2E8F0',
          gold: '#F4B740',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
        surface: '#faf8ff',
        'on-surface': '#131b2e',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      spacing: {
        'sidebar-width': '256px',
        'topbar-height': '60px',
        'margin-page': '40px',
        gutter: '32px',
        'stack-sm': '8px',
        'stack-md': '16px',
        'stack-lg': '24px',
      },
      boxShadow: {
        shell: '0 24px 80px rgba(15, 23, 42, 0.12)',
        layer: '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config;
