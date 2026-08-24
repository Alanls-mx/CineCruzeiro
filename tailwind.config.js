/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#060A12", // Deepest navy black
          900: "#0B132B", // Deep cinema navy
          850: "#0F1A3A", // Dark blue slate
          800: "#172554", // Rich navy blue
          700: "#1D4ED8", // Royal blue
          600: "#2563EB", // Vibrant Royal blue (Logo color)
          500: "#3B82F6", // Bright blue
          400: "#60A5FA", // Accent light blue
          300: "#93C5FD", // Soft blue
          100: "#DBEAFE", // Pale blue highlight
        },
        gold: {
          300: "#FDE047",
          400: "#FACC15", // Primary Gold CTA
          500: "#EAB308", // Vivid Amber Gold
          600: "#CA8A04",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(250, 204, 21, 0.4)", // Gold CTA Glow
        "glow-blue": "0 0 30px -5px rgba(37, 99, 235, 0.35)", // Royal Blue Glow
        "card-blue": "0 10px 30px -10px rgba(11, 19, 43, 0.8)",
      },
      backgroundImage: {
        "radial-navy": "radial-gradient(ellipse at top, rgba(37, 99, 235, 0.15), transparent 70%)",
        "radial-glow": "radial-gradient(circle at center, rgba(30, 64, 175, 0.25) 0%, transparent 70%)",
      },
    },
  },
  plugins: [],
};
