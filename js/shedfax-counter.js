// ======================================
// SHEDFAX : COUNTER SYSTEM
// Simulates Ceefax page navigation delay
// ======================================

document.addEventListener("DOMContentLoaded", function () {
  const targetCounter = document.querySelector("#page-counter");
  const links = document.querySelectorAll(".dynamic-counter-link");
  const toggle = document.querySelector("#toggle-counter");

  if (!targetCounter || !links.length || !toggle) return;

  // Show current page number in top counter
  const currentFile = window.location.pathname.split("/").pop();
  const currentPage = parseInt(currentFile.replace(".html", ""), 10);

  if (!isNaN(currentPage)) {
    targetCounter.innerText = currentPage;
  } else {
    targetCounter.innerText = "100";
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (e) {
      const href = link.getAttribute("href");

      if (!href || href === "#") return;

      const endNumber = parseInt(href.replace(".html", ""), 10);

      if (isNaN(endNumber)) return;

      if (toggle.checked) {
        e.preventDefault();

        let startNumber = 100;
        targetCounter.innerText = startNumber;

        const interval = setInterval(function () {
          if (startNumber < endNumber) {
            startNumber += 1;
            targetCounter.innerText = startNumber;
          } else {
            clearInterval(interval);
            window.location.href = href;
          }
        }, 100);
      }
    });
  });
});