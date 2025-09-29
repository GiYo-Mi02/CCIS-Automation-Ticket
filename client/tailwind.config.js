/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1f4b99",
          light: "#3f6ccb",
          dark: "#163a77",
        },
      },
    },
  },
  plugins: [],
};
