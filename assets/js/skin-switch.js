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
  document.body.classList.toggle("page-dark-mode");

  let currentTheme = document.body.classList.contains("page-dark-mode");

  setCookie("bj-dark-mode", currentTheme, 999);
  button.setAttribute("aria-checked", currentTheme);
  BeautifulJekyllJS.initNavbar();
});
