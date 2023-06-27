// Dean Attali / Beautiful Jekyll 2023

let BeautifulJekyllJS = {
  init: function () {
    setTimeout(BeautifulJekyllJS.initNavbar, 10);

    BeautifulJekyllJS.initSearch();
  },

  initSearch: function () {
    if (!document.getElementById("beautifuljekyll-search-overlay")) {
      return;
    }

    $("#nav-search-link").click(function (e) {
      e.preventDefault();
      $("#beautifuljekyll-search-overlay").show();
      $("#nav-search-input").focus().select();
      $("body").addClass("overflow-hidden");
    });
    $("#nav-search-exit").click(function (e) {
      e.preventDefault();
      $("#beautifuljekyll-search-overlay").hide();
      $("body").removeClass("overflow-hidden");
    });
    $(document).on("keyup", function (e) {
      if (e.key == "Escape") {
        $("#beautifuljekyll-search-overlay").hide();
        $("body").removeClass("overflow-hidden");
      }
    });
  },
};

document.addEventListener("DOMContentLoaded", BeautifulJekyllJS.init);
