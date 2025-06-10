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

// Di dalam file parser.js
// Ganti seluruh fungsi SIUP dengan ini:

SIUP(lines) {
  // Helper fungsi untuk gabungkan baris dan ekstrak dengan regex
  const text = lines.map(line => line.trim()).filter(Boolean).join("\n");

  const extractField = (txt, regex) => {
    const match = txt.match(regex);
    return match && match[1] ? match[1].trim().replace(/\s+/g, ' ') : null;
  };

  // --- Analisis Data Utama ---
  const nib = extractField(text, /Nomor Induk Berusaha\s*[:：]?\s*(\d{13,})/i);
  const namaUsaha = extractField(text, /Nama Usaha\s*[:：]?\s*(.+)/i);
  const tanggalTerbit = extractField(text, /Tanggal Terbit Izin Usaha Proyek Pertama\s*[:：]?\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  const alamatKantor = extractField(text, /Alamat Kantor\s*\/\s*Korespondensi\s*[:：]?\s*([\s\S]+?)(?=Kode KBLI|1\.\s*Pelaku Usaha)/i);

  // --- Logika Baru untuk Data dari Lampiran ---
  let kodeKbli = null;
  let jenisUsaha = null;
  let alamatUsaha = null;
  let pejabatBerwenang = null;

  // Pola untuk menemukan data di dalam LAMPIRAN
  // Mencari blok yang diawali dengan nomor, diikuti oleh Pejabat Berwenang, lalu KBLI, Jenis Usaha, dan Alamat
  const lampiranPattern = /\d+\s+((?:Walikota|Bupati|Gubernur|Pejabat)[\s\S]+?)\s*KBLI[:：]?\s*(\d{5})\s*-\s*([^\n]+?)\s+((?:Komplek|Jalan|JL\.?|Blok|Gedung|Kawasan)[\s\S]+?)(?=\n|Nomor Proyek|Lembaga OSS)/i;
  const lampiranMatch = text.match(lampiranPattern);

  if (lampiranMatch) {
    // Jika pola lampiran yang kompleks cocok
    pejabatBerwenang = lampiranMatch[1].trim();
    kodeKbli = lampiranMatch[2];
    jenisUsaha = lampiranMatch[3].trim();
    alamatUsaha = lampiranMatch[4].trim().replace(/\s+/g, ' ');
  } else {
    // Fallback jika pola di atas tidak cocok (mencari satu per satu)
    kodeKbli = extractField(text, /KBLI\s*[:：]?\s*(\d{5})/i);
    jenisUsaha = extractField(text, /KBLI\s*[:：]?\s*\d{5}\s*-\s*([^\n]+)/i);
    alamatUsaha = extractField(text, /Lokasi Usaha\s*[:：]?\s*([\s\S]+?)(?=\n|Nomor Proyek)/i) || alamatKantor;
    pejabatBerwenang = extractField(text, /\d+\s+((?:Walikota|Bupati|Gubernur|Pejabat)[\s\S]+?)(?=KBLI:)/i);
  }

  // Jika alamat usaha tidak ditemukan, gunakan alamat kantor sebagai fallback
  if (!alamatUsaha) {
    alamatUsaha = alamatKantor;
  }

  return {
    nib: nib,
    kode_kbli: kodeKbli,
    nama_usaha: namaUsaha,
    nama_pemilik: pejabatBerwenang, // Menggunakan Pejabat Berwenang sebagai nilai utama
    alamat_pemilik: null, // Alamat pribadi pejabat tidak relevan, jadi null
    jenis_usaha: jenisUsaha,
    alamat_usaha: alamatUsaha,
    alamat_kantor: alamatKantor,
    tanggal_terbit: tanggalTerbit
  };
},

NPWP(lines) { // Renamed for clarity
    const merged = mergeLines(lines); // Asumsikan fungsi mergeLines sudah ada
    const fullText = merged.join("\n");

    const npwpMatch = fullText.match(/(\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d[-\s]?\d{3}[.\s]?\d{3})/);
    const npwp = npwpMatch ? npwpMatch[0].replace(/\s/g, '') : null;

    let nama = null;
    let alamat = null;

    const npwpLineIndex = merged.findIndex(line =>
      /\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d[-\s]?\d{3}[.\s]?\d{3}/.test(line)
    );

    if (npwpLineIndex !== -1) {
      const npwpLine = merged[npwpLineIndex];
      const afterNpwp = npwpLine.replace(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d[-\s]?\d{3}[.\s]?\d{3}/, '').trim();
      if (afterNpwp.length > 2 && /^[A-Z\s.,'-]+$/.test(afterNpwp)) {
        nama = afterNpwp;
      } else if (merged[npwpLineIndex + 1] && /^[A-Z\s.,'-]{3,}$/i.test(merged[npwpLineIndex + 1].trim())) {
        nama = merged[npwpLineIndex + 1].trim();
      }

      // --- PERBAIKAN LOGIKA ALAMAT DIMULAI DI SINI ---

      for (let i = npwpLineIndex; i < merged.length; i++) {
        let line = merged[i];

        // 1. Regex untuk menemukan di mana alamat SEBENARNYA dimulai
        const addressStartKeywords = /(JALAN|JL\.?|GG\.?|PERUMAHAN|DSN\.?|DUSUN|RT|RW|DESA|KELURAHAN|KECAMATAN|KAB|KOTA|PROVINSI)/i;
        const startMatch = line.match(addressStartKeywords);

        if (startMatch) {
          // Potong string dari awal keyword alamat yang ditemukan
          let cleanedAlamat = line.substring(startMatch.index);

          // 2. Regex untuk menemukan keyword sampah di akhir alamat
          const noiseKeywords = /(Tanggal Terdaftar|Dipindai dengan|Ldjp)/i;
          const noiseMatch = cleanedAlamat.match(noiseKeywords);

          if (noiseMatch) {
            // Potong string sebelum keyword sampah ditemukan
            cleanedAlamat = cleanedAlamat.substring(0, noiseMatch.index);
          }

          // 3. Hapus spasi berlebih di awal/akhir dan karakter tidak penting
          alamat = cleanedAlamat.trim().replace(/\]$/, '').trim();
          break; // Hentikan pencarian setelah alamat ditemukan dan dibersihkan
        }
      }
    }

    return { npwp, nama, alamat };
},

KTP(lines) {
  // Langkah 1: Gabungkan semua baris dan lakukan pra-pemrosesan agresif.
  let text = lines.join(' ');
  text = text.replace(/Tempat\/Tgl\s*Lahir/gi, ' TempatTglLahir ')
             .replace(/Gol\.\s*Darah/gi, ' GolDarah ')
             .replace(/Jenis\s*Kelamin/gi, ' JenisKelamin ')
             .replace(/Status\s*Perkawinan/gi, ' StatusPerkawinan ')
             .replace(/RT\/RW/gi, ' RTRW ')
             .replace(/Kel\/Desa/gi, ' KelDesa ')
             .replace(/[:：]/g, ' ') // Hapus semua titik dua.
             .replace(/\s+/g, ' '); // Normalisasi spasi.

  // Daftar semua kemungkinan kata kunci UNIK yang kita buat di atas.
  const allKeywords = [
    'NIK', 'Nama', 'TempatTglLahir', 'JenisKelamin', 'GolDarah',
    'Alamat', 'RTRW', 'KelDesa', 'Kecamatan', 'Agama',
    'StatusPerkawinan', 'Pekerjaan', 'Kewarganegaraan', 'Berlaku Hingga'
  ];

  /**
   * Helper function yang mengekstrak nilai SETELAH sebuah kata kunci,
   * dan berhenti SEBELUM kata kunci berikutnya.
   */
  const extractValueAfterKeyword = (startKeyword, textBlock) => {
    // Buat daftar semua kata kunci LAINNYA untuk dijadikan penanda berhenti.
    const stopKeywords = allKeywords.filter(k => k.toLowerCase() !== startKeyword.toLowerCase());
    const stopPattern = stopKeywords.join('|');

    // Regex: Temukan startKeyword, tangkap semuanya (non-greedy) sampai menemukan stopKeyword.
    const regex = new RegExp(`${startKeyword}\\s*([\\s\\S]*?)(?=\\s*(?:${stopPattern})|$)`, 'i');
    const match = textBlock.match(regex);
    return match && match[1] ? match[1].trim() : null;
  };
  
  // Ekstrak NIK menggunakan pola angka yang unik, ini paling andal.
  const nikMatch = text.match(/\b(31|32|33|34|35|36|51|52|53|61|62|63|64|71|72|73|74|75|76|81|82|91|94)\d{14}\b/);
  
  const data = {};
  
  // Ekstrak setiap field menggunakan helper di atas
  allKeywords.forEach(keyword => {
    const key = keyword.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1); // TempatTglLahir -> tempat_tgl_lahir
    data[key] = extractValueAfterKeyword(keyword, text);
  });
  
  // Timpa NIK dengan hasil dari regex yang lebih andal
  data.nik = nikMatch ? nikMatch[0] : data.nik;
  
  // --- Pembersihan dan Penanganan Khusus Pasca-Ekstraksi ---

  // Karena "Jenis Kelamin" ada di baris yang sama dengan "Tempat/Tgl Lahir",
  // nilainya mungkin masih menyatu. Mari kita pisahkan.
  if (data.tempat_tgl_lahir) {
    const ttlParts = data.tempat_tgl_lahir.split(/JenisKelamin/i);
    data.tempat_tgl_lahir = ttlParts[0] ? ttlParts[0].trim() : null;
    if (ttlParts[1] && !data.jenis_kelamin) {
      data.jenis_kelamin = ttlParts[1].trim();
    }
  }

  // Lakukan hal yang sama untuk Agama, Status, Pekerjaan, Kewarganegaraan
  if (data.agama) {
      const agamaBlock = data.agama;
      data.agama = extractValueAfterKeyword('Agama', agamaBlock);
      data.status_perkawinan = extractValueAfterKeyword('StatusPerkawinan', agamaBlock);
      data.pekerjaan = extractValueAfterKeyword('Pekerjaan', agamaBlock);
      data.kewarganegaraan = extractValueAfterKeyword('Kewarganegaraan', agamaBlock);
  }

  // Field tambahan dari header (jika ada)
  data.provinsi = extractValueAfterKeyword('PROVINSI', text) || extractValueAfterKeyword('PBGVINSIE', text);
  data.kabupaten = extractValueAfterKeyword('KABUPATEN', text) || extractValueAfterKeyword('KABUIPAEN', text);
  
  // Hapus nama field yang tidak perlu
  delete data.r_t_r_w;
  delete data.kel__desa;
  
  return {
      nik: data.nik,
      nama: data.nama,
      tempat_tanggal_lahir: data.tempat_tgl_lahir,
      jenis_kelamin: data.jenis_kelamin,
      gol_darah: data.gol_darah,
      alamat: data.alamat,
      rt_rw: data.rt_rw,
      kel_desa: data.kel_desa,
      kecamatan: data.kecamatan,
      Kabupaten: data.kabupaten,
      provinsi: data.provinsi,
      kode_pos: null,
      status_perkawinan: data.status_perkawinan,
      agama: data.agama,
      pekerjaan: data.pekerjaan,
      kewarganegaraan: data.kewarganegaraan,
      berlaku_hingga: data.berlaku_hingga
  };
},

KK(lines) {
  const text = lines.join(" ");

  const extractField = (pattern) => {
    const match = text.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  };

  // --- 1. Ekstrak Nomor KK (Sudah Benar) ---
  const no_kk = extractField(/No\.?\s*[:：]?\s*(\d{16})/i);

  // --- 2. Ekstrak Kepala Keluarga (Diperbaiki) ---
  // Gunakan kata "Alamat" sebagai penanda akhir. Dibuat non-greedy (dengan ?).
  const kepala_keluarga = extractField(/Nama\s+Kepala\s+Keluarg[ae]\s*[:：]?\s*([A-Z\s.'-]+?)\s*Alama[et]/i);

  // --- 3. Ekstrak Alamat (Diperbaiki) ---
  // Tangkap semua di antara "Alamat" dan "Provinsi", lalu bersihkan.
  let alamat = extractField(/Alama[et]\s*[:：]?\s*(.*?)\s*Provinsi/i);
  if (alamat) {
    alamat = alamat
      .replace(/Desa\/Kelurahan|RTIRW|Kocamatan|Kabupaten\s*Kota|Kode\s*Pos/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // --- 4. Ekstrak Anggota Keluarga (Perbaikan Total) ---
  const anggota_keluarga = [];
  
  // a. Isolasi blok data anggota untuk mengurangi kesalahan.
  //    Data anggota dimulai setelah header tabel (misal: "Jenis Pekeraan").
  const memberDataBlock = text.split(/Jenis\s+Pekeraan/i)[1] || text;

  // b. Regex yang diperbaiki: non-greedy dan lebih spesifik.
  //    ([A-Z\s'.]{4,35}?) -> Tangkap nama (4-35 karakter), '?' membuatnya berhenti secepat mungkin.
  const memberRegex = /\b([A-Z\s'.]{4,35}?)\s*(\d{16})\b/g;

  let match;
  while ((match = memberRegex.exec(memberDataBlock)) !== null) {
    // match[1] adalah nama, match[2] adalah NIK.
    // Lakukan pembersihan sederhana pada nama untuk menghapus sisa-sisa yang tidak diinginkan.
    const cleanedName = match[1]
      .replace(/L\s*$/, '') // Hapus 'L' (Laki-laki) di akhir
      .replace(/PEREMPUAN\s*$/, '') // Hapus 'PEREMPUAN' di akhir
      .trim();
      
    // Hanya tambahkan jika nama yang bersih memiliki panjang yang masuk akal.
    if (cleanedName.length > 2) {
        anggota_keluarga.push({
            nama: cleanedName,
            nik: match[2].trim()
        });
    }
  }

  // Jika kepala keluarga belum ditemukan, coba ambil dari anggota pertama.
  let finalKepalaKeluarga = kepala_keluarga;
  if (!finalKepalaKeluarga && anggota_keluarga.length > 0) {
      finalKepalaKeluarga = anggota_keluarga[0].nama;
  }
  
  return {
    no_kk,
    kepala_keluarga: finalKepalaKeluarga,
    alamat,
    anggota_keluarga: anggota_keluarga.length > 0 ? anggota_keluarga : null,
  };
}
,

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
  const text = lines.join("\n");

  return {
    id_pelanggan: extractField(text, /IDPEL\s*[:：]?\s*(\d{12})/i),
    nama_pelanggan: extractField(text, /NAMA\s*[:：]?\s*([A-Z\s]+?)\s+STAND/i),
    alamat: extractField(text, /ALAMAT\s*[:：]?\s*(.+)/i), // Masih dummy karena data alamat tidak tersedia
    periode: extractField(text, /BL\/TH\s*[:：]?\s*([A-Z]{3}\d{2})/i),
    total_tagihan: extractField(text, /TOTAL\s+BAYAR\s*[:：]?\s*Rp\s*([\d.]+)/i),
    denda: extractField(text, /DENDA\s*[:：]?\s*Rp\s*([\d.]+)/i) || "0",
    jatuh_tempo: extractField(text, /JATUH TEMPO\s*[:：]?\s*(.+)/i), // Belum ada di contoh, placeholder
  };
},

  DEFAULT(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      content: text, // Fallback untuk dokumen yang tidak dikenali
    };
  },
};
