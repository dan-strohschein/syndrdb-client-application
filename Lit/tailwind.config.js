/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,ts,lit-html}"
  ],
  theme: {
    extend: {
      colors: {
        // Database UI specific colors
        'db-dark': '#1a1a1a',
        'db-panel': '#2d2d2d',
        'db-sidebar': '#252526',
        'db-hover': '#37373d',
        'db-selected': '#094771',
        'db-border': '#3e3e42'
      }
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
