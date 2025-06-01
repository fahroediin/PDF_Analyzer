import { PdfReader } from "ppu-pdf";
import { createWorker } from "tesseract.js";
import { PaddleOcrService } from "ppu-paddle-ocr";
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

// Ambil hanya properti text dari hasil OCR dan gabungkan semua halaman
function extractTextsFromOcrResult(ocrResult) {
  const allTexts = [];

  for (const pageLines of Object.values(ocrResult)) {
    for (const lineObj of pageLines) {
      if (lineObj && typeof lineObj.text === "string") {
        allTexts.push(lineObj.text.trim());
      }
    }
  }

  return allTexts;
}

// OCR: Tesseract.js
async function ocrTesseract(pdfReader, pdf, isScanned) {
  const result = {};
  if (isScanned) {
    const canvasMap = await pdfReader.renderAll(pdf);
    const worker = await createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    for (let i = 0; i < canvasMap.size; i++) {
      const canvas = canvasMap.get(i);
      if (!canvas) continue;
      const ret = await worker.recognize(canvas.toDataURL());
      const lines = cleanLines(preprocessLines(ret.data.text.split("\n")));
      result[i] = lines;
    }
    await worker.terminate();
  } else {
    const textMap = pdfReader.getLinesFromTexts(await pdfReader.getTexts(pdf));
    for (let i = 0; i < textMap.size; i++) {
      const lines = textMap.get(i);
      if (lines) result[i] = lines;
    }
  }
  return result;
}

// OCR: PaddleOCR
async function ocrPaddle(pdfReader, pdf, isScanned) {
  const result = {};
  if (isScanned) {
    const canvasMap = await pdfReader.renderAll(pdf);
    const ocr = await PaddleOcrService.getInstance();
    for (let i = 0; i < canvasMap.size; i++) {
      const canvas = canvasMap.get(i);
      if (!canvas) continue;
      const texts = await ocr.recognize(canvas);
      const flattenedLines = texts.lines.flat();
      const lines = flattenedLines.map(item => item.text);

      console.log("OCR lines raw:", lines);

    result[i] = lines;  // tanpa preprocessLines & cleanLines

    }
    await ocr.destroy();
  } else {
    const textMap = pdfReader.getLinesFromTexts(await pdfReader.getTexts(pdf));
    for (let i = 0; i < textMap.size; i++) {
      const lines = textMap.get(i);
      if (lines) result[i] = lines;
    }
  }
  return result;
}



// Gabungkan hasil OCR Tesseract dan Paddle, lalu buat array string unik berdasarkan normalisasi ketat
function mergeAllPagesUnique(resultTesseract, resultPaddle) {
  const textsTesseract = extractTextsFromOcrResult(resultTesseract);
  const textsPaddle = extractTextsFromOcrResult(resultPaddle);

  const allTexts = [...textsTesseract, ...textsPaddle];

  const seen = new Set();
  const uniqueTexts = [];

  for (const text of allTexts) {
    const normalized = normalizeLine(text);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueTexts.push(text.trim());
    }
  }

  return uniqueTexts;
}

// Server API
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

        const buffer = await file.arrayBuffer();
        const pdfReader = new PdfReader({ verbose: false });
        const pdf = pdfReader.open(buffer);
        const texts = await pdfReader.getTexts(pdf);
        const isScanned = pdfReader.isScanned(texts);

        // Jalankan kedua OCR secara paralel
        const [resultTesseract, resultPaddle] = await Promise.all([
          ocrTesseract(pdfReader, pdf, isScanned),
          ocrPaddle(pdfReader, pdf, isScanned)
        ]);

        // Gabungkan semua hasil OCR tanpa duplikasi
        let mergedLines = mergeAllPagesUnique(resultTesseract, resultPaddle);

        // 🔥 Terapkan mergeLines untuk menggabungkan lanjutan key yang terpisah
        mergedLines = mergeLines(mergedLines);

        // Parsing hasil OCR gabungan
        let parsedData = {};
        if (docType === "KTP") {
          parsedData = extractKtpFromLines(mergedLines);
        } else {
          const parser = parsers[docType] || (() => ({}));
          parsedData = parser(mergedLines);
        }


        pdfReader.destroy(pdf);

        return Response.json({
          document_name: file.name || "unknown", 
          document_type: docType,               
          type: isScanned ? "scanned" : "digital",
          extractedLines: mergedLines,
          parsedData,
        });
      } catch (err) {
        console.error("Error processing PDF:", err);
        return new Response("Failed to process PDF: " + (err.message || String(err)), {
          status: 500,
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});