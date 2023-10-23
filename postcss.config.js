// postcss.config.js
module.exports = {
  plugins: [
    require("postcss-preset-env")({
      enableClientSidePolyfills: true,
    }),
    require("@fullhuman/postcss-purgecss")({
      content: [
        "./**/*.html",
        "./**/*.js",
      ],
      safelist: [
        "ignore-blockquote"
      ],
      // css: [
      //   "_site/assets/css/all.min.css",
      //   "_site/assets/css/bootstrap.min.css",
      //   "_landing_page/assets/css/all.min.css",
      //   "_landing_page/assets/bootstrap.min.css",
      // ],
    }),
    require("cssnano")({
      preset: "default",
    }),
  ],
};
