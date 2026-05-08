// ======================================
// SHEDFAX : DATE SYSTEM
// Displays today's date in SHEDFAX header
// ======================================

document.addEventListener("DOMContentLoaded", function () {
  const dateElem = document.querySelector("#date");

  if (!dateElem) return;

  const now = new Date();

  const options = {
    weekday: "long",
    day: "numeric",
    month: "short"
  };

  dateElem.textContent = now.toLocaleDateString("en-GB", options);
});