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
  if (getCookie("bj-dark-mode") === "true") {
    let button = document.getElementById("change-skin");
    document.body.classList.add("page-dark-mode");
    button.setAttribute("aria-checked", true);
  }
});
