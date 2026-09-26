import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fog: '#F5F5F3', paper: '#FFFFFF', ink: '#191B1D', mute: '#62666B', line: '#E1E2DF',
        cobalt: { DEFAULT: '#242A30', soft: '#EBEEF0', ink: '#242A30' },
        ochre: { DEFAULT: '#886015', soft: '#F7F2E7' },
        moss: { DEFAULT: '#32664D', soft: '#ECF3EE' },
        brick: { DEFAULT: '#A63732', soft: '#FAEDEC' },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'] },
      borderRadius: { md: '6px', lg: '8px', xl: '10px', '2xl': '12px' },
    },
  },
  plugins: [],
} satisfies Config;
