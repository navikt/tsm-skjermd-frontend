import dsTailwind from "@navikt/ds-tailwind";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@navikt/**/dist/*.js"
  ],
  presets: [dsTailwind],
  theme: {
    extend: {},
  },
  plugins: [],
};