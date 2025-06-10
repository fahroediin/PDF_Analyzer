import { PdfReader } from "ppu-pdf";
import { createWorker } from "tesseract.js";
import { PaddleOcrService } from "ppu-paddle-ocr";
import poppler from 'pdf-poppler';
import path from 'path';   
import fs from 'fs';
import { parsers } from "./utils/parser.js";
import { mergeLines, extractKtpFromLines } from "./utils/mergeLines.js";
import { serve } from "bun";

// Utility: Bersihkan spasi & garis
function preprocessLines(lines) {
  return lines
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0);
}

// Utility: Filter noise
function cleanLines(lines) {
  return lines.filter(line => {
    if (line.length < 3) return false;
    const validChars = line.match(/[a-zA-Z0-9]/g) || [];
    return validChars.length >= 0;
  });
}

// Normalisasi string untuk penghilangan duplikasi (lebih ketat)
function normalizeLine(line) {
  if (typeof line !== "string") return "";
  return line
    .replace(/\s+/g, " ")      // gabungkan spasi berlebih jadi satu spasi
    .replace(/[^\w\s]/g, "")   // hapus semua karakter kecuali huruf, angka, dan spasi
    .trim()
    .toLowerCase();
}

function extractTextsFromOcrResult(ocrResult) {
  const allTexts = [];
  for (const pageLines of Object.values(ocrResult)) {
    if (!Array.isArray(pageLines)) continue;
    for (const lineObj of pageLines) {
      if (typeof lineObj === 'string') {
        allTexts.push(lineObj.trim());
      }
      else if (lineObj && typeof lineObj.text === 'string') {
        allTexts.push(lineObj.text.trim());
      }
    }
  }
  return allTexts;
}

// async function preprocessCanvas(canvasInput) {
//   // Langkah 1-4: Muat canvas input ke dalam canvas node-canvas
//   const bufferIn = canvasInput.toBuffer('image/png');
//   const image = await loadImage(bufferIn);
//   const newCanvas = createCanvas(image.width, image.height);
//   const ctx = newCanvas.getContext('2d');
//   ctx.drawImage(image, 0, 0);

//   // Langkah 5: Lakukan HANYA Grayscaling.
//   const imageData = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
//   const data = imageData.data;
//   for (let i = 0; i < data.length; i += 4) {
//     // Ubah piksel menjadi rata-rata dari R, G, B
//     const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
//     data[i] = avg;     // Red
//     data[i + 1] = avg; // Green
//     data[i + 2] = avg; // Blue
//   }
//   ctx.putImageData(imageData, 0, 0);

//   // Langkah 6: Kembalikan hasilnya sebagai Buffer PNG.
//   return canvasInput.toBuffer('image/png');
// }

async function convertPdfToImages(pdfBuffer) {
    const tempDir = './temp_images';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    const outputFile = path.join(tempDir, `page-${Date.now()}`);

    let opts = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: path.basename(outputFile),
        scale_to: 2400 // Setara dengan ~300 DPI untuk halaman A4
    };

    // Tulis buffer ke file sementara karena pdf-poppler bekerja dengan path file
    const tempPdfPath = path.join(tempDir, 'temp.pdf');
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    await poppler.convert(tempPdfPath, opts);

    // Cari file yang dihasilkan
    const imagePaths = fs.readdirSync(tempDir).filter(f => f.startsWith(path.basename(outputFile)) && f.endsWith('.png')).map(f => path.join(tempDir, f));

    // Hapus file PDF sementara
    fs.unlinkSync(tempPdfPath);

    return imagePaths;
}


// DEFINISIKAN KONSTANTA DI SINI AGAR BISA DIAKSES SECARA GLOBAL
const USE_TESSERACT = process.env.DISABLE_TESSERACT !== "true";

function preprocessLines(lines) {
  return lines
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0);
}

function cleanLines(lines) {
  return lines.filter(line => {
    if (line.length < 3) return false;
    const validChars = line.match(/[a-zA-Z0-9]/g) || [];
    return validChars.length >= 0;
  });
}

function normalizeLine(line) {
  if (typeof line !== "string") return "";
  return line
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}

function extractTextsFromOcrResult(ocrResult) {
  const allTexts = [];
  for (const pageLines of Object.values(ocrResult)) {
    if (!Array.isArray(pageLines)) continue;
    for (const lineObj of pageLines) {
      if (typeof lineObj === 'string') {
        allTexts.push(lineObj.trim());
      }
      else if (lineObj && typeof lineObj.text === 'string') {
        allTexts.push(lineObj.text.trim());
      }
    }
  }
  return allTexts;
}

// ========================================================================
// FUNGSI KONVERSI PDF KE GAMBAR YANG ANDAL
// ========================================================================

async function convertPdfToImages(pdfBuffer) {
    const tempDir = './temp_images';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    const outputFile = path.join(tempDir, `page-${Date.now()}`);

    let opts = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: path.basename(outputFile),
        scale_to_x: 2480, // Resolusi tinggi, setara ~300 DPI untuk A4
        scale_to_y: -1   // Menjaga rasio aspek
    };

    const tempPdfPath = path.join(tempDir, 'temp.pdf');
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    await poppler.convert(tempPdfPath, opts);

    const imagePaths = fs.readdirSync(tempDir).filter(f => f.startsWith(path.basename(outputFile)) && f.endsWith('.png')).map(f => path.join(tempDir, f));

    fs.unlinkSync(tempPdfPath);
    return imagePaths;
}

// ========================================================================
// FUNGSI-FUNGSI OCR
// ========================================================================

async function ocrTesseract(imagePaths) {
  const result = {};
  if (!imagePaths || imagePaths.length === 0 || !USE_TESSERACT) return result;
  
  const worker = await createWorker({ logger: m => console.log("[TESS]", m) });
  try {
    await worker.loadLanguage("ind+eng");
    await worker.initialize("ind");

    for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        console.log(`[TESS] Processing image path: ${imagePath}`);
        const { data: { text } } = await worker.recognize(imagePath);
        result[i] = cleanLines(preprocessLines(text.split("\n")));
        console.log(`[TESS] Done page ${i} (${result[i].length} lines)`);
    }
  } catch (err) {
    console.error("[TESS] Worker failed:", err);
  } finally {
    await worker.terminate();
  }
  return result;
}

async function ocrPaddle(imagePaths) {
  const result = {};
  if (!imagePaths || imagePaths.length === 0) return result;

  const ocr = await PaddleOcrService.getInstance();
  try {
    for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        console.log(`[PADDLE] Processing image path: ${imagePath}`);
        const texts = await ocr.recognize(imagePath);
        const flattenedLines = texts.lines.flat();
        const lines = flattenedLines.map(item => ({ text: item.text }));
        console.log("OCR lines raw:", lines.map(l => l.text));
        result[i] = lines;
    }
  } catch (err) {
    console.error("[PADDLE] Service failed:", err);
  } finally {
    if (ocr && ocr.destroy) {
        await ocr.destroy();
    }
  }
  return result;
}

// ========================================================================
// FUNGSI PENGGABUNG DAN SERVER UTAMA
// ========================================================================

function mergeAllPagesUnique(resultTesseract, resultPaddle) {
  const textsTesseract = extractTextsFromOcrResult(resultTesseract);
  const textsPaddle = extractTextsFromOcrResult(resultPaddle);

  const allTexts = [...textsTesseract, ...textsPaddle];
  const seen = new Set();
  const uniqueTexts = [];

  for (const text of allTexts) {
    const normalized = normalizeLine(text);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      uniqueTexts.push(text.trim());
    }
  }
  return uniqueTexts;
}

serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/upload") {
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response("Only multipart/form-data supported", { status: 400 });
      }

      try {
        const formData = await req.formData();
        const file = formData.get("file");
        const typeInput = formData.get("type");
        const docType = typeof typeInput === "string" ? typeInput.toUpperCase() : "NIB";

        if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
          return new Response("File is required", { status: 400 });
        }

        const originalBuffer = await file.arrayBuffer();
        
        const pdfReader = new PdfReader({ verbose: false });
        let pdf, isScanned, texts;
        try {
            pdf = pdfReader.open(originalBuffer);
            texts = await pdfReader.getTexts(pdf);
            isScanned = pdfReader.isScanned(texts);
        } catch (e) {
            return new Response("File tidak valid atau gagal dibaca: " + e.message, { status: 422 });
        }

        let resultTesseract = {};
        let resultPaddle = {};

        if (isScanned) {
            console.log("Scanned PDF detected. Converting to images with Poppler...");
            const imagePaths = await convertPdfToImages(Buffer.from(originalBuffer));

            if (imagePaths.length === 0) {
                pdfReader.destroy(pdf);
                return new Response("Gagal mengonversi halaman PDF menjadi gambar.", { status: 500 });
            }

            console.log(`Successfully converted to ${imagePaths.length} image(s). Starting OCR...`);

            [resultTesseract, resultPaddle] = await Promise.all([
                ocrTesseract(imagePaths),
                ocrPaddle(imagePaths)
            ]);

            console.log("OCR finished. Cleaning up temporary images...");
            imagePaths.forEach(p => fs.unlinkSync(p));

        } else {
            console.log("Digital PDF detected. Extracting text directly...");
            const textMap = pdfReader.getLinesFromTexts(texts);
            
            for (let i = 0; i < textMap.size; i++) {
                const pageTextLines = textMap.get(i) || [];
                resultTesseract[i] = pageTextLines; 
                resultPaddle[i] = pageTextLines.map(line => ({ text: line }));
            }
        }
        
        pdfReader.destroy(pdf);

        let mergedLines = mergeAllPagesUnique(resultTesseract, resultPaddle);
        mergedLines = mergeLines(mergedLines, docType);

        let parsedData = {};
        if (docType === "KTP") {
          parsedData = extractKtpFromLines(mergedLines);
        } else {
          const parser = parsers[docType] || (() => ({}));
          parsedData = parser(mergedLines);
        }

        return Response.json({
          document_name: file.name || "unknown",
          document_type: docType,
          type: isScanned ? "scanned" : "digital",
          extractedLines: mergedLines,
          parsedData,
        });

      } catch (err) {
        console.error("Fatal error during processing:", err);
        return new Response("Failed to process PDF: " + (err.message || String(err)), { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});