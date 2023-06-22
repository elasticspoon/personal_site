const button = document.getElementById("change-skin");
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

// Function to get the value of a cookie
function getCookie(name) {
  var cookieName = name + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var cookieArray = decodedCookie.split(";");

  for (var i = 0; i < cookieArray.length; i++) {
    var cookie = cookieArray[i];
    while (cookie.charAt(0) == " ") {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(cookieName) == 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return null;
}

button.addEventListener("click", () => {
  document.body.classList.toggle("page-dark-mode");

  let currentTheme = document.body.classList.contains("page-dark-mode");

  setCookie("bj-dark-mode", currentTheme, 9999);
  button.setAttribute("aria-checked", currentTheme);
  BeautifulJekyllJS.initNavbar();
});
if (getCookie("bj-dark-mode") === "true") {
  document.body.classList.add("page-dark-mode");
}
