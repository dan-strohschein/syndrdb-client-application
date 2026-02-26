/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,ts,lit-html}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
        'mono': ['Geist Mono', 'ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace']
      },
      colors: {
        // Database UI specific colors
        'db-dark': '#1a1a1a',
        'db-panel': '#2d2d2d',
        'db-sidebar': '#252526',
        'db-hover': '#37373d',
        'db-selected': '#094771',
        'db-border': '#3e3e42',

        // Accent color system — Electric Indigo
        'accent': {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
          subtle: 'rgba(99, 102, 241, 0.10)',
        },

        // Surface elevation levels (dark mode depth)
        'surface': {
          0: '#121212',
          1: '#1a1a1a',
          2: '#232323',
          3: '#2d2d2d',
          4: '#353535',
        },

        // Semantic feedback palette
        'feedback': {
          success: '#22C55E',
          error: '#EF4444',
          warning: '#F59E0B',
          info: '#3B82F6',
          active: '#6366F1',
          muted: '#9CA3AF',
        },
      },
      keyframes: {
        'modal-enter': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'modal-exit': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.97)' },
        },
        'backdrop-enter': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'backdrop-exit': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-out-left': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(-20px)' },
        },
        'toast-enter': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.95)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-exit': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-once': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.5)' },
          '100%': { transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-2px)' },
          '40%, 80%': { transform: 'translateX(2px)' },
        },
        'expand-collapse': {
          from: { gridTemplateRows: '0fr' },
          to: { gridTemplateRows: '1fr' },
        },
        'chevron-rotate': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(90deg)' },
        },
        'context-menu-enter': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)', width: '40%' },
          '50%': { width: '60%' },
          '100%': { transform: 'translateX(250%)', width: '40%' },
        },
        'tab-enter': {
          from: { opacity: '0', transform: 'translateX(12px)', maxWidth: '0' },
          to: { opacity: '1', transform: 'translateX(0)', maxWidth: '200px' },
        },
        'tab-exit': {
          from: { opacity: '1', transform: 'translateX(0)', maxWidth: '200px' },
          to: { opacity: '0', transform: 'translateX(-8px)', maxWidth: '0' },
        },
      },
      animation: {
        'modal-enter': 'modal-enter 200ms ease-out',
        'modal-exit': 'modal-exit 150ms ease-in forwards',
        'backdrop-enter': 'backdrop-enter 200ms ease-out',
        'backdrop-exit': 'backdrop-exit 150ms ease-in forwards',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-up': 'slide-in-up 200ms ease-out',
        'slide-out-left': 'slide-out-left 200ms ease-in forwards',
        'toast-enter': 'toast-enter 300ms ease-out',
        'toast-exit': 'toast-exit 200ms ease-in forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-once': 'pulse-once 300ms ease-out',
        'shake': 'shake 200ms ease-out',
        'expand-collapse': 'expand-collapse 200ms ease-out',
        'chevron-rotate': 'chevron-rotate 150ms ease-out forwards',
        'context-menu-enter': 'context-menu-enter 120ms ease-out',
        'spin': 'spin 600ms linear infinite',
        'progress-indeterminate': 'progress-indeterminate 1.5s ease-in-out infinite',
        'tab-enter': 'tab-enter 200ms ease-out',
        'tab-exit': 'tab-exit 150ms ease-in forwards',
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'elevation-2': '0 2px 6px rgba(0, 0, 0, 0.35)',
        'elevation-3': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'elevation-4': '0 8px 24px rgba(0, 0, 0, 0.45)',
        'focus-ring': '0 0 0 4px rgba(99, 102, 241, 0.15)',
      },
    }
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      "dark", // Use DaisyUI's dark theme as default
      "light",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "cyberpunk",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "aqua",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter"
    ],
    darkTheme: "dark", // Set dark as the default dark theme
    base: true, // Include base styles
    styled: true, // Include component styles
    utils: true, // Include utility classes
    prefix: "", // No prefix for DaisyUI classes
    logs: true, // Show info about DaisyUI in console
  }
}
