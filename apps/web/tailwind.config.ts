import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Colours switch through CSS tokens (including system dark mode), so `dark:` variants are rarely needed.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        primary: token('primary'),
        'primary-contrast': token('primary-contrast'),
        danger: token('danger'),
        'st-open': token('st-open'),
        'st-closing': token('st-closing'),
        'st-opening': token('st-opening'),
        'st-closed': token('st-closed'),
        'st-unknown': token('st-unknown'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4 Variable"', 'Georgia', 'serif'],
      },
      screens: { coarse: { raw: '(pointer: coarse)' } },
      opacity: { '12': '0.12' },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        sm: '0 1px 2px rgb(16 24 40 / 0.06)',
        md: '0 4px 12px rgb(16 24 40 / 0.08)',
        lg: '0 12px 32px rgb(16 24 40 / 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
