function setup() {
  // put setup code here

  createCanvas(720, 400);
stroke(255); // Set line drawing color to white
frameRate(30);
}

function draw() {
  // put drawing code here
  background(0); // Set the background to black
  y = y - 1;
  if (y < 0) {
    y = height;
  }
  line(0, y, width, y);
}


