import fs from "node:fs";
import zlib from "node:zlib";

const BLACK = [5, 5, 5, 255];
const WHITE = [245, 240, 229, 255];

for (const size of [192, 512]) {
  const image = new Uint8Array(size * size * 4);
  fill(image, size, BLACK);
  drawMark(image, size);
  writePng(`icons/icon-${size}.png`, image, size, size);
}

function drawMark(image, size) {
  const s = size / 512;
  ellipse(image, size, 256 * s, 256 * s, 228 * s, 228 * s, WHITE, true, 8 * s);
  polygon(image, size, [[142, 58], [205, 171], [139, 127], [115, 62]], WHITE, s);
  polygon(image, size, [[370, 58], [307, 171], [373, 127], [397, 62]], WHITE, s);
  polygon(image, size, [[165, 129], [211, 94], [256, 84], [301, 94], [347, 129], [373, 230], [345, 326], [305, 452], [207, 452], [167, 326], [139, 230]], WHITE, s);
  polygon(image, size, [[185, 176], [242, 208], [231, 295], [171, 287], [153, 226]], BLACK, s);
  polygon(image, size, [[327, 176], [270, 208], [281, 295], [341, 287], [359, 226]], BLACK, s);
  polygon(image, size, [[236, 306], [276, 306], [256, 371]], BLACK, s);
  polygon(image, size, [[214, 369], [298, 369], [287, 452], [225, 452]], BLACK, s);
  line(image, size, 226 * s, 387 * s, 226 * s, 446 * s, WHITE, 10 * s);
  line(image, size, 256 * s, 376 * s, 256 * s, 452 * s, WHITE, 10 * s);
  line(image, size, 286 * s, 387 * s, 286 * s, 446 * s, WHITE, 10 * s);
  line(image, size, 94 * s, 418 * s, 208 * s, 364 * s, WHITE, 7 * s);
  line(image, size, 418 * s, 418 * s, 304 * s, 364 * s, WHITE, 7 * s);
  line(image, size, 82 * s, 116 * s, 170 * s, 188 * s, WHITE, 7 * s);
  line(image, size, 430 * s, 116 * s, 342 * s, 188 * s, WHITE, 7 * s);
  line(image, size, 256 * s, 40 * s, 256 * s, 103 * s, WHITE, 7 * s);
  line(image, size, 256 * s, 452 * s, 256 * s, 480 * s, WHITE, 7 * s);
  line(image, size, 52 * s, 256 * s, 103 * s, 256 * s, WHITE, 7 * s);
  line(image, size, 409 * s, 256 * s, 460 * s, 256 * s, WHITE, 7 * s);
}

function fill(image, size, color) {
  for (let i = 0; i < size * size; i++) setPixel(image, i, color);
}

function ellipse(image, size, cx, cy, rx, ry, color, stroke = false, strokeWidth = 1) {
  const minX = Math.max(0, Math.floor(cx - rx - strokeWidth));
  const maxX = Math.min(size - 1, Math.ceil(cx + rx + strokeWidth));
  const minY = Math.max(0, Math.floor(cy - ry - strokeWidth));
  const maxY = Math.min(size - 1, Math.ceil(cy + ry + strokeWidth));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
      if ((!stroke && d <= 1) || (stroke && d <= 1 && d >= ((rx - strokeWidth) / rx) ** 2)) {
        setPixel(image, y * size + x, color);
      }
    }
  }
}

function polygon(image, size, points, color, scale = 1) {
  const scaled = points.map(([x, y]) => [x * scale, y * scale]);
  const xs = scaled.map(([x]) => x);
  const ys = scaled.map(([, y]) => y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (insidePolygon(x, y, scaled)) setPixel(image, y * size + x, color);
    }
  }
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function line(image, size, x1, y1, x2, y2, color, width) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width));
  const lengthSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSq));
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      if ((x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2) setPixel(image, y * size + x, color);
    }
  }
}

function setPixel(image, index, color) {
  const offset = index * 4;
  image[offset] = color[0];
  image[offset + 1] = color[1];
  image[offset + 2] = color[2];
  image[offset + 3] = color[3];
}

function writePng(path, rgba, width, height) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(scanlines, row + 1);
  }

  const chunks = [
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ];
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]));
}

function chunk(type, data) {
  const name = Buffer.from(type);
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])) >>> 0)]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
