// utils/canvasUtils.js

/**
 * Deteksi garis hitam horizontal pada canvas.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas 
 * @param {number} threshold Jumlah piksel hitam minimal per baris agar dianggap garis hitam.
 * @returns {number[]} Array posisi Y garis hitam.
 */
export function detectHorizontalBlackLines(canvas, threshold = 200) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const lines = [];

  for (let y = 0; y < height; y++) {
    let blackPixels = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r < 50 && g < 50 && b < 50) {
        blackPixels++;
      }
    }
    if (blackPixels > threshold) {
      lines.push(y);
    }
  }

  // Gabungkan garis yang berdekatan jadi satu
  const mergedLines = [];
  let lastY = -10;
  for (const y of lines) {
    if (y - lastY > 5) {
      mergedLines.push(y);
    }
    lastY = y;
  }

  return mergedLines;
}

/**
 * Potong canvas menjadi beberapa blok berdasarkan garis hitam horizontal.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas 
 * @param {number[]} lines Array posisi Y garis hitam
 * @returns {OffscreenCanvas[]} Array canvas hasil potongan blok
 */
export function splitCanvasByLines(canvas, lines) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const blocks = [];
  let prevY = 0;
  for (const y of lines) {
    const blockHeight = y - prevY;
    if (blockHeight > 10) {
      const subCanvas = new OffscreenCanvas(width, blockHeight);
      const subCtx = subCanvas.getContext("2d");
      const imageData = ctx.getImageData(0, prevY, width, blockHeight);
      subCtx.putImageData(imageData, 0, 0);
      blocks.push(subCanvas);
    }
    prevY = y;
  }

  // Block terakhir dari garis terakhir ke bawah
  if (height - prevY > 10) {
    const subCanvas = new OffscreenCanvas(width, height - prevY);
    const subCtx = subCanvas.getContext("2d");
    const imageData = ctx.getImageData(0, prevY, width, height - prevY);
    subCtx.putImageData(imageData, 0, 0);
    blocks.push(subCanvas);
  }

  return blocks;
}
