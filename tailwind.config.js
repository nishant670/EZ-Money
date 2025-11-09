/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    './App.tsx',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA', // Background (Canvas White)
        charcoal: '#1A1A1A', // Primary text
        sage: '#A3B8A2', // Accent
        soft: '#D9D9D9', // Borders
      },
      borderRadius: {
        card: '16px',
        button: '24px',
      },
      spacing: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', 'SF Pro Display', 'Manrope', 'System'],
        title: ['Inter', 'SF Pro Display', 'Manrope', 'System'],
        body: ['Inter', 'SF Pro Text', 'Manrope', 'System'],
      },
    },
  },
  plugins: [],
};
