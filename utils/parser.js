import { mergeLines } from "./mergeLines.js";

const extractField = (text, pattern) => {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
};

export const parsers = {
  NIB(lines) {
    const text = mergeLines(lines).join("\n");

    // Cari kode_kbli dari pola utama atau dari lampiran
    let kodeKbli = extractField(text, /Lampiran[\s\S]*?(\d{5})/i)
                || extractField(text, /Kode [^:：]*KBLI[^:：]*[:：]?\s*(\d{5})/i)
                || extractField(text, /No\.\s*(\d{5})/i);

    // Cari nomor telepon dari pola utama, seluler, atau fallback
    let nomorTelepon = extractField(text, /No\.?\s*Telepon\s*[:：]?\s*(\d{6,15})/i)
                    || extractField(text, /Nomor Telepon Seluler\s*[:：]?\s*(\d{6,15})/i);

    // Cari skala usaha eksplisit
    let skalaUsaha = extractField(text, /Skala Usaha\s*[:：]?\s*(Usaha (Mikro|Kecil|Menengah|Besar))/i);
    if (!skalaUsaha) {
      const skalaMatch = text.match(/Usaha\s+(Mikro|Kecil|Menengah|Besar)/i);
      skalaUsaha = skalaMatch ? `Usaha ${skalaMatch[1]}` : null;
    }

    // Cari jenis penanaman modal
    let jenisPenanamanModal = extractField(text, /Status\s*Penanaman\s*Modal\s*[:：]?\s*(\w+)/i)
                           || extractField(text, /(PMDN|PMA)/i);

    // Ambil alamat
    let alamat = extractField(text, /Alamat\s*(?:Kantor)?\s*[:：]?\s*(.+?)(?=\n|$)/i);
    if (!alamat) {
      alamat = extractField(text, /Jalan\s+[A-Za-z0-9\s,.\-\/]+(?:, Desa\/Kelurahan.*)?/i);
    }

    return {
      nib: extractField(text, /NOMOR INDUK BERUSAHA[:：]?\s*(\d{13})/i),
      kode_kbli: kodeKbli,
      nama_pelaku_usaha: extractField(text, /Nama Pelaku Usaha\s*[:：]?\s*(.+)/i),
      alamat: alamat,
      email: extractField(text, /Email\s*[:：]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i),
      nomor_telepon: nomorTelepon,
      skala_usaha: skalaUsaha,
      jenis_penanaman_modal: jenisPenanamanModal,
      tanggal_terbit: extractField(text, /Diterbitkan di .+?, tanggal[:：]?\s*(\d{1,2} [A-Za-z]+ \d{4})/i)
                   || extractField(text, /Dicetak tanggal[:：]?\s*(\d{1,2} [A-Za-z]+ \d{4})/i)
    };
  },

SIUP(lines) {
  // Helper fungsi untuk gabungkan baris dan ekstrak dengan regex
  function mergeLines(lines) {
    return lines.map(line => line.trim()).filter(Boolean);
  }

  function extractField(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  const text = mergeLines(lines).join("\n");

  // Deteksi apakah badan usaha adalah PT
  const isPT = /Nama Usaha\s*[:：]?\s*PT\s+/i.test(text);

  // Ambil data utama
  const nib = extractField(text, /Nomor Induk Berusaha\s*[:：]?\s*(\d{13,})/i);
  const kodeKbli = extractField(text, /KBLI\s*[:：]?\s*(\d{5})\s*-/i);
  const namaUsaha = extractField(text, /Nama Usaha\s*[:：]?\s*(.+)/i);
  const jenisUsaha = extractField(text, /KBLI\s*[:：]?\s*\d{5}\s*-\s*(.+)/i);

  // Ambil alamat kantor (menangkap alamat kantor / korespondensi)
  const alamatKantor = extractField(
    text,
    /Alamat Kantor\s*\/\s*Korespondensi\s*[:：]?\s*([\s\S]+?)(?=\n(?:Kode KBLI|Nama KBLI|Kode|Nama|Lokasi|1\.))/i
  ) || extractField(
    text,
    /Alamat Kantor\s*\/\s*Korespondensi\s*[:：]?\s*([^\n]+)/i
  );

  // Ambil alamat usaha, fallback ke alamat kantor kalau kosong atau "lihat lampiran"
  let alamatUsaha = extractField(text, /Lokasi Usaha\s*[:：]?\s*(.+)/i);
  if (!alamatUsaha || alamatUsaha.toLowerCase().includes("lihat lampiran")) {
    alamatUsaha = alamatKantor;
  }

  // Ambil tanggal terbit
  const tanggalTerbit = extractField(
    text,
    /Tanggal Terbit Izin Usaha Proyek Pertama\s*[:：]?\s*(\d{1,2} \w+ \d{4})/i
  ) || extractField(
    text,
    /Dicetak tanggal\s*[:：]?\s*(\d{1,2} \w+ \d{4})/i
  );

  // Heuristik: nama pemilik
  let namaPemilik = extractField(text, /Nama Pemilik\s*[:：]?\s*(.+)/i);
  if (!namaPemilik && !isPT) {
    const namaMatch = text.match(/(Bapak|Ibu|Sdr\.?|Saudara)\s+([A-Z\s]+)/i);
    namaPemilik = namaMatch ? namaMatch[2].trim() : null;
  }

  // Fallback dari "Pejabat Berwenang"
  if (!namaPemilik) {
    // Ambil nama pejabat berwenang dari baris yang ada nomor dan jabatan, sampai sebelum KBLI
    const pejabatMatch = text.match(/\d+\s+(Walikota|Bupati|Gubernur|Pejabat)[^\n]+(?=KBLI:)/i);
    if (pejabatMatch) {
      // Hilangkan nomor depan jika ada
      namaPemilik = pejabatMatch[0].replace(/^\d+\s+/, '').trim();
    }
  }

  // Ambil alamat pemilik, fallback ke alamat kantor kalau kosong
  let alamatPemilik = extractField(
    text,
    /Alamat Pemilik\s*[:：]?\s*([\s\S]+?)(?=\n(?:Nama|Kode|KBLI|Barang|Lokasi|Izin|Dikeluarkan))/i
  );
  if (!alamatPemilik) {
    alamatPemilik = alamatKantor;
  }

  return {
    nib: nib,
    kode_bli: kodeKbli,
    nama_usaha: namaUsaha,
    nama_pemilik: namaPemilik,
    alamat_pemilik: alamatPemilik,
    jenis_usaha: jenisUsaha,
    alamat_usaha: alamatUsaha,
    tanggal_terbit: tanggalTerbit
  };
},

  NPWP(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      npwp: extractField(text, /NPWP[:：]?\s*([\d.\-]+)/i),
      nama: extractField(text, /Nama[:：]?\s*(.+)/i),
      alamat: extractField(text, /Alamat[:：]?\s*(.+)/i),
    };
  },

  KTP(lines) {
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
      berlaku_hingga: null
    };

    // Bersihkan dan normalize lines agar mudah parsing
    const cleanedLines = lines.map(line => line.trim());

    for (let i = 0; i < cleanedLines.length; i++) {
      const line = cleanedLines[i];

      switch (true) {
        case /^nik$/i.test(line):
          // next line is NIK number
          if (cleanedLines[i + 1]) {
            data.nik = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^nama$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.nama = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^tempat\/tgllahir$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.tempat_tanggal_lahir = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^jenis kelamin$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.jenis_kelamin = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^gol\.? darah$/i.test(line):
          if (cleanedLines[i + 1] && !/alamat/i.test(cleanedLines[i + 1])) {
            data.gol_darah = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^alamat$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.alamat = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^rt\/rw$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.rt_rw = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^kel\/desa$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.kel_desa = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^kecamatan$/i.test(line):
          // kadang ada ":" diawal
          if (cleanedLines[i + 1]) {
            data.kecamatan = cleanedLines[i + 1].replace(/^:/, '').trim();
            i++;
          }
          break;

        case /^status perkawinan/i.test(line):
          // bisa gabung dalam satu line atau terpisah
          // cek di line ini ada kata status perkawinan
          let statusLine = line.replace(/status perkawinan[:：]?\s*/i, '').trim();
          if (statusLine) {
            data.status_perkawinan = statusLine;
          } else if (cleanedLines[i + 1]) {
            data.status_perkawinan = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^agama$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.agama = cleanedLines[i + 1].replace(/^:/, '').trim();
            i++;
          }
          break;

        case /^pekerjaan$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.pekerjaan = cleanedLines[i + 1].replace(/^:/, '').trim();
            i++;
          }
          break;

        case /^kewarganegaraan[:：]?/i.test(line):
          // bisa gabung satu line
          data.kewarganegaraan = line.replace(/kewarganegaraan[:：]?\s*/i, '').trim();
          // jika kosong, cek next line
          if (!data.kewarganegaraan && cleanedLines[i + 1]) {
            data.kewarganegaraan = cleanedLines[i + 1];
            i++;
          }
          break;

        case /^berlaku hingga$/i.test(line):
          if (cleanedLines[i + 1]) {
            data.berlaku_hingga = cleanedLines[i + 1];
            i++;
          }
          break;

        default:
          // Cek jika ada "Status Perkawinan" dan nilainya nempel di line (misal: "Status PerkawinanBELUM KAWIN")
          if (/status perkawinan/i.test(line)) {
            let match = line.match(/status perkawinan[:：]?\s*(.+)/i);
            if (match) data.status_perkawinan = match[1].trim();
          }
          // Cek Kewarganegaraan dengan tanda : contohnya "Kewarganegaraan:WNI"
          if (/kewarganegaraan[:：]/i.test(line)) {
            data.kewarganegaraan = line.split(/kewarganegaraan[:：]/i)[1].trim();
          }
          break;
      }
    }

    return data;
  },

  KK(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      no_kk: extractField(text, /No\.? KK[:：]?\s*(\d{16})/),
      kepala_keluarga: extractField(text, /Nama Kepala Keluarga[:：]?\s*(.+)/i),
      alamat: extractField(text, /Alamat[:：]?\s*(.+)/i),
      anggota_keluarga: extractField(text, /Nama\s+NIK\s+Jenis Kelamin[\s\S]+?(?=\n\n|$)/i), // Complex regex
    };
  },

  AKTA_KELAHIRAN(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      nama: extractField(text, /Nama Lengkap[:：]?\s*(.+)/i),
      tempat_lahir: extractField(text, /Tempat Lahir[:：]?\s*(.+)/i),
      tanggal_lahir: extractField(text, /Tanggal Lahir[:：]?\s*(.+)/i),
      nama_ayah: extractField(text, /Nama Ayah[:：]?\s*(.+)/i),
      nama_ibu: extractField(text, /Nama Ibu[:：]?\s*(.+)/i),
      tanggal_diterbitkan: extractField(text, /Tanggal Dikeluarkan[:：]?\s*(.+)/i),
    };
  },

  TAGIHAN_LISTRIK(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      id_pelanggan: extractField(text, /ID Pelanggan[:：\-]?\s*(\d+)/i),
      nama_pelanggan: extractField(text, /Nama[:：\-]?\s*(.+)/i),
      alamat: extractField(text, /Alamat[:：\-]?\s*(.+)/i),
      periode: extractField(text, /Periode[:：\-]?\s*(.+)/i),
      total_tagihan: extractField(text, /Total Tagihan[:：\-]?\s*Rp\s*([\d.,]+)/i),
      denda: extractField(text, /Denda[:：\-]?\s*Rp\s*([\d.,]+)/i) || "0",
      jatuh_tempo: extractField(text, /Jatuh Tempo[:：\-]?\s*(.+)/i),
    };
  },

  DEFAULT(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      content: text, // Fallback untuk dokumen yang tidak dikenali
    };
  },
};
