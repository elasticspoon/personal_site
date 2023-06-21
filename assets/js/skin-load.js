if (
  localStorage.getItem("bj-dark-mode") === "true" ||
  (!("bj-dark-mode" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.body.classList.add("page-dark-mode");
}
