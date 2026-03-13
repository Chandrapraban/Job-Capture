/**
 * generate-icons.js
 * Run once with Node.js to create simple PNG icons:
 *   node generate-icons.js
 *
 * Requires: npm install canvas
 * If you prefer, replace the icons/ folder with your own PNG files (16x16, 48x48, 128x128).
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#2c3e7a";
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();

  // White letter "J"
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(size * 0.6)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("J", size / 2, size / 2);

  const out = path.join(__dirname, "icons", `icon${size}.png`);
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`Created ${out}`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
