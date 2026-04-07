import dsTailwind from "@navikt/ds-tailwind";
import colors from "tailwindcss/colors";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@navikt/**/dist/*.js"
  ],
  presets: [dsTailwind],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        white: colors.white,
        black: colors.black,
        gray: colors.gray,
        red: colors.red,
        blue: colors.blue,
      },
    },
  },
  plugins: [],
};