import { mergeLines } from "./mergeLines.js";

const extractField = (text, pattern) => {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
};

export const parsers = {
  NIB(lines) {
    const text = mergeLines(lines).join("\n");

    const kodeKbli = extractField(text, /Lampiran[^:]*\s+.*?(\d{5})/i) || extractField(text, /No\.\s*(\d{5})/i);
    const skalaUsahaMatch = text.match(/Skala Usaha\s*[:：]?\s*(Usaha (Mikro|Kecil|Menengah|Besar))/i);
    const skalaUsaha = skalaUsahaMatch ? skalaUsahaMatch[1].trim() : null;

    // Perbaikan nomor telepon seluler
    let nomorTelepon = extractField(text, /Nomor Telepon Seluler\s*[:：]?\s*(.+?)(?=\n|$)/i);
    if (nomorTelepon) {
      // Bersihkan jika hanya "+", "-", atau kosong
      nomorTelepon = nomorTelepon.trim();
      if (nomorTelepon === '+' || nomorTelepon === '-' || nomorTelepon === '') {
        nomorTelepon = null;
      }
    } else {
      // Fallback ke "Nomor Telepon" (jika ada)
      nomorTelepon = extractField(text, /Nomor Telepon\s*[:：]?\s*(.+?)(?=\n|$)/i);
      if (nomorTelepon) {
        nomorTelepon = nomorTelepon.trim();
        if (nomorTelepon === '+' || nomorTelepon === '-' || nomorTelepon === '') {
          nomorTelepon = null;
        }
      }
    }

    return {
      nib: extractField(text, /NOMOR INDUK BERUSAHA[:：]?\s*(\d{13})/i),
      kode_kbli: kodeKbli,
      nama_pelaku_usaha: extractField(text, /Nama Pelaku Usaha\s*[:：]?\s*(.+)/i),
      alamat: extractField(text, /Alamat\s*[:：]?\s*(.+?)(?=\n|$)/i),
      email: extractField(text, /Email\s*[:：]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i),
      nomor_telepon: nomorTelepon,
      skala_usaha: skalaUsaha,
      tanggal_terbit: extractField(text, /Diterbitkan di .+?, tanggal[:：]?\s*(\d{1,2} [A-Za-z]+ \d{4})/i) || extractField(text, /Dicetak tanggal[:：]?\s*(\d{1,2} [A-Za-z]+ \d{4})/i)
    };
  },

  SIUP(lines) {
    const text = mergeLines(lines).join("\n");
    return {
      nib: extractField(text, /Nomor Induk Berusaha[:：]?\s*(\S+)/i),
      kode_bli: extractField(text, /Kode KBLI[:：]?\s*(\S+)/i),
      nama_usaha: extractField(text, /Nama Perusahaan[:：]?\s*(.+)/i),
      nama_pemilik: extractField(text, /Nama Pemilik[:：]?\s*(.+)/i),
      alamat_pemilik: extractField(text, /Alamat Pemilik[:：]?\s*(.+)/i),
      jenis_usaha: extractField(text, /Barang Jasa Dagangan Utama[:：]?\s*(.+)/i),
      alamat_usaha: extractField(text, /Lokasi Usaha[:：]?\s*(.+)/i),
      tanggal_terbit: extractField(text, /Dikeluarkan tanggal[:：]?\s*(.+)/i),
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
    const text = mergeLines(lines).join("\n");
    return {
      nik: extractField(text, /NIK[:：]?\s*(\d{16})/),
      nama: extractField(text, /Nama[:：]?\s*(.+)/i),
      tempat_tanggal_lahir: extractField(text, /Tempat\/Tgl Lahir[:：]?\s*(.+)/i),
      alamat: extractField(text, /Alamat[:：]?\s*(.+)/i),
      rt_rw: extractField(text, /RT\/RW[:：]?\s*(\d+\/\d+)/i),
      kel_desa: extractField(text, /Kel\/Desa[:：]?\s*(.+)/i),
      kecamatan: extractField(text, /Kecamatan[:：]?\s*(.+)/i),
    };
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
