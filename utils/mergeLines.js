export function mergeLines(lines) {
  const merged = [];
  let buffer = "";
  // Tambahkan key penting agar baris terpisah dengan benar
  const keyRegex = /^\s*(\d+\.\s*|[A-Za-z0-9\s\-()]+[:：])\s*|^(Email|Nama|Alamat|Kode|NPWP|NIK|Tempat|Tanggal|Periode|Total|Denda|Jatuh Tempo|ID Pelanggan)\s*[:：\-]/i;

  for (let line of lines) {
    line = line.trim();
    if (keyRegex.test(line)) {
      if (buffer) merged.push(buffer.trim());
      buffer = line;
    } else {
      if (!buffer) {
        buffer = line;
      } else {
        buffer += " " + line;
      }
    }
  }

  if (buffer) merged.push(buffer.trim());
  return merged;
}
