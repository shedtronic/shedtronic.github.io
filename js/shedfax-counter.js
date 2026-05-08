// ======================================
// SHEDFAX : COUNTER SYSTEM
// Simulates Ceefax page navigation delay
// ======================================

document.addEventListener("DOMContentLoaded", function () {
  const targetCounter = document.querySelector(".dynamic-counter-link.counter");
  const links = document.querySelectorAll(".dynamic-counter-link");
  const toggle = document.querySelector("#toggle-counter");

  if (!targetCounter || !links.length || !toggle) {
    console.log("SHEDFAX counter could not start");
    return;
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