// ======================================
// SHEDFAX : Audio Player
// Plays muzak, light jazz and experimental noise soundtracks in a Ceefax style
// ======================================

// ======================================
// SHEDFAX : AUDIO SYSTEM
// Plays a list of background musak files
// ======================================

document.addEventListener("DOMContentLoaded", function () {
  const audioPlayer = document.querySelector("#shedfax-audio-player");
  const toggleButton = document.querySelector("#toggle-audio");
  const audioStatus = document.querySelector(".audio-status");

  if (!audioPlayer || !toggleButton || !audioStatus) return;

  const tracks = [
    "audio/shopping.mp3",
    "audio/funk.mp3",
    "audio/the_chalk_circle.mp3"
  ];

  let currentTrack = 0;

  audioPlayer.volume = 0.35;
  audioPlayer.src = tracks[currentTrack];

  function playTrack() {
    audioPlayer.src = tracks[currentTrack];
    audioPlayer.play();
    audioStatus.textContent = "AUDIO SIGNAL: ACTIVE";
    toggleButton.textContent = "MUTE MUSAK";
  }

  audioPlayer.addEventListener("ended", function () {
    currentTrack = (currentTrack + 1) % tracks.length;
    playTrack();
  });

  toggleButton.addEventListener("click", function () {
    if (audioPlayer.paused) {
      playTrack();
    } else {
      audioPlayer.pause();
      audioStatus.textContent = "AUDIO SIGNAL: MUTED";
      toggleButton.textContent = "RESTORE MUSAK";
    }
  });
});
