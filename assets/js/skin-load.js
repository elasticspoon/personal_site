window.addEventListener("DOMContentLoaded", () => {
  // (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  var currentTheme = localStorage.getItem("bj-dark-mode");
  var hasDarkSystemTheme = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  if (
    currentTheme === "dark" ||
    (currentTheme === null && hasDarkSystemTheme)
  ) {
    let button = document.getElementById("change-skin");
    document.body.setAttribute("data-theme", "dark");
    button.setAttribute("aria-checked", true);
  }
});
