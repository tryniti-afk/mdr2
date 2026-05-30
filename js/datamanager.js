// ================================================================
//  DATAMANAGER.JS — Pengelola Set Soal Terpusat
//  Semua modul menggunakan DataMgr untuk:
//    • Pilih set soal: Spreadsheet sheet tertentu ATAU Lokal
//    • Simpan soal lokal per modul
//    • Ambil soal yang sudah di-parse siap pakai
//    • Kelola mode permainan (sekali / jumlah-soal / infinity)
// ================================================================

var SHEET_ID = "1QozIKvWjISQmFK15mvjk9maH3FfDENGhmrIRS5BoHiE";

// Sheet yang tersedia di spreadsheet
var SHEET_VOCAB = [
  { id:"hsk1-2", label:"HSK 1-2",  tipe:"vocab" },
  { id:"Hsk3",   label:"HSK 3",    tipe:"vocab" },
  { id:"Hsk4",   label:"HSK 4",    tipe:"vocab" },
  { id:"Hsk5",   label:"HSK 5",    tipe:"vocab" },
];
var SHEET_SENTENCE = [
  { id:"Grhsk1", label:"GR HSK 1", tipe:"sentence" },
  { id:"Grhsk2", label:"GR HSK 2", tipe:"sentence" },
  { id:"Grhsk3", label:"GR HSK 3", tipe:"sentence" },
  { id:"Grhsk4", label:"GR HSK 4", tipe:"sentence" },
  { id:"Grhsk5", label:"GR HSK 5", tipe:"sentence" },
];

// ─────────────────────────────────────────────────────────────────
var DataMgr = {

  // Cache hasil fetch (key = sheet id)
  _cache: {},

  // Soal lokal per modul
  _lokal: {
    vocab: [
      { pertanyaan:"高兴", kunci:"高兴/gāoxìng || senang", translate:"senang" },
      { pertanyaan:"飞机", kunci:"飞机/fēijī || pesawat terbang", translate:"pesawat terbang" },
      { pertanyaan:"朋友", kunci:"朋友/péngyou || teman", translate:"teman" },
    ],
    sentence: [
      { pertanyaan:"她在看书。", kunci:"Dia sedang membaca/tā zài kàn shū || She is reading", translate:"Dia sedang membaca" },
      { pertanyaan:"妈妈在打电话。", kunci:"Ibu menelepon/māmā zài dǎ diànhuà || Mom is calling", translate:"Ibu sedang menelepon" },
    ],
  },

  // ── FETCH SPREADSHEET ──────────────────────────────────────
  async fetchSheet(sheetId) {
    if (this._cache[sheetId]) return this._cache[sheetId];
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetId)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const parsed = this._parseCSV(await res.text(), sheetId);
      if (parsed && parsed.length) this._cache[sheetId] = parsed;
      return parsed;
    } catch(e) { return null; }
  },

  // ── PARSE CSV sesuai tipe sheet ─────────────────────────────
  _parseCSV(teks, sheetId) {
    const baris = teks.trim().split("\n").slice(1); // skip header
    const isGr = sheetId.toLowerCase().startsWith("gr");

    if (isGr) {
      // Format: Hanzi, Kalimat, Pinyin, Translateen, Translateid, struktur, Explain, Note
      return baris.map(b => {
        const col = this._splitCSVRow(b);
        if (!col[0]) return null;
        return {
          pertanyaan: col[1] || col[0],    // Kalimat (tanpa spasi)
          hanzi:      col[1] || col[0],
          pinyin:     col[2] || "",
          arti:       col[4] || col[3] || "",   // Translateid lalu en
          struktur:   col[5] || "",
          explain:    col[6] || "",
          note:       col[7] || "",
          kunci:      (col[4] || col[3] || "").trim(),
          translate:  col[4] || col[3] || "",
          _tipe:      "sentence",
        };
      }).filter(Boolean);
    } else {
      // Format: Pertanyaan, Kunci jawaban, Translate
      return baris.map(b => {
        const col = this._splitCSVRow(b);
        if (!col[0]) return null;
        return {
          pertanyaan: col[0].trim(),
          kunci:      (col[1] || "").trim(),
          translate:  (col[2] || "").trim(),
          _tipe:      "vocab",
        };
      }).filter(Boolean);
    }
  },

  // ── SPLIT CSV row (handle quoted commas) ────────────────────
  _splitCSVRow(row) {
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    result.push(cur.trim());
    return result;
  },

  // ── AMBIL SOAL dari sheet atau lokal (async) ─────────────────
  async ambilSoal(sheetId, tipe) {
    if (sheetId === "lokal") {
      return this._lokal[tipe] || [];
    }
    const data = await this.fetchSheet(sheetId);
    return (data && data.length) ? data : (this._lokal[tipe] || []);
  },

  // ── SIMPAN SOAL LOKAL ────────────────────────────────────────
  simpanLokal(tipe, teks) {
    const baris = teks.trim().split("\n").map(b => {
      const bg = b.split("|");
      if (bg.length < 2 || !bg[0].trim()) return null;
      return {
        pertanyaan: bg[0].trim(),
        kunci:      bg[1].trim(),
        translate:  (bg[2] || "").trim(),
        _tipe:      tipe,
      };
    }).filter(Boolean);
    if (!baris.length) return 0;
    this._lokal[tipe] = baris;
    return baris.length;
  },

  // ── FORMAT teks lokal untuk edit ─────────────────────────────
  toEditTeks(tipe) {
    return (this._lokal[tipe] || [])
      .map(s => `${s.pertanyaan} | ${s.kunci}${s.translate ? " | " + s.translate : ""}`)
      .join("\n");
  },

  // ── SHEETS UNTUK TIPE ────────────────────────────────────────
  sheetsUntuk(tipe) {
    return tipe === "sentence" ? SHEET_SENTENCE : SHEET_VOCAB;
  },
};
