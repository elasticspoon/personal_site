// postcss.config.js
module.exports = {
  plugins: [
    require("postcss-preset-env")({
      enableClientSidePolyfills: true,
    }),
    require("@fullhuman/postcss-purgecss")({
      content: ["_site/**/*.html", "_landing_page/**/*.html"],
      safelist: ["data-theme"],
    }),
  ],
};
