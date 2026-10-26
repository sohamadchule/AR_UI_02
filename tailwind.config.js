/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Storefront faces: resolved from the active [data-brand] block.
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic tokens: values live in src/styles/index.css and flip with the theme.
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'rgb(var(--fg) / <alpha-value>)',
          soft: 'rgb(var(--fg-soft) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)',
          subtle: 'rgb(var(--fg-subtle) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        // Storefront accent; only defined inside a [data-brand] subtree.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
        // Showroom-only tones (the Kadam block): a second accent, and fixed dark / light
        // values for text and shop-front drawing over photographs, whatever the theme.
        olive: 'rgb(var(--olive) / <alpha-value>)',
        night: 'rgb(var(--night) / <alpha-value>)',
        ivory: 'rgb(var(--ivory) / <alpha-value>)',
      },
      borderRadius: {
        store: 'var(--store-radius)',
      },
      boxShadow: {
        product: 'var(--shadow-product)',
      },
      keyframes: {
        'color-spread': {
          from: { clipPath: 'circle(0% at 50% 62%)' },
          to: { clipPath: 'circle(95% at 50% 62%)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0) rotateY(0)' },
          '50%': { transform: 'translateY(-8px) rotateX(2deg) rotateY(-2deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.1' },
          '50%': { opacity: '0.3' },
        },
        // The showroom hero: a slow settle, like a camera finishing its move.
        'settle': {
          from: { transform: 'scale(1.12)' },
          to: { transform: 'scale(1.02)' },
        },
      },
      animation: {
        'color-spread': 'color-spread 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'float-slow': 'float-slow 12s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 8s ease-in-out infinite',
        'settle': 'settle 14s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
