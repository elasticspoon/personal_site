// Function to set a cookie
function setCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie =
    name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

const button = document.getElementById("change-skin");
button.addEventListener("click", () => {
  let currentTheme = document.body.getAttribute("data-theme");
  let targetTheme = currentTheme === "dark" ? "light" : "dark";

  setCookie("bj-dark-mode", targetTheme, 999);
  document.body.setAttribute("data-theme", targetTheme);
  button.setAttribute("aria-checked", currentTheme === "dark");
  BeautifulJekyllJS.initNavbar();
});
