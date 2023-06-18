// $(function() {
//   $('#change-skin').on('click', function() {
//     $("body").toggleClass("page-dark-mode");
//     $("#change-skin").toggleAttribute('aria-checked');
//     localStorage.setItem('bj-dark-mode', $("body").hasClass("page-dark-mode"));
//     BeautifulJekyllJS.initNavbar();
//   });
//   if (localStorage.getItem('bj-dark-mode') === 'true') {
//     $('#change-skin').trigger('click');
//   }
// });

const button = document.getElementById('change-skin');

button.addEventListener("click", () => {
  document.body.classList.toggle('page-dark-mode');

  let currentTheme = document.body.classList.contains('page-dark-mode');

  localStorage.setItem('bj-dark-mode', currentTheme);
  button.setAttribute('aria-checked', currentTheme);
  BeautifulJekyllJS.initNavbar();

})
if (localStorage.getItem('bj-dark-mode') === 'true') {
  button.click();
}
