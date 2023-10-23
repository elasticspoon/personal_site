// postcss.config.js
module.exports = {
  plugins: [
    require("postcss-preset-env")({
      enableClientSidePolyfills: true,
    }),
    require("cssnano")({
      preset: "default",
    }),
  ],
};
