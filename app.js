const audio = document.getElementById("my-audio");
const playBtn = document.getElementById("play-btn");
const pauseBtn = document.getElementById("pause-btn");
const trackBtns = document.querySelectorAll(".track-btn");

let currentTrackIndex = 0;

function playTrack() {
  audio.src = trackBtns[currentTrackIndex].getAttribute("data-src");
  audio.play();
  playBtn.disabled = true;
  pauseBtn.disabled = false;
}

function pauseTrack() {
  audio.pause();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
}

function selectTrack(index) {
  currentTrackIndex = index;
  pauseTrack();
  playTrack();
}

playBtn.addEventListener("click", playTrack);
pauseBtn.addEventListener("click", pauseTrack);

for (let i = 0; i < trackBtns.length; i++) {
  trackBtns[i].addEventListener("click", function() {
    selectTrack(i);
  });
}

audio.addEventListener("ended", function() {
  currentTrackIndex = (currentTrackIndex + 1) % trackBtns.length;
  selectTrack(currentTrackIndex);
});

// Automatically start playing the first track
//playTrack();





