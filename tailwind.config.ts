import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fog: '#EEF0EE', paper: '#FFFFFF', ink: '#1F2A37', mute: '#6B7280', line: '#D9DDD9',
        cobalt: { DEFAULT: '#2743C6', soft: '#E3E8FA', ink: '#1B2E8A' },
        ochre: { DEFAULT: '#C48A1E', soft: '#FBF1DC' },
        moss: { DEFAULT: '#3F7A4A', soft: '#DFEBDD' },
        brick: { DEFAULT: '#B4463A', soft: '#F6DCD8' },
      },
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'] },
      borderRadius: { md: '6px', lg: '10px' },
    },
  },
  plugins: [],
} satisfies Config;
