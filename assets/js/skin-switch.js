const button = document.getElementById('change-skin');

button.addEventListener("click", () => {
  document.body.classList.toggle('page-dark-mode');

  let currentTheme = document.body.classList.contains('page-dark-mode');

  localStorage.setItem('bj-dark-mode', currentTheme);
  button.setAttribute('aria-checked', currentTheme);
  BeautifulJekyllJS.initNavbar();

})
if (localStorage.getItem('bj-dark-mode') === 'true') {
  button.setAttribute('aria-checked', true);
  document.body.classList.add('page-dark-mode');

}