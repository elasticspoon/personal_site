const button = document.getElementById("change-skin");
button.addEventListener("click", () => {
  let currentTheme = document.body.getAttribute("data-theme");
  let targetTheme = currentTheme === "dark" ? "light" : "dark";

  localStorage.setItem("bj-dark-mode", targetTheme);
  document.body.setAttribute("data-theme", targetTheme);
  button.setAttribute("aria-checked", currentTheme === "dark");
});
