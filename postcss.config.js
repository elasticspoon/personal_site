// postcss.config.js
module.exports = {
  plugins: [
    require("postcss-preset-env")({
      enableClientSidePolyfills: true,
    }),
    // require("@fullhuman/postcss-purgecss")({
    //   content: [
    //     "_site/**/*.html",
    //     "_landing_page/**/*.html",
    //     "_site/**/*.js",
    //     "_landing_page/**/*.js",
    //   ],
    //   css: [
    //     "_site/assets/css/all.min.css",
    //     "_site/assets/css/bootstrap.min.css",
    //     "_landing_page/assets/css/all.min.css",
    //     "_landing_page/assets/bootstrap.min.css",
    //   ],
    // }),
    require("cssnano")({
      preset: "default",
    }),
  ],
};
