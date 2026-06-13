/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fifa: {
          blue: '#1a3a5c',
          gold: '#c9a84c',
          green: '#1e8a3e',
        },
      },
    },
  },
  plugins: [],
}
