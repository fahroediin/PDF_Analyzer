export function mergeLines(lines, docType = "") {
  const merged = [];

  if (docType.toUpperCase() === "KTP") {
    const keyWords = [
      "NIK",
      "Nama",
      "Tempat/TglLahir",
      "Jenis kelamin",
      "Gol.Darah",
      "Alamat",
      "RT/RW",
      "Kel/Desa",
      "Kecamatan",
      "Status Perkawinan",
      "Agama",
      "Pekerjaan",
      "Kewarganegaraan",
      "Berlaku Hingga",
    ];

    // Gabung semua lines jadi satu string dulu
    let bigText = lines.join(" ");

    // Split berdasarkan key yang ditemukan (gunakan lookahead agar tidak hilang kata)
    const pattern = new RegExp(`(?=\\b(?:${keyWords.join("|")})\\b)`, "g");

    const splitted = bigText.split(pattern).map(s => s.trim()).filter(s => s.length > 0);

    // Tambahkan hasil split ke merged
    for (const part of splitted) {
      merged.push(part);
    }

  } else {
    // aturan merge umum
    let buffer = "";
    const keyRegex = /^\s*(\d+\.\s*|[A-Za-z0-9\s\-()]+[:：])\s*|^(Email|Nama|Alamat|Kode|NPWP|NIK|Tempat|Tanggal|Periode|Total|Denda|Jatuh Tempo|ID Pelanggan)\s*[:：\-]/i;

    for (let line of lines) {
      line = line.trim();
      if (keyRegex.test(line)) {
        if (buffer) merged.push(buffer.trim());
        buffer = line;
      } else {
        if (!buffer) buffer = line;
        else buffer += " " + line;
      }
    }
    if (buffer) merged.push(buffer.trim());
  }

  return merged;
}


export function extractKtpFromLines(lines) {
  const data = {
    nik: null,
    nama: null,
    tempat_tanggal_lahir: null,
    jenis_kelamin: null,
    gol_darah: null,
    alamat: null,
    rt_rw: null,
    kel_desa: null,
    kecamatan: null,
    status_perkawinan: null,
    agama: null,
    pekerjaan: null,
    kewarganegaraan: null,
    berlaku_hingga: null,
  };

  // Bersihkan lines dulu
  const cleaned = lines.map(l => l.trim());

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];

    switch (true) {
      case /^NIK$/i.test(line):
        data.nik = cleaned[i + 1] || null;
        i++;
        break;

      case /^Nama$/i.test(line):
        data.nama = cleaned[i + 1] || null;
        i++;
        break;

      case /^Tempat\/TglLahir$/i.test(line):
        data.tempat_tanggal_lahir = cleaned[i + 1] || null;
        i++;
        break;

      case /^Jenis kelamin$/i.test(line):
        data.jenis_kelamin = cleaned[i + 1] || null;
        i++;
        break;

      case /^Gol\.? Darah$/i.test(line):
        // Gol darah kadang kosong, cek next line apakah alamat?
        if (cleaned[i + 1] && !/^Alamat$/i.test(cleaned[i + 1])) {
          data.gol_darah = cleaned[i + 1];
          i++;
        }
        break;

      case /^Alamat$/i.test(line):
        data.alamat = cleaned[i + 1] || null;
        i++;
        break;

      case /^RT\/RW$/i.test(line):
        data.rt_rw = cleaned[i + 1] || null;
        i++;
        break;

      case /^Kel\/Desa$/i.test(line):
        data.kel_desa = cleaned[i + 1] || null;
        i++;
        break;

      case /^Kecamatan$/i.test(line):
        // Kadang nilai diawali tanda ":" seperti ":MAJENANG"
        if (cleaned[i + 1]) {
          data.kecamatan = cleaned[i + 1].replace(/^:/, "").trim();
          i++;
        }
        break;

      case /^Status Perkawinan/i.test(line):
        // Bisa gabung di satu line tanpa spasi, ambil sisa setelah key
        let status = line.replace(/^Status Perkawinan/i, "").trim();
        if (status) {
          data.status_perkawinan = status;
        } else {
          data.status_perkawinan = cleaned[i + 1] || null;
          i++;
        }
        break;

      case /^Agama$/i.test(line):
        // Kadang ada ":" di depan
        if (cleaned[i + 1]) {
          data.agama = cleaned[i + 1].replace(/^:/, "").trim();
          i++;
        }
        break;

      case /^Pekerjaan$/i.test(line):
        if (cleaned[i + 1]) {
          data.pekerjaan = cleaned[i + 1].replace(/^:/, "").trim();
          i++;
        }
        break;

      case /^Kewarganegaraan[:：]?/i.test(line):
        // Bisa gabung di satu line misal "Kewarganegaraan:WNI"
        data.kewarganegaraan = line.replace(/^Kewarganegaraan[:：]?/i, "").trim();
        if (!data.kewarganegaraan && cleaned[i + 1]) {
          data.kewarganegaraan = cleaned[i + 1];
          i++;
        }
        break;

      case /^Berlaku Hingga$/i.test(line):
        data.berlaku_hingga = cleaned[i + 1] || null;
        i++;
        break;

      default:
        // Jika ada line gabungan tanpa spasi, cek pola
        if (/Status Perkawinan/i.test(line) && !data.status_perkawinan) {
          const match = line.match(/Status Perkawinan\s*(.*)/i);
          if (match) data.status_perkawinan = match[1].trim();
        }
        if (/Kewarganegaraan[:：]/i.test(line) && !data.kewarganegaraan) {
          data.kewarganegaraan = line.split(/Kewarganegaraan[:：]/i)[1].trim();
        }
        break;
    }
  }

  return data;
}
