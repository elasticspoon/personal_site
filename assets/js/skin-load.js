// Function to get the value of a cookie
function getCookie(name) {
  var cookieName = name + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var cookieArray = decodedCookie.split(";");

  for (var i = 0; i < cookieArray.length; i++) {
    var cookie = cookieArray[i].trim(); // Remove leading/trailing spaces

    if (cookie.substring(0, cookieName.length) === cookieName) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }

  return null;
}

window.addEventListener("DOMContentLoaded", () => {
  // (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  var currentTheme = getCookie("bj-dark-mode");
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
