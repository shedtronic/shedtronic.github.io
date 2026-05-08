// ======================================
// SHEDFAX : CLOCK SYSTEM
// Displays current time in SHEDFAX header
// ======================================

document.addEventListener("DOMContentLoaded", function () {
  const hoursElem = document.querySelector("#clock .hours");
  const minutesElem = document.querySelector("#clock .minutes");
  const secondsElem = document.querySelector("#clock .seconds");

  if (!hoursElem || !minutesElem || !secondsElem) return;

  function updateClock() {
    const now = new Date();

    hoursElem.textContent = String(now.getHours()).padStart(2, "0");
    minutesElem.textContent = String(now.getMinutes()).padStart(2, "0");
    secondsElem.textContent = String(now.getSeconds()).padStart(2, "0");
  }

  updateClock();
  setInterval(updateClock, 1000);
});