/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src//*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Ajout des keyframes pour l'animation d'apparition
      keyframes: {
        fadeInUp: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px)' 
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)' 
          },
        },
      },
      // Ajout de la classe utilitaire pour utiliser l'animation
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
      },
    },
  },
  plugins: [],
}