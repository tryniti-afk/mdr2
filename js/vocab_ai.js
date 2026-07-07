// ================================================================
//  VOCAB_AI.JS — Latihan Vocab dengan AI (Fitur Baru)
//  Supaya latihan vocab gak bosen: ngobrol / telepon dengan AI
//  (Gemini) yang mengajarkan 5 kata secara berurutan:
//    1) Kata diperkenalkan (suara + hanzi + pinyin + arti)
//    2) Ditunjukkan contoh kalimat
//    3) Siswa diajak bikin kalimat sendiri pakai kata itu
//    4) Ada tes singkat soal kata itu
//    5) Setelah 5 kata selesai → tantangan: bikin 1 kalimat
//       yang memuat SEMUA 5 kata sekaligus
//
//  2 mode tampilan:
//    - VocabAIChat  → chat teks/suara biasa (gelembung chat)
//    - VocabAICall  → simulasi "telepon" (audio otomatis, minim teks)
//
//  Cara pasang di index.html (sebelum </body>, setelah sentence.js):
//    <script src="js/vocab_ai.js"></script>
//
//  Lalu di vocab.js → renderMenu(), tambahkan card baru yang
//  memanggil Vocab.bukaLatihanAI() (sudah ditambahkan otomatis
//  di file vocab.js oleh perubahan yang menyertai ini).
// ================================================================

// ── HUB (dipanggil dari Vocab.bukaLatihanAI()) ─────────────────
var VocabAIHub = {
  renderMenu() {
    const cards = [
      { obj: "VocabAIChat", icon: "💬", label: "Chat AI",   desc: "Ngobrol teks/suara, dilatih 5 kata sekaligus" },
      { obj: "VocabAICall", icon: "📞", label: "Telepon AI", desc: "Simulasi telepon, dengar & jawab langsung" },
      { obj: "VocabAIFreeCall", icon: "🗣️", label: "Telepon Bebas (HSK)", desc: "Obrol bebas via suara, kosakata dibatasi level HSK pilihanmu" },
      { obj: "VocabAIFreeChat", icon: "🗨️", label: "Chat Bebas (HSK)", desc: "Obrol bebas teks/suara, kosakata dibatasi level HSK pilihanmu" },
    ];
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">🤖</div>
          <div>
            <div class="sv-title">Latihan Vocab dengan AI</div>
            <div class="sv-subtitle">Biar gak bosen — ambil 5 kata, dibahas satu-satu bareng AI</div>
          </div>
        </div>
        <div class="sub-menu-grid">
          ${cards.map(c => `
            <div class="sub-card" onclick="el('konten-utama').innerHTML = ${c.obj}.renderMenu()">
              <div class="sub-icon">${c.icon}</div>
              <div class="sub-label">${c.label}</div>
              <div class="sub-desc">${c.desc}</div>
            </div>
          `).join("")}
        </div>
        <button class="btn btn-abu" style="width:100%;margin-top:14px" onclick="Vocab.kembaliMenu()">← Kembali ke Vocabulary</button>
      </div>`;
  }
};

// ── UTIL BERSAMA (ambil kata, escape teks) ─────────────────────
var VocabAIData = {
  esc(s) { return (s || "").replace(/'/g, "\\'").replace(/\n/g, " "); },
  esc2(s) {
    return (s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  },
  esc2md(s) {
    return VocabAIData.esc2(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.+?)\*/g, "<i>$1</i>")
      .replace(/`(.+?)`/g, "<code style='background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px'>$1</code>");
  },

  // Ambil N kata vocab acak dari set soal vocab yang sedang aktif user.
  // Fallback ke database bawaan (DB.vocab) kalau sheet kosong/gagal.
  async ambilKata(jumlah) {
    let pool = [];
    try {
      const dariSheet = await SetSoal.getSoalSiap("vocab");
      if (dariSheet && dariSheet.length) {
        pool = dariSheet
          .map(v => ({ hanzi: v.hanzi, pinyin: v.pinyin || "", arti: v.arti || "" }))
          .filter(v => v.hanzi && v.arti);
      }
    } catch (e) { /* abaikan, pakai fallback */ }
    if (!pool.length && typeof DB !== "undefined" && DB.vocab) {
      pool = DB.vocab.map(v => ({ hanzi: v.hanzi, pinyin: v.pinyin || "", arti: v.arti || "" }));
    }
    if (!pool.length) return [];
    return acak(pool).slice(0, jumlah);
  },

  // Ambil SEMUA kata dari gabungan beberapa sheet HSK (untuk Telepon Bebas).
  // sheetIds: array id sheet dari SHEET_VOCAB (mis. ["hsk1-2","Hsk3"])
  async ambilKataDariHSK(sheetIds) {
    let allRaw = [];
    for (const id of sheetIds) {
      try {
        const raw = await DataMgr.ambilSoal(id, "vocab");
        if (raw && raw.length) allRaw = allRaw.concat(raw);
      } catch (e) { /* lanjut ke sheet berikutnya */ }
    }
    if (!allRaw.length) return [];
    const kata = SetSoal._konversiVocab(allRaw).filter(v => v.hanzi && v.arti);
    // Buang duplikat hanzi
    const seen = new Set();
    return kata.filter(v => { if (seen.has(v.hanzi)) return false; seen.add(v.hanzi); return true; });
  },
};

// ================================================================
//  ENGINE INTI — State machine 5-kata (dipakai Chat & Telepon)
// ================================================================
var VocabAIFlow = {
  words: [],
  wordIdx: 0,
  subPhase: "kalimat",   // "kalimat" | "tes" | "final" | "selesai"
  history: [],           // {role:'user'|'model', text}
  putaran: 0,
  koreksiRounds: 1,      // 1 = langsung lanjut, 2/3 = ulang tes sampai benar
  sedangProses: false,
  bahasaJawabanBerikutnya: "zh",  // "zh" | "id" — bahasa yang diharapkan untuk giliran jawaban siswa selanjutnya

  reset(words, koreksiRounds) {
    this.words = words;
    this.wordIdx = 0;
    this.subPhase = "kalimat";
    this.history = [];
    this.putaran = 0;
    this.koreksiRounds = koreksiRounds || 1;
    this.sedangProses = false;
    this.bahasaJawabanBerikutnya = "zh";
  },

  // Kode bahasa STT ("zh-CN"/"id-ID") sesuai bahasa jawaban yang diharapkan giliran ini
  bahasaSTT() {
    return this.bahasaJawabanBerikutnya === "id" ? "id-ID" : "zh-CN";
  },

  kataSaatIni() { return this.words[this.wordIdx]; },
  progres() { return { idx: this.wordIdx, total: this.words.length, fase: this.subPhase }; },

  _daftarKataTeks() {
    return this.words.map(w => `${w.hanzi} (${w.pinyin || "?"}) = ${w.arti}`).join("\n");
  },

  _systemPrompt() {
    return `Kamu adalah tutor bahasa Mandarin yang ramah dan santai, sedang melatih vocabulary seorang siswa lewat obrolan (chat/telepon), seolah ngobrol dengan teman.
Kalian akan membahas 5 kata vocab berikut secara BERURUTAN, satu per satu, TIDAK BOLEH loncat-loncat atau mengganti kata di luar urutan:
${this._daftarKataTeks()}

Aturan umum:
- Ikuti instruksi tugas yang diberikan di setiap giliran dengan tepat, jangan menambah langkah lain di luar instruksi.
- Nada natural, hangat, seperti mengobrol biasa — bukan seperti robot ujian.
- Gunakan HANYA kata-kata di atas untuk bagian latihan; boleh pakai kosakata Mandarin dasar lain untuk melengkapi kalimat, tapi jangan ganti kata vocab yang sedang dibahas.
- Field "hanzi"/"pinyin" diisi dengan kalimat Mandarin utama dari pesanmu (misalnya contoh kalimat atau kalimat tes), supaya bisa diperdengarkan lewat audio. Kalau tidak ada kalimat Mandarin di giliran ini, isi dengan string kosong.
- Field "indonesia" berisi narasi lengkap pesanmu dalam Bahasa Indonesia (penjelasan, terjemahan, ajakan, dsb) — ini yang utama dibaca siswa.
- Field "koreksi" berisi feedback singkat atas jawaban siswa sebelumnya (kosong jika belum ada jawaban untuk dinilai).
- Field "cocok": true jika jawaban/kalimat siswa yang baru dinilai sudah benar & memadai, false jika masih kurang tepat.
- Field "selesai": true HANYA jika sesi latihan benar-benar sudah berakhir (setelah tantangan kalimat gabungan terakhir).
- Field "bahasaJawaban": bahasa yang HARUS dipakai siswa untuk menjawab giliran ini. Isi "zh" jika kamu meminta siswa mengucapkan/menulis sesuatu dalam Bahasa Mandarin (misalnya bikin kalimat, mengulang kalimat, dsb). Isi "id" jika kamu meminta siswa menjawab dalam Bahasa Indonesia (misalnya menyebutkan arti/terjemahan suatu kata, menjawab pertanyaan tes yang minta artinya). Wajib diisi setiap giliran sesuai bahasa yang kamu minta di pertanyaan/instruksimu.

Balas HANYA dengan JSON valid (tanpa markdown/komentar):
{
  "hanzi": "kalimat Mandarin utama (atau kosong)",
  "pinyin": "pinyin bertanda nada (atau kosong)",
  "indonesia": "narasi lengkap pesanmu",
  "koreksi": "feedback singkat, atau string kosong",
  "cocok": false,
  "selesai": false,
  "bahasaJawaban": "zh"
}`;
  },

  async _call(instruksi) {
    const messages = [{ role: "user", content: this._systemPrompt() }];
    for (const h of this.history) messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
    messages.push({ role: "user", content: instruksi });

    const raw = await SentenceVocab._callAI(messages, 550);
    let parsed;
    try {
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
      if (!parsed) throw new Error("Gagal memproses balasan AI. Coba lagi.");
    }
    this.history.push({ role: "model", text: JSON.stringify(parsed) });
    this.bahasaJawabanBerikutnya = parsed.bahasaJawaban === "id" ? "id" : "zh";
    return parsed;
  },

  // ── GILIRAN PERTAMA: perkenalkan kata pertama ─────────────────
  async mulai() {
    this.subPhase = "kalimat";
    const w = this.kataSaatIni();
    const instruksi = `ini giliran PALING PERTAMA. Perkenalkan kata pertama kepada siswa: Hanzi "${w.hanzi}", pinyin "${w.pinyin}", artinya "${w.arti}".
Pesanmu harus mencakup, dalam alur yang natural:
1. Perkenalan kata ini (sebut hanzi, pinyin, dan artinya dengan jelas).
2. SATU contoh kalimat sederhana yang memakai kata ini (isi kalimat ini di field "hanzi" & "pinyin", dan sertakan terjemahannya di field "indonesia").
3. Ajakan untuk siswa mencoba membuat kalimat sederhananya SENDIRI memakai kata ini.
Set "cocok": false dan "koreksi": "" karena belum ada jawaban siswa.`;
    return this._call(instruksi);
  },

  // ── ROUTER JAWABAN USER ────────────────────────────────────────
  async kirimJawaban(teks) {
    this.history.push({ role: "user", text: teks });
    if (this.subPhase === "kalimat") return this._prosesKalimat(teks);
    if (this.subPhase === "tes") return this._prosesTes(teks);
    if (this.subPhase === "final") return this._prosesFinal(teks);
  },

  async _prosesKalimat(teks) {
    const w = this.kataSaatIni();
    const instruksi = `Siswa baru saja membuat kalimat sendiri memakai kata "${w.hanzi}": "${teks}"
Evaluasi kalimat itu (grammar & makna), isi feedback singkat & ramah di field "koreksi", dan set "cocok" sesuai benar-tidaknya.
Setelah feedback itu, LANJUTKAN pesan yang sama dengan mengajukan SATU pertanyaan tes singkat seputar kata "${w.hanzi}" ini (misalnya: minta artinya, minta pilih terjemahan yang tepat, atau minta lengkapi kalimat rumpang memakai kata ini). Tulis pertanyaan tes ini di field "indonesia" (boleh sertakan hanzi/pinyin soal di field "hanzi"/"pinyin" jika relevan, kalau tidak ada kalimat Mandarin biarkan field itu kosong).
Ini SATU pesan yang mengalir: feedback kalimat + soal tes, bukan dua pesan terpisah.`;
    this.subPhase = "tes";
    this.putaran = 0;
    return this._call(instruksi);
  },

  async _prosesTes(teks) {
    const w = this.kataSaatIni();
    const isLast = this.wordIdx >= this.words.length - 1;
    const attempt = this.putaran + 1;
    const wajibPindah = attempt >= this.koreksiRounds;

    let instruksi;
    if (!wajibPindah) {
      instruksi = `Nilai jawaban tes siswa untuk kata "${w.hanzi}": "${teks}"
Ini percobaan ke-${attempt} dari ${this.koreksiRounds}. Jika jawaban SUDAH benar/tepat, set "cocok": true dan beri selamat singkat (boleh tetap lanjut ke langkah berikut kalau memang sudah benar). Jika BELUM benar, set "cocok": false, beri koreksi singkat & minta siswa coba jawab lagi (boleh kasih clue tambahan) — JANGAN pindah kata dulu selama belum benar dan belum mencapai batas percobaan.`;
    } else if (isLast) {
      const daftar = this.words.map(x => `${x.hanzi}(${x.arti})`).join("、");
      instruksi = `Nilai jawaban tes siswa untuk kata "${w.hanzi}": "${teks}"
Beri feedback singkat di "koreksi" & set "cocok" sesuai benar-tidaknya.
Karena ini kata TERAKHIR dari ${this.words.length} kata (${daftar}), lanjutkan pesan yang sama dengan memberi tahu siswa bahwa sebelum tantangan kalimat gabungan nanti, akan ada mini-game seru mencocokkan Hanzi-Pinyin lalu Hanzi-Arti untuk me-review semua kata tadi. Jelaskan singkat & memotivasi di field "indonesia" bahwa mini-game akan segera dimulai. Set "selesai": false.`;
    } else {
      const next = this.words[this.wordIdx + 1];
      instruksi = `Nilai jawaban tes siswa untuk kata "${w.hanzi}": "${teks}"
Beri feedback singkat di "koreksi" & set "cocok" sesuai benar-tidaknya.
Setelah itu, LANJUTKAN pesan yang sama dengan memperkenalkan kata BERIKUTNYA secara natural (transisi mengalir, jangan kaku): Hanzi "${next.hanzi}", pinyin "${next.pinyin}", artinya "${next.arti}". Sertakan SATU contoh kalimat sederhana memakai kata baru ini (isi di field "hanzi"/"pinyin" beserta terjemahannya di "indonesia"), lalu ajak siswa membuat kalimat sendiri dengan kata baru ini. Ini tetap SATU pesan yang mengalir (feedback tes lama + perkenalan kata baru), bukan dua pesan terpisah.`;
    }

    const parsed = await this._call(instruksi);
    if (!wajibPindah) {
      this.putaran = attempt;
    } else if (isLast) {
      this.subPhase = "matching";
      this.putaran = 0;
    } else {
      this.wordIdx++;
      this.subPhase = "kalimat";
      this.putaran = 0;
    }
    return parsed;
  },

  // ── Dipanggil setelah mini-game matching (Hanzi-Pinyin & Hanzi-Arti) selesai ──
  async mulaiTantanganAkhir() {
    const daftar = this.words.map(w => `${w.hanzi}(${w.arti})`).join("、");
    const instruksi = `Siswa baru saja menyelesaikan mini-game mencocokkan Hanzi-Pinyin dan Hanzi-Arti untuk me-review ${this.words.length} kata (${daftar}).
Sekarang ajak siswa membuat SATU kalimat yang memuat SEMUA ${this.words.length} kata tersebut sekaligus sebagai tantangan penutup sesi. Jelaskan tantangan ini dengan jelas & memotivasi di field "indonesia". Set "koreksi": "" dan "cocok": false karena belum ada jawaban siswa untuk dinilai kali ini. Set "selesai": false (masih menunggu kalimat gabungan siswa).`;
    this.subPhase = "final";
    return this._call(instruksi);
  },

  async _prosesFinal(teks) {
    const daftar = this.words.map(w => `${w.hanzi} (${w.arti})`).join(", ");
    const instruksi = `Siswa baru saja membuat kalimat gabungan menggunakan 5 kata (${daftar}): "${teks}"
Evaluasi apakah kalimat ini valid, menggunakan kata-kata tersebut dengan benar & natural. Isi feedback & apresiasi di field "koreksi" dan "indonesia". Tutup sesi dengan pesan penutup yang hangat & memotivasi untuk lanjut belajar. Set "cocok" sesuai benar-tidaknya, dan set "selesai": true karena ini akhir sesi latihan vocab.`;
    this.subPhase = "selesai";
    return this._call(instruksi);
  },
};

// ================================================================
//  1) VOCABAICHAT — Chat teks/suara dengan AI
// ================================================================
var VocabAIChat = {
  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin", "indo"]),
    aiSuara: true,
    caraJawab: "ketik",       // "ketik" | "suara"
    jumlahKata: 5,
    koreksiRounds: 1,
  },

  renderMenu() {
    const c = this._cfg;
    const chip = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="VocabAIChat._toggle('${key}')">${label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">💬</div>
          <div>
            <div class="sv-title">Chat Vocab AI</div>
            <div class="sv-subtitle">Ambil 5 kata, dibahas satu-satu lewat obrolan</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔢 Jumlah Kata: <b id="vac-jumlah-label">${c.jumlahKata}</b></div>
          <input type="range" min="3" max="8" value="${c.jumlahKata}" oninput="VocabAIChat._setJumlah(this.value)" style="width:100%;accent-color:#1565c0">
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info pesan AI yang ditampilkan:</div>
          <div class="sv-chips" id="vac-chips">
            ${chip("hanzi", "🈯 Hanzi")}
            ${chip("pinyin", "🔤 Pinyin")}
            ${chip("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔊 Pesan AI pakai suara juga?</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.aiSuara ? "aktif" : ""}" id="vac-suara-ya" onclick="VocabAIChat._setSuara(true)">🔊 Ya</button>
            <button class="sv-chip ${!c.aiSuara ? "aktif" : ""}" id="vac-suara-tidak" onclick="VocabAIChat._setSuara(false)">🚫 Teks saja</button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">✏️ Cara Kamu Menjawab:</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.caraJawab === "ketik" ? "aktif" : ""}" id="vac-jawab-ketik" onclick="VocabAIChat._setJawab('ketik')">⌨️ Ketik</button>
            <button class="sv-chip ${c.caraJawab === "suara" ? "aktif" : ""}" id="vac-jawab-suara" onclick="VocabAIChat._setJawab('suara')">🎤 Suara</button>
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">🔁 Tes Tiap Kata</div>
          <div class="sv-chips" id="vac-koreksi-chips">
            <button class="sv-chip ${c.koreksiRounds === 1 ? "aktif" : ""}" onclick="VocabAIChat._setKoreksi(1)">➡️ Langsung Lanjut</button>
            <button class="sv-chip ${c.koreksiRounds === 2 ? "aktif" : ""}" onclick="VocabAIChat._setKoreksi(2)">🔁 Ulang s/d 2x</button>
            <button class="sv-chip ${c.koreksiRounds === 3 ? "aktif" : ""}" onclick="VocabAIChat._setKoreksi(3)">🔁 Ulang s/d 3x</button>
          </div>
          <div style="font-size:11px;color:#78909c;margin-top:6px">Jika dipilih 2x/3x: kalau jawaban tes masih salah, AI akan minta kamu coba lagi pada kata yang sama sampai batas percobaan, kecuali kamu sudah jawab benar duluan.</div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <input type="password" id="vac-api-key-input" placeholder="Masukkan Gemini API key..." value="${SentenceVocab._getApiKey()}"
            style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
            oninput="SentenceVocab._setApiKey(this.value)">
          <div style="font-size:11px;color:#888;margin-top:5px">Key sama dipakai di semua fitur AI (tersimpan di browser saja).</div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="VocabAIChat.mulai()">🚀 Mulai Chat</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="VocabAIChat.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggle(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("vac-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi", "pinyin", "indo"][i])));
  },
  _setJumlah(v) {
    this._cfg.jumlahKata = parseInt(v);
    const lbl = el("vac-jumlah-label"); if (lbl) lbl.textContent = v;
  },
  _setSuara(v) {
    this._cfg.aiSuara = v;
    const ya = el("vac-suara-ya"), tidak = el("vac-suara-tidak");
    if (ya) ya.classList.toggle("aktif", v);
    if (tidak) tidak.classList.toggle("aktif", !v);
  },
  _setJawab(v) {
    this._cfg.caraJawab = v;
    const a = el("vac-jawab-ketik"), b = el("vac-jawab-suara");
    if (a) a.classList.toggle("aktif", v === "ketik");
    if (b) b.classList.toggle("aktif", v === "suara");
  },
  _setKoreksi(v) {
    this._cfg.koreksiRounds = v;
    const wrap = el("vac-koreksi-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", [1, 2, 3][i] === v));
  },

  async mulai() {
    if (!SentenceVocab._getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">Menyiapkan 5 kata untuk latihan...</div>
      </div>`;
    const words = await VocabAIData.ambilKata(this._cfg.jumlahKata);
    if (!words.length) { tampilToast("⚠️ Tidak ada data vocab untuk dipakai."); this.kembaliMenu(); return; }
    VocabAIFlow.reset(words, this._cfg.koreksiRounds);
    this._renderChatUI();
    await this._giliran(() => VocabAIFlow.mulai());
  },

  _renderChatUI() {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">💬 Chat Vocab AI</div>
        <div id="vac-progres" style="text-align:center;color:#546e7a;font-size:12px;margin-bottom:6px"></div>
        <div id="vac-chat-area" class="sv-chat-area" style="max-height:340px"></div>
        <div id="vac-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar latihan, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="vac-tanya-input" placeholder="Misal: apa arti 认真?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')VocabAIChat._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="VocabAIChat._kirimTanya()">Tanya</button>
          </div>
          <div id="vac-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="VocabAIChat.kembaliMenu()">← Selesai & Keluar</button>
        </div>
      </div>`;
    this._updateProgres();
  },

  async _kirimTanya() {
    const inp = el("vac-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("vac-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const daftarKata = VocabAIFlow.words.length
        ? VocabAIFlow.words.map(w => `${w.hanzi}(${w.pinyin || "?"}=${w.arti})`).join("、")
        : "";
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan vocabulary lewat chat dengan AI.
Siswa bertanya hal DI LUAR latihan yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk latihan, jadi jangan anggap sebagai jawaban latihan.
${daftarKata ? `Konteks: siswa sedang berlatih kata-kata berikut: ${daftarKata}.` : ""}
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await SentenceVocab._callAI(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${VocabAIData.esc2(teks)}</b></div><div>💡 ${VocabAIData.esc2md(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  _updateProgres() {
    const p = VocabAIFlow.progres();
    const w = VocabAIFlow.kataSaatIni();
    let teks;
    if (p.fase === "matching") teks = `🧩 Mini-game: cocokkan semua kata dulu`;
    else if (p.fase === "final" || p.fase === "selesai") teks = `🏁 Tantangan akhir: kalimat gabungan ${VocabAIFlow.words.length} kata`;
    else teks = `Kata ${p.idx + 1} / ${p.total}: ${w ? w.hanzi + (w.pinyin ? " (" + w.pinyin + ")" : "") : ""}`;
    setTeks("vac-progres", teks);
  },

  async _giliran(fn) {
    VocabAIFlow.sedangProses = true;
    this._appendChat("ai", "⏳ Sedang mengetik...", "sv-chat-ai-loading");
    try {
      const parsed = await fn();
      this._updateLastAI(parsed);
      if (this._cfg.aiSuara && parsed.hanzi) TTS.mandarin(parsed.hanzi);
      this._updateProgres();
      if (parsed.selesai) {
        setHTML("vac-input-area", "");
        if (typeof App !== "undefined" && App.catatSesiSelesai) App.catatSesiSelesai("vocab", 1, 1);
        return;
      }
      VocabAIFlow.sedangProses = false;
      if (VocabAIFlow.subPhase === "matching") {
        VocabAIMatch.mulai("vac-input-area", VocabAIFlow.words, () => {
          this._giliran(() => VocabAIFlow.mulaiTantanganAkhir());
        });
        return;
      }
      this._renderInputArea();
      return;
    } catch (e) {
      this._updateLastAI({ hanzi: "", pinyin: "", indonesia: "", koreksi: "", _error: e.message });
    }
    VocabAIFlow.sedangProses = false;
    this._renderInputArea();
  },

  _bubbleAIHtml(parsed) {
    if (parsed._error) return `<span style="color:#c62828">❌ ${VocabAIData.esc2(parsed._error)}</span>`;
    const c = this._cfg.tampilAI;
    let info = "";
    if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${VocabAIData.esc2md(parsed.koreksi)}</div>`;
    if (c.has("hanzi") && parsed.hanzi) info += `<div>${parsed.hanzi} <button class="btn-audio-kecil" onclick="TTS.mandarin('${VocabAIData.esc(parsed.hanzi)}')">🔊</button></div>`;
    if (c.has("pinyin") && parsed.pinyin) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin}</div>`;
    if (c.has("indo")) info += `<div style="font-size:13px;color:#37474f;margin-top:2px">${VocabAIData.esc2md(parsed.indonesia || "")}</div>`;
    return `<span class="sv-chat-label">🤖 Tutor:</span> ${info}`;
  },

  _appendChat(role, teks, extraClass = "") {
    const area = el("vac-chat-area");
    if (!area) return;
    const div = document.createElement("div");
    div.className = `sv-chat-bubble sv-chat-${role} ${extraClass}`;
    div.innerHTML = role === "ai"
      ? `<span class="sv-chat-label">🤖 Tutor:</span> ${teks}`
      : `<span class="sv-chat-label">👤 Kamu:</span> ${VocabAIData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  _updateLastAI(parsed) {
    const area = el("vac-chat-area");
    if (!area) return;
    const loading = area.querySelector(".sv-chat-ai-loading");
    const html = this._bubbleAIHtml(parsed);
    if (loading) { loading.className = "sv-chat-bubble sv-chat-ai"; loading.innerHTML = html; }
    else this._appendChat("ai", html);
    area.scrollTop = area.scrollHeight;
  },

  _renderInputArea() {
    if (this._cfg.caraJawab === "ketik") {
      setHTML("vac-input-area", `
        <div class="sv-tanya-input-wrap" style="margin-top:8px">
          <input type="text" id="vac-input" placeholder="Ketik balasanmu..." onkeydown="if(event.key==='Enter')VocabAIChat._jawabTeks()">
          <button onclick="VocabAIChat._jawabTeks()">Kirim</button>
        </div>`);
      setTimeout(() => { const i = el("vac-input"); if (i) i.focus(); }, 100);
    } else {
      const label = VocabAIFlow.bahasaJawabanBerikutnya === "id" ? "🎤 Bicara (Indonesia)" : "🎤 Bicara (Mandarin)";
      setHTML("vac-input-area", `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-merah" id="vac-btn-mic" onclick="VocabAIChat._jawabSuara()">${label}</button>
        </div>`);
    }
  },

  async _jawabTeks() {
    if (VocabAIFlow.sedangProses) return;
    const inp = el("vac-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    inp.value = "";
    this._appendChat("user", teks);
    setHTML("vac-input-area", "");
    await this._giliran(() => VocabAIFlow.kirimJawaban(teks));
  },

  _jawabSuara() {
    if (VocabAIFlow.sedangProses) return;
    const btnMic = el("vac-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    STT.mulai(VocabAIFlow.bahasaSTT(),
      async (hasil) => {
        this._appendChat("user", hasil);
        setHTML("vac-input-area", "");
        await this._giliran(() => VocabAIFlow.kirimJawaban(hasil));
      },
      err => { tampilToast("❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } },
      dapat => { if (!dapat) { tampilToast("⚠️ Tidak terdeteksi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } } }
    );
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = VocabAIHub.renderMenu();
  },
};

// ================================================================
//  2) VOCABAICALL — Simulasi Telepon dengan AI
// ================================================================
var VocabAICall = {
  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin"]),  // teks yang ditampilkan di bawah gelembung AI (audio selalu aktif)
    jumlahKata: 5,
    koreksiRounds: 1,
  },

  renderMenu() {
    const c = this._cfg;
    const chip = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="VocabAICall._toggle('${key}')">${label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">📞</div>
          <div>
            <div class="sv-title">Telepon Vocab AI</div>
            <div class="sv-subtitle">AI "menelepon" & melatih 5 kata secara langsung</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔢 Jumlah Kata: <b id="vap-jumlah-label">${c.jumlahKata}</b></div>
          <input type="range" min="3" max="8" value="${c.jumlahKata}" oninput="VocabAICall._setJumlah(this.value)" style="width:100%;accent-color:#1565c0">
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info yang ditampilkan saat AI "bicara" (audio selalu aktif):</div>
          <div class="sv-chips" id="vap-chips">
            ${chip("hanzi", "🈯 Hanzi")}
            ${chip("pinyin", "🔤 Pinyin")}
            ${chip("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">🔁 Tes Tiap Kata</div>
          <div class="sv-chips" id="vap-koreksi-chips">
            <button class="sv-chip ${c.koreksiRounds === 1 ? "aktif" : ""}" onclick="VocabAICall._setKoreksi(1)">➡️ Langsung Lanjut</button>
            <button class="sv-chip ${c.koreksiRounds === 2 ? "aktif" : ""}" onclick="VocabAICall._setKoreksi(2)">🔁 Ulang s/d 2x</button>
            <button class="sv-chip ${c.koreksiRounds === 3 ? "aktif" : ""}" onclick="VocabAICall._setKoreksi(3)">🔁 Ulang s/d 3x</button>
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <input type="password" id="vap-api-key-input" placeholder="Masukkan Gemini API key..." value="${SentenceVocab._getApiKey()}"
            style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
            oninput="SentenceVocab._setApiKey(this.value)">
          <div style="font-size:11px;color:#888;margin-top:5px">Key sama dipakai di semua fitur AI (tersimpan di browser saja).</div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="VocabAICall.mulai()">📞 Mulai Panggilan</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="VocabAICall.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggle(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("vap-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi", "pinyin", "indo"][i])));
  },
  _setJumlah(v) {
    this._cfg.jumlahKata = parseInt(v);
    const lbl = el("vap-jumlah-label"); if (lbl) lbl.textContent = v;
  },
  _setKoreksi(v) {
    this._cfg.koreksiRounds = v;
    const wrap = el("vap-koreksi-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", [1, 2, 3][i] === v));
  },

  async mulai() {
    if (!SentenceVocab._getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">📞 Menyiapkan panggilan...</div>
      </div>`;
    const words = await VocabAIData.ambilKata(this._cfg.jumlahKata);
    if (!words.length) { tampilToast("⚠️ Tidak ada data vocab untuk dipakai."); this.kembaliMenu(); return; }
    VocabAIFlow.reset(words, this._cfg.koreksiRounds);
    this._renderCallUI();
    await this._giliran(() => VocabAIFlow.mulai());
  },

  _renderCallUI() {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">📞 Panggilan Latihan Vocab</div>
        <div id="vap-progres" style="text-align:center;color:#37474f;font-size:12px;font-weight:600;margin-bottom:2px"></div>
        <div id="vap-status" style="text-align:center;color:#546e7a;font-size:13px;margin-bottom:8px">Menyambungkan...</div>
        <div id="vap-transcript" class="sv-chat-area" style="max-height:280px"></div>
        <div id="vap-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar panggilan, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="vap-tanya-input" placeholder="Misal: apa arti 认真?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')VocabAICall._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="VocabAICall._kirimTanya()">Tanya</button>
          </div>
          <div id="vap-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-merah" onclick="VocabAICall._tutupTelepon()">📵 Tutup Telepon</button>
        </div>
      </div>`;
    this._updateProgres();
  },

  async _kirimTanya() {
    const inp = el("vap-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("vap-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const daftarKata = VocabAIFlow.words.length
        ? VocabAIFlow.words.map(w => `${w.hanzi}(${w.pinyin || "?"}=${w.arti})`).join("、")
        : "";
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan vocabulary lewat simulasi telepon dengan AI.
Siswa bertanya hal DI LUAR panggilan yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk panggilan, jadi jangan anggap sebagai jawaban latihan.
${daftarKata ? `Konteks: siswa sedang berlatih kata-kata berikut: ${daftarKata}.` : ""}
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await SentenceVocab._callAI(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${VocabAIData.esc2(teks)}</b></div><div>💡 ${VocabAIData.esc2md(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  _updateProgres() {
    const p = VocabAIFlow.progres();
    const w = VocabAIFlow.kataSaatIni();
    let teks;
    if (p.fase === "matching") teks = `🧩 Mini-game: cocokkan semua kata dulu`;
    else if (p.fase === "final" || p.fase === "selesai") teks = `🏁 Tantangan akhir: kalimat gabungan ${VocabAIFlow.words.length} kata`;
    else teks = `Kata ${p.idx + 1} / ${p.total}: ${w ? w.hanzi + (w.pinyin ? " (" + w.pinyin + ")" : "") : ""}`;
    setTeks("vap-progres", teks);
  },

  _tampilStatus(teks) { setTeks("vap-status", teks); },

  async _giliran(fn) {
    VocabAIFlow.sedangProses = true;
    this._tampilStatus("📞 Tutor sedang bicara...");
    try {
      const parsed = await fn();
      this._tampilGiliranAI(parsed);
      this._updateProgres();
    } catch (e) {
      this._tampilStatus("❌ " + e.message);
      VocabAIFlow.sedangProses = false;
      this._renderInputArea();
    }
  },

  _tampilGiliranAI(parsed) {
    const c = this._cfg.tampilAI;
    const area = el("vap-transcript");
    if (area) {
      const div = document.createElement("div");
      div.className = "sv-chat-bubble sv-chat-ai";
      let info = "";
      if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${VocabAIData.esc2md(parsed.koreksi)}</div>`;
      if (c.has("hanzi") && parsed.hanzi) info += `<div>${parsed.hanzi}</div>`;
      if (c.has("pinyin") && parsed.pinyin) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin}</div>`;
      if (c.has("indo")) info += `<div style="font-size:12px;color:#546e7a">${VocabAIData.esc2md(parsed.indonesia || "")}</div>`;
      div.innerHTML = `<span class="sv-chat-label">🤖 Tutor:</span> ${info}`;
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
    }

    const lanjut = () => {
      VocabAIFlow.sedangProses = false;
      if (parsed.selesai) {
        if (typeof App !== "undefined" && App.catatSesiSelesai) App.catatSesiSelesai("vocab", 1, 1);
        setTimeout(() => this._tampilSelesai(), 800);
        return;
      }
      if (VocabAIFlow.subPhase === "matching") {
        this._tampilStatus("🧩 Ayo main mini-game dulu");
        VocabAIMatch.mulai("vap-input-area", VocabAIFlow.words, () => {
          this._giliran(() => VocabAIFlow.mulaiTantanganAkhir());
        });
        return;
      }
      this._tampilStatus("🎤 Giliranmu menjawab");
      this._renderInputArea();
    };

    if (parsed.hanzi) TTS.mandarin(parsed.hanzi, lanjut);
    else if (parsed.indonesia) TTS.indo(parsed.indonesia.replace(/[*`]/g, ""), lanjut);
    else setTimeout(lanjut, 300);
  },

  _renderInputArea() {
    const label = VocabAIFlow.bahasaJawabanBerikutnya === "id" ? "🎤 Bicara (Indonesia)" : "🎤 Bicara (Mandarin)";
    setHTML("vap-input-area", `
      <textarea id="vap-input" class="input-jawab" rows="2" placeholder="Ketik jawabanmu, atau pakai mic..."></textarea>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-hijau" onclick="VocabAICall._jawabTeks()">✅ Kirim</button>
        <button class="btn btn-merah" id="vap-btn-mic" onclick="VocabAICall._jawabSuara()">${label}</button>
      </div>`);
  },

  _tambahUserBubble(teks) {
    const area = el("vap-transcript");
    if (!area) return;
    const div = document.createElement("div");
    div.className = "sv-chat-bubble sv-chat-user";
    div.innerHTML = `<span class="sv-chat-label">👤 Kamu:</span> ${VocabAIData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  async _jawabTeks() {
    const inp = el("vap-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks || VocabAIFlow.sedangProses) return;
    this._tambahUserBubble(teks);
    setHTML("vap-input-area", "");
    await this._giliran(() => VocabAIFlow.kirimJawaban(teks));
  },

  _jawabSuara() {
    const btnMic = el("vap-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    this._tampilStatus("🎙️ Silakan bicara...");
    STT.mulai(VocabAIFlow.bahasaSTT(),
      async (hasil) => {
        this._tambahUserBubble(hasil);
        setHTML("vap-input-area", "");
        await this._giliran(() => VocabAIFlow.kirimJawaban(hasil));
      },
      err => { this._tampilStatus("❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } },
      dapat => { if (!dapat) { this._tampilStatus("⚠️ Tidak terdeteksi, coba lagi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } } }
    );
  },

  _tutupTelepon() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    this._tampilSelesai();
  },

  _tampilSelesai() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    const jumlahKata = VocabAIFlow.words.length;
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">📴</div>
        <h2>Panggilan Selesai</h2>
        <div style="font-size:13px;color:#546e7a;margin:10px 0">Kamu baru saja berlatih ${jumlahKata} kata vocab lewat simulasi telepon ini.</div>
        <div class="btn-row" style="justify-content:center;margin-top:20px">
          <button class="btn btn-hijau" onclick="VocabAICall.mulai()">🔄 Telepon Lagi</button>
          <button class="btn btn-biru" onclick="VocabAICall.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = VocabAIHub.renderMenu();
  },
};

// ================================================================
//  3) VOCABAIMATCH — Mini-Game "Klik-Sambung" (Hanzi ↔ Pinyin,
//     lalu Hanzi ↔ Arti) sebelum tantangan kalimat gabungan
// ================================================================
var VocabAIMatch = {
  _containerId: null,
  _onDone: null,
  _words: [],
  _stage: "hp",       // "hp" = Hanzi-Pinyin, "ha" = Hanzi-Arti
  _left: [],          // urutan tetap: indeks kata di kolom kiri (Hanzi)
  _right: [],         // urutan acak: indeks kata di kolom kanan
  _matched: null,     // Set indeks kata yang sudah tersambung benar di stage ini
  _selL: null,
  _selR: null,
  _salahL: null,
  _salahR: null,
  _kunci: false,      // kunci klik sementara saat menampilkan feedback salah

  mulai(containerId, words, onDone) {
    this._containerId = containerId;
    this._words = words;
    this._onDone = onDone;
    this._stage = "hp";
    this._mulaiStage();
  },

  _mulaiStage() {
    this._matched = new Set();
    this._selL = null; this._selR = null;
    this._salahL = null; this._salahR = null;
    this._kunci = false;
    this._left = this._words.map((w, i) => i);
    this._right = acak(this._words.map((w, i) => i));
    this._render();
  },

  _labelKanan(i) {
    const w = this._words[i];
    return this._stage === "hp" ? (w.pinyin || "?") : w.arti;
  },

  _render() {
    const judul = this._stage === "hp" ? "🔤 Cocokkan Hanzi ↔ Pinyin" : "🈯 Cocokkan Hanzi ↔ Arti";
    const btn = (sisi, i) => {
      const done = this._matched.has(i);
      const salah = (sisi === "L" && this._salahL === i) || (sisi === "R" && this._salahR === i);
      const aktif = (sisi === "L" && this._selL === i) || (sisi === "R" && this._selR === i);
      const kelas = `sv-match-btn ${done ? "sv-match-done" : ""} ${salah ? "sv-match-salah" : ""} ${aktif && !salah ? "sv-match-aktif" : ""}`;
      const teks = sisi === "L" ? this._words[i].hanzi : this._labelKanan(i);
      return `<button class="${kelas}" ${done ? "disabled" : ""} onclick="VocabAIMatch._pilih('${sisi}',${i})">${teks}</button>`;
    };
    const kiri  = this._left.map(i => btn("L", i)).join("");
    const kanan = this._right.map(i => btn("R", i)).join("");
    const html = `
      <div class="sv-match-wrap">
        <div class="sv-match-title">${judul}</div>
        <div class="sv-match-sub">Klik Hanzi, lalu klik pasangannya di kolom kanan.</div>
        <div class="sv-match-grid">
          <div class="sv-match-col">${kiri}</div>
          <div class="sv-match-col">${kanan}</div>
        </div>
        <div class="sv-match-progress">${this._matched.size} / ${this._words.length} tersambung ${this._stage === "hp" ? "(tahap 1/2: Pinyin)" : "(tahap 2/2: Arti)"}</div>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="VocabAIMatch._lewati()">⏭ Lewati Mini-Game</button>
      </div>`;
    setHTML(this._containerId, html);
  },

  _pilih(sisi, i) {
    if (this._kunci || this._matched.has(i)) return;
    if (sisi === "L") this._selL = (this._selL === i) ? null : i;
    else this._selR = (this._selR === i) ? null : i;

    if (this._selL === null || this._selR === null) { this._render(); return; }

    if (this._selL === this._selR) {
      // Cocok!
      this._matched.add(this._selL);
      this._selL = null; this._selR = null;
      this._render();
      if (this._matched.size === this._words.length) {
        this._kunci = true;
        setTimeout(() => {
          if (this._stage === "hp") { this._stage = "ha"; this._mulaiStage(); }
          else if (this._onDone) this._onDone();
        }, 600);
      }
    } else {
      // Salah — tampilkan merah sebentar lalu reset
      this._kunci = true;
      this._salahL = this._selL; this._salahR = this._selR;
      this._render();
      setTimeout(() => {
        this._selL = null; this._selR = null;
        this._salahL = null; this._salahR = null;
        this._kunci = false;
        this._render();
      }, 600);
    }
  },

  _lewati() {
    if (this._onDone) this._onDone();
  },
};

// ── CSS mini-game (disuntik sekali, dipakai VocabAIMatch) ──────
(function _injectMatchCSS() {
  if (document.getElementById("vam-styles")) return;
  const style = document.createElement("style");
  style.id = "vam-styles";
  style.textContent = `
    .sv-match-wrap { padding:6px 0; }
    .sv-match-title { font-size:14px; font-weight:700; color:#1565c0; text-align:center; margin-bottom:4px; }
    .sv-match-sub { font-size:12px; color:#78909c; text-align:center; margin-bottom:10px; }
    .sv-match-grid { display:flex; gap:10px; }
    .sv-match-col { flex:1; display:flex; flex-direction:column; gap:8px; }
    .sv-match-btn {
      padding:10px 8px; border-radius:8px; font-size:15px; font-weight:600;
      border:1.5px solid #b0bec5; background:#fff; color:#37474f; cursor:pointer;
      transition:all .15s; width:100%; text-align:center;
    }
    .sv-match-btn:hover:not(:disabled) { border-color:#1565c0; background:#e3f2fd; }
    .sv-match-btn.sv-match-aktif { border-color:#1565c0; background:#e3f2fd; color:#1565c0; }
    .sv-match-btn.sv-match-done { border-color:#43a047; background:#e8f5e9; color:#2e7d32; opacity:.75; cursor:default; }
    .sv-match-btn.sv-match-salah { border-color:#e53935; background:#ffebee; color:#c62828; }
    .sv-match-btn:disabled { cursor:default; }
    .sv-match-progress { text-align:center; font-size:12px; color:#546e7a; margin-top:8px; font-weight:600; }
  `;
  document.head.appendChild(style);
})();

// ================================================================
//  4) VOCABAIFREEFLOW — Engine obrolan BEBAS, kosakata dibatasi
//     hanya dari daftar HSK yang dipilih (bukan 5 kata acak)
// ================================================================
var VocabAIFreeFlow = {
  words: [],
  topik: "",
  history: [],
  sedangProses: false,
  bahasaJawabanBerikutnya: "zh",
  modeKetat: false,        // false = longgar (instruksi saja, tidak 100% dijamin), true = ketat (divalidasi ulang)
  MAKS_KATA_PROMPT: 220,   // batasi jumlah kata yang dikirim ke system prompt (hemat token)
  MAKS_PERCOBAAN_ULANG: 2, // maksimal berapa kali minta AI menulis ulang kalau mode ketat & masih melanggar
  _karakterAllowed: null,  // cache Set karakter Hanzi yang diizinkan (kata dari data + partikel dasar)

  reset(words, topik, modeKetat) {
    this.words = words;
    this.topik = (topik || "").trim();
    this.history = [];
    this.sedangProses = false;
    this.bahasaJawabanBerikutnya = "zh";
    this.modeKetat = !!modeKetat;
    this._karakterAllowed = null;
  },

  bahasaSTT() {
    return this.bahasaJawabanBerikutnya === "id" ? "id-ID" : "zh-CN";
  },

  // Set karakter Hanzi yang boleh dipakai: semua karakter dari kata-kata di daftar,
  // ditambah partikel/kata ganti/kata bantu tata bahasa paling dasar.
  _daftarKarakterDiizinkan() {
    if (this._karakterAllowed) return this._karakterAllowed;
    const set = new Set();
    for (const w of this.words) {
      for (const ch of (w.hanzi || "")) {
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) set.add(ch);
      }
    }
    const dasar = "我你他她它们的了吗呢不也在和很这那有是就都还没别再来去吧啊哦嗯请谢对错太更最与或但如果因为所以虽然而已经正给跟被把让向从对于什么谁哪儿怎么样几多少个和着过又才刚";
    for (const ch of dasar) set.add(ch);
    this._karakterAllowed = set;
    return set;
  },

  // Cek karakter Hanzi di luar daftar yang diizinkan (mengabaikan tanda baca/non-hanzi)
  _cekPelanggaran(hanzi) {
    const allowed = this._daftarKarakterDiizinkan();
    const asing = [];
    for (const ch of (hanzi || "")) {
      if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) continue;
      if (!allowed.has(ch) && !asing.includes(ch)) asing.push(ch);
    }
    return asing;
  },

  _daftarKataTeks() {
    const dipakai = this.words.slice(0, this.MAKS_KATA_PROMPT);
    const teks = dipakai.map(w => `${w.hanzi}(${w.pinyin || "?"}=${w.arti})`).join("、");
    return this.words.length > dipakai.length
      ? `${teks}, dan ${this.words.length - dipakai.length} kata lain dari level yang sama`
      : teks;
  },

  _systemPrompt() {
    const topikTeks = this.topik
      ? `Topik obrolan yang diminta siswa: "${this.topik}". Usahakan obrolan tetap mengarah ke topik ini semampu mungkin selama kosakata yang tersedia mencukupi.`
      : `Tidak ada topik khusus — obrol bebas & natural (perkenalan, kegiatan sehari-hari, hobi, keluarga, dsb), mengalir seperti telepon dengan teman.`;
    return `Kamu adalah partner ngobrol dalam simulasi TELEPON berbahasa Mandarin untuk siswa yang sedang belajar Bahasa Mandarin.
${topikTeks}

ATURAN PALING PENTING — BATASAN KOSAKATA (${this.modeKetat ? "MODE KETAT — akan divalidasi ulang, WAJIB dipatuhi persis" : "usahakan sepatuhnya mungkin"}):
Kamu HANYA boleh memakai kata-kata isi (kata benda/kerja/sifat/keterangan) dari daftar kosakata berikut. JANGAN memakai kosakata Mandarin lain di luar daftar ini, KECUALI kata ganti/partikel/kata bantu tata bahasa paling dasar yang tidak terhindarkan (misalnya: 我、你、他、她、是、的、了、吗、呢、不、也、在、和、很、这、那、有):
${this._daftarKataTeks()}

Aturan lain:
- Ngobrol natural & santai, satu giliranmu = satu balasan pendek (1-3 kalimat Mandarin sederhana), jangan ceramah panjang.
- Jika siswa memakai kata di luar daftar, salah tata bahasa, atau salah ucap, beri koreksi SINGKAT & ramah di field "koreksi" (Bahasa Indonesia), lalu tetap lanjutkan obrolan secara natural di field "hanzi"/"indonesia".
- Field "hanzi" WAJIB diisi ucapanmu dalam Mandarin (karena ini simulasi telepon, akan diperdengarkan lewat audio). Field "pinyin" diisi pinyin bertanda nada dari kalimat itu.
- Field "indonesia" diisi terjemahan lengkap ucapanmu.
- Field "bahasaJawaban": isi "zh" jika kamu mengharapkan siswa membalas dalam Bahasa Mandarin (ini kondisi NORMAL/DEFAULT di obrolan bebas ini), atau "id" HANYA jika kamu secara eksplisit bertanya sesuatu yang jawabannya wajar dalam Bahasa Indonesia (misalnya menanyakan apakah siswa paham arti suatu kata).
- Field "selesai": HANYA true jika siswa jelas ingin mengakhiri percakapan (berpamitan, misalnya bilang 再见/harus pergi/dadah). Selain itu selalu false.

Balas HANYA dengan JSON valid (tanpa markdown/komentar):
{
  "hanzi": "ucapanmu dalam Mandarin",
  "pinyin": "pinyin bertanda nada",
  "indonesia": "terjemahan Bahasa Indonesia",
  "koreksi": "koreksi singkat, atau string kosong jika tidak ada yang perlu dikoreksi",
  "selesai": false,
  "bahasaJawaban": "zh"
}`;
  },

  async _call(instruksi, _percobaan = 0, _catatanUlang = "") {
    const messages = [{ role: "user", content: this._systemPrompt() }];
    for (const h of this.history) messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
    messages.push({ role: "user", content: _catatanUlang ? `${instruksi}\n\n${_catatanUlang}` : instruksi });

    const raw = await SentenceVocab._callAI(messages, 400);
    let parsed;
    try {
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
      if (!parsed) throw new Error("Gagal memproses balasan AI. Coba lagi.");
    }

    if (this.modeKetat && parsed.hanzi) {
      const asing = this._cekPelanggaran(parsed.hanzi);
      if (asing.length && _percobaan < this.MAKS_PERCOBAAN_ULANG) {
        const catatan = `PENTING — VALIDASI KOSAKATA GAGAL: jawabanmu barusan ("${parsed.hanzi}") memakai karakter di luar daftar kosakata yang diizinkan: ${asing.join("、")}.
Tulis ULANG jawaban untuk instruksi di atas dengan maksud yang sama, tapi HANYA memakai karakter dari daftar kosakata yang diizinkan ditambah partikel dasar yang disebutkan. Kalau perlu, buat kalimat lebih sederhana. Balas HANYA dengan format JSON yang sama.`;
        return this._call(instruksi, _percobaan + 1, catatan);
      }
      // Simpan sisa pelanggaran (kosong jika sudah bersih) untuk ditampilkan sebagai transparansi ke siswa
      parsed._pelanggaranSisa = asing;
    }

    this.history.push({ role: "model", text: JSON.stringify(parsed) });
    this.bahasaJawabanBerikutnya = parsed.bahasaJawaban === "id" ? "id" : "zh";
    return parsed;
  },

  async mulai() {
    const instruksi = this.topik
      ? `Ini giliran PALING PERTAMA menelepon. Buka percakapan dengan sapaan hangat & langsung mulai bahas topik "${this.topik}" pakai kosakata yang tersedia, lalu ajukan satu pertanyaan pembuka ke siswa. Set "koreksi": "" dan "selesai": false.`
      : `Ini giliran PALING PERTAMA menelepon. Buka percakapan dengan sapaan hangat & satu pertanyaan pembuka ringan (misalnya kabar/kegiatan hari ini) pakai kosakata yang tersedia. Set "koreksi": "" dan "selesai": false.`;
    return this._call(instruksi);
  },

  async kirimJawaban(teks) {
    this.history.push({ role: "user", text: teks });
    const instruksi = `Balasan siswa barusan: "${teks}"
Tanggapi secara natural sebagai lanjutan obrolan telepon (beri koreksi singkat jika perlu di field "koreksi"), lalu lanjutkan obrolan (boleh komentar, boleh tanya balik) tetap dalam batasan kosakata yang diberikan di instruksi awal.`;
    return this._call(instruksi);
  },
};

// ================================================================
//  5) VOCABAIFREECALL — UI "Telepon Bebas (HSK)"
// ================================================================
var VocabAIFreeCall = {
  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin", "indo"]),
    hskSet: new Set(["hsk1-2"]),
    pakaiTopik: false,
    topikTeks: "",
    modeKetat: false,   // false = longgar (instruksi saja, tidak 100% dijamin) | true = ketat (divalidasi & ditulis ulang otomatis)
  },

  renderMenu() {
    const c = this._cfg;
    const chipTampil = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="VocabAIFreeCall._toggleTampil('${key}')">${label}</button>`;
    const chipHSK = (s) => `
      <button class="sv-chip ${c.hskSet.has(s.id) ? "aktif" : ""}" onclick="VocabAIFreeCall._toggleHSK('${s.id}')">${s.label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">🗣️</div>
          <div>
            <div class="sv-title">Telepon Bebas (HSK)</div>
            <div class="sv-subtitle">Ngobrol bebas — AI hanya pakai kosakata level HSK yang kamu pilih</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">📚 Sumber Kosakata (boleh pilih lebih dari satu):</div>
          <div class="sv-chips" id="vfc-hsk-chips">
            ${SHEET_VOCAB.map(chipHSK).join("")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info pesan AI yang ditampilkan:</div>
          <div class="sv-chips" id="vfc-chips">
            ${chipTampil("hanzi", "🈯 Hanzi")}
            ${chipTampil("pinyin", "🔤 Pinyin")}
            ${chipTampil("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">💡 Topik Percakapan (opsional)</div>
          <div class="sv-chips" id="vfc-topik-chips">
            <button class="sv-chip ${!c.pakaiTopik ? "aktif" : ""}" onclick="VocabAIFreeCall._setPakaiTopik(false)">🎲 Bebas (tanpa topik)</button>
            <button class="sv-chip ${c.pakaiTopik ? "aktif" : ""}" onclick="VocabAIFreeCall._setPakaiTopik(true)">✍️ Tentukan Topik</button>
          </div>
          <div id="vfc-topik-input-wrap" style="margin-top:8px;display:${c.pakaiTopik ? "block" : "none"}">
            <input type="text" id="vfc-topik-input" placeholder="Misal: liburan, keluarga, hobi..." value="${VocabAIData.esc2(c.topikTeks)}"
              style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ce93d8;border-radius:6px;font-size:13px;outline:none"
              oninput="VocabAIFreeCall._setTopikTeks(this.value)">
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#e8f5e9;border-radius:8px;border-left:3px solid #43a047">
          <div style="font-size:13px;color:#2e7d32;font-weight:600;margin-bottom:8px">🔒 Kepatuhan Kosakata</div>
          <div class="sv-chips" id="vfc-ketat-chips">
            <button class="sv-chip ${!c.modeKetat ? "aktif" : ""}" onclick="VocabAIFreeCall._setModeKetat(false)">🔓 Longgar (instruksi saja)</button>
            <button class="sv-chip ${c.modeKetat ? "aktif" : ""}" onclick="VocabAIFreeCall._setModeKetat(true)">🔒 Ketat (divalidasi ulang)</button>
          </div>
          <div style="font-size:11px;color:#558b2f;margin-top:6px" id="vfc-ketat-desc">
            ${c.modeKetat
              ? "AI dicek tiap giliran: kalau ada karakter di luar daftar kosakata, otomatis diminta menulis ulang (maks 2x) sampai patuh."
              : "AI hanya diberi instruksi untuk patuh pada daftar kosakata — cepat & hemat kuota, tapi TIDAK 100% dijamin selalu patuh."}
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <input type="password" id="vfc-api-key-input" placeholder="Masukkan Gemini API key..." value="${SentenceVocab._getApiKey()}"
            style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
            oninput="SentenceVocab._setApiKey(this.value)">
          <div style="font-size:11px;color:#888;margin-top:5px">Key sama dipakai di semua fitur AI (tersimpan di browser saja).</div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="VocabAIFreeCall.mulai()">📞 Mulai Panggilan Bebas</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="VocabAIFreeCall.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggleTampil(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("vfc-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi", "pinyin", "indo"][i])));
  },
  _toggleHSK(id) {
    const s = this._cfg.hskSet;
    if (s.has(id)) { if (s.size === 1) { tampilToast("Pilih minimal 1 sumber kosakata!"); return; } s.delete(id); }
    else s.add(id);
    const wrap = el("vfc-hsk-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(SHEET_VOCAB[i].id)));
  },
  _setPakaiTopik(v) {
    this._cfg.pakaiTopik = v;
    const wrap = el("vfc-topik-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", (i === 1) === v));
    const inWrap = el("vfc-topik-input-wrap");
    if (inWrap) inWrap.style.display = v ? "block" : "none";
  },
  _setTopikTeks(v) { this._cfg.topikTeks = v; },
  _setModeKetat(v) {
    this._cfg.modeKetat = v;
    const wrap = el("vfc-ketat-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", (i === 1) === v));
    setHTML("vfc-ketat-desc", v
      ? "AI dicek tiap giliran: kalau ada karakter di luar daftar kosakata, otomatis diminta menulis ulang (maks 2x) sampai patuh."
      : "AI hanya diberi instruksi untuk patuh pada daftar kosakata — cepat & hemat kuota, tapi TIDAK 100% dijamin selalu patuh.");
  },

  async mulai() {
    if (!SentenceVocab._getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    if (!this._cfg.hskSet.size) { tampilToast("⚠️ Pilih minimal 1 sumber kosakata HSK!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">📚 Mengambil kosakata ${[...this._cfg.hskSet].join(", ")}...</div>
      </div>`;
    const words = await VocabAIData.ambilKataDariHSK([...this._cfg.hskSet]);
    if (!words.length) { tampilToast("⚠️ Gagal mengambil data kosakata untuk sumber yang dipilih."); this.kembaliMenu(); return; }
    const topik = this._cfg.pakaiTopik ? this._cfg.topikTeks.trim() : "";
    VocabAIFreeFlow.reset(words, topik, this._cfg.modeKetat);
    this._renderCallUI(words.length);
    await this._giliran(() => VocabAIFreeFlow.mulai());
  },

  _renderCallUI(jumlahKata) {
    const topik = VocabAIFreeFlow.topik;
    const ketatBadge = VocabAIFreeFlow.modeKetat
      ? `<span style="color:#2e7d32;font-weight:600">🔒 Ketat</span>`
      : `<span style="color:#e65100;font-weight:600">🔓 Longgar</span>`;
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🗣️ Telepon Bebas (HSK)</div>
        <div style="text-align:center;color:#546e7a;font-size:12px;margin-bottom:6px">
          📚 ${jumlahKata} kata dari ${[...this._cfg.hskSet].join(", ")} · ${ketatBadge}${topik ? ` · 💡 Topik: ${VocabAIData.esc2(topik)}` : " · 🎲 Bebas"}
        </div>
        <div id="vfc-status" style="text-align:center;color:#546e7a;font-size:13px;margin-bottom:8px">Menyambungkan...</div>
        <div id="vfc-transcript" class="sv-chat-area" style="max-height:280px"></div>
        <div id="vfc-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar obrolan, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="vfc-tanya-input" placeholder="Misal: apa arti 认真?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')VocabAIFreeCall._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="VocabAIFreeCall._kirimTanya()">Tanya</button>
          </div>
          <div id="vfc-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-merah" onclick="VocabAIFreeCall._tutupTelepon()">📵 Tutup Telepon</button>
        </div>
      </div>`;
  },

  _tampilStatus(teks) { setTeks("vfc-status", teks); },

  async _giliran(fn) {
    VocabAIFreeFlow.sedangProses = true;
    this._tampilStatus("📞 Partner sedang bicara...");
    try {
      const parsed = await fn();
      this._tampilGiliranAI(parsed);
    } catch (e) {
      this._tampilStatus("❌ " + e.message);
      VocabAIFreeFlow.sedangProses = false;
      this._renderInputArea();
    }
  },

  _tampilGiliranAI(parsed) {
    const c = this._cfg.tampilAI;
    const area = el("vfc-transcript");
    if (area) {
      const div = document.createElement("div");
      div.className = "sv-chat-bubble sv-chat-ai";
      let info = "";
      if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${VocabAIData.esc2md(parsed.koreksi)}</div>`;
      if (c.has("hanzi") && parsed.hanzi) info += `<div>${parsed.hanzi}</div>`;
      if (c.has("pinyin") && parsed.pinyin) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin}</div>`;
      if (c.has("indo")) info += `<div style="font-size:12px;color:#546e7a">${VocabAIData.esc2md(parsed.indonesia || "")}</div>`;
      if (VocabAIFreeFlow.modeKetat && parsed._pelanggaranSisa && parsed._pelanggaranSisa.length) {
        info += `<div style="font-size:11px;color:#c62828;margin-top:2px">⚠️ Masih ada di luar daftar meski sudah divalidasi 2x: ${parsed._pelanggaranSisa.join("、")}</div>`;
      }
      div.innerHTML = `<span class="sv-chat-label">🤖 Partner:</span> ${info}`;
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
    }

    const lanjut = () => {
      VocabAIFreeFlow.sedangProses = false;
      if (parsed.selesai) {
        if (typeof App !== "undefined" && App.catatSesiSelesai) App.catatSesiSelesai("vocab", 1, 1);
        setTimeout(() => this._tampilSelesai(), 800);
        return;
      }
      this._tampilStatus("🎤 Giliranmu menjawab");
      this._renderInputArea();
    };

    if (parsed.hanzi) TTS.mandarin(parsed.hanzi, lanjut);
    else if (parsed.indonesia) TTS.indo(parsed.indonesia.replace(/[*`]/g, ""), lanjut);
    else setTimeout(lanjut, 300);
  },

  _renderInputArea() {
    const label = VocabAIFreeFlow.bahasaJawabanBerikutnya === "id" ? "🎤 Bicara (Indonesia)" : "🎤 Bicara (Mandarin)";
    setHTML("vfc-input-area", `
      <textarea id="vfc-input" class="input-jawab" rows="2" placeholder="Ketik jawabanmu, atau pakai mic..."></textarea>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-hijau" onclick="VocabAIFreeCall._jawabTeks()">✅ Kirim</button>
        <button class="btn btn-merah" id="vfc-btn-mic" onclick="VocabAIFreeCall._jawabSuara()">${label}</button>
      </div>`);
  },

  _tambahUserBubble(teks) {
    const area = el("vfc-transcript");
    if (!area) return;
    const div = document.createElement("div");
    div.className = "sv-chat-bubble sv-chat-user";
    div.innerHTML = `<span class="sv-chat-label">👤 Kamu:</span> ${VocabAIData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  async _jawabTeks() {
    const inp = el("vfc-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks || VocabAIFreeFlow.sedangProses) return;
    this._tambahUserBubble(teks);
    setHTML("vfc-input-area", "");
    await this._giliran(() => VocabAIFreeFlow.kirimJawaban(teks));
  },

  _jawabSuara() {
    const btnMic = el("vfc-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    this._tampilStatus("🎙️ Silakan bicara...");
    STT.mulai(VocabAIFreeFlow.bahasaSTT(),
      async (hasil) => {
        this._tambahUserBubble(hasil);
        setHTML("vfc-input-area", "");
        await this._giliran(() => VocabAIFreeFlow.kirimJawaban(hasil));
      },
      err => { this._tampilStatus("❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } },
      dapat => { if (!dapat) { this._tampilStatus("⚠️ Tidak terdeteksi, coba lagi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } } }
    );
  },

  _tutupTelepon() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    this._tampilSelesai();
  },

  async _kirimTanya() {
    const inp = el("vfc-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("vfc-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan ngobrol bebas lewat simulasi telepon dengan AI.
Siswa bertanya hal DI LUAR obrolan yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk obrolan, jadi jangan anggap sebagai jawaban.
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await SentenceVocab._callAI(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${VocabAIData.esc2(teks)}</b></div><div>💡 ${VocabAIData.esc2md(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  _tampilSelesai() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    const jumlahKata = VocabAIFreeFlow.words.length;
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">📴</div>
        <h2>Panggilan Selesai</h2>
        <div style="font-size:13px;color:#546e7a;margin:10px 0">Kamu baru saja ngobrol bebas pakai kosakata dari ${jumlahKata} kata yang tersedia.</div>
        <div class="btn-row" style="justify-content:center;margin-top:20px">
          <button class="btn btn-hijau" onclick="VocabAIFreeCall.mulai()">🔄 Telepon Lagi</button>
          <button class="btn btn-biru" onclick="VocabAIFreeCall.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = VocabAIHub.renderMenu();
  },
};

// ================================================================
//  6) VOCABAIFREECHAT — UI "Chat Bebas (HSK)"
//     Sama seperti Telepon Bebas (pakai VocabAIFreeFlow yang sama),
//     tapi tampilan chat teks + bisa pilih jawab via ketik ATAU suara.
// ================================================================
var VocabAIFreeChat = {
  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin", "indo"]),
    hskSet: new Set(["hsk1-2"]),
    pakaiTopik: false,
    topikTeks: "",
    modeKetat: false,
    aiSuara: true,           // pesan AI dibacakan suara juga?
    caraJawab: "ketik",      // "ketik" | "suara" — cara SISWA menjawab
  },

  renderMenu() {
    const c = this._cfg;
    const chipTampil = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="VocabAIFreeChat._toggleTampil('${key}')">${label}</button>`;
    const chipHSK = (s) => `
      <button class="sv-chip ${c.hskSet.has(s.id) ? "aktif" : ""}" onclick="VocabAIFreeChat._toggleHSK('${s.id}')">${s.label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">🗨️</div>
          <div>
            <div class="sv-title">Chat Bebas (HSK)</div>
            <div class="sv-subtitle">Ngobrol bebas teks/suara — AI hanya pakai kosakata level HSK yang kamu pilih</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">📚 Sumber Kosakata (boleh pilih lebih dari satu):</div>
          <div class="sv-chips" id="vfh-hsk-chips">
            ${SHEET_VOCAB.map(chipHSK).join("")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info pesan AI yang ditampilkan:</div>
          <div class="sv-chips" id="vfh-chips">
            ${chipTampil("hanzi", "🈯 Hanzi")}
            ${chipTampil("pinyin", "🔤 Pinyin")}
            ${chipTampil("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔊 Pesan AI pakai suara juga?</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.aiSuara ? "aktif" : ""}" id="vfh-suara-ya" onclick="VocabAIFreeChat._setSuara(true)">🔊 Ya</button>
            <button class="sv-chip ${!c.aiSuara ? "aktif" : ""}" id="vfh-suara-tidak" onclick="VocabAIFreeChat._setSuara(false)">🚫 Teks saja</button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">✏️ Cara Kamu Menjawab:</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.caraJawab === "ketik" ? "aktif" : ""}" id="vfh-jawab-ketik" onclick="VocabAIFreeChat._setJawab('ketik')">⌨️ Ketik</button>
            <button class="sv-chip ${c.caraJawab === "suara" ? "aktif" : ""}" id="vfh-jawab-suara" onclick="VocabAIFreeChat._setJawab('suara')">🎤 Suara</button>
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">💡 Topik Percakapan (opsional)</div>
          <div class="sv-chips" id="vfh-topik-chips">
            <button class="sv-chip ${!c.pakaiTopik ? "aktif" : ""}" onclick="VocabAIFreeChat._setPakaiTopik(false)">🎲 Bebas (tanpa topik)</button>
            <button class="sv-chip ${c.pakaiTopik ? "aktif" : ""}" onclick="VocabAIFreeChat._setPakaiTopik(true)">✍️ Tentukan Topik</button>
          </div>
          <div id="vfh-topik-input-wrap" style="margin-top:8px;display:${c.pakaiTopik ? "block" : "none"}">
            <input type="text" id="vfh-topik-input" placeholder="Misal: liburan, keluarga, hobi..." value="${VocabAIData.esc2(c.topikTeks)}"
              style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ce93d8;border-radius:6px;font-size:13px;outline:none"
              oninput="VocabAIFreeChat._setTopikTeks(this.value)">
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#e8f5e9;border-radius:8px;border-left:3px solid #43a047">
          <div style="font-size:13px;color:#2e7d32;font-weight:600;margin-bottom:8px">🔒 Kepatuhan Kosakata</div>
          <div class="sv-chips" id="vfh-ketat-chips">
            <button class="sv-chip ${!c.modeKetat ? "aktif" : ""}" onclick="VocabAIFreeChat._setModeKetat(false)">🔓 Longgar (instruksi saja)</button>
            <button class="sv-chip ${c.modeKetat ? "aktif" : ""}" onclick="VocabAIFreeChat._setModeKetat(true)">🔒 Ketat (divalidasi ulang)</button>
          </div>
          <div style="font-size:11px;color:#558b2f;margin-top:6px" id="vfh-ketat-desc">
            ${c.modeKetat
              ? "AI dicek tiap giliran: kalau ada karakter di luar daftar kosakata, otomatis diminta menulis ulang (maks 2x) sampai patuh."
              : "AI hanya diberi instruksi untuk patuh pada daftar kosakata — cepat & hemat kuota, tapi TIDAK 100% dijamin selalu patuh."}
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <input type="password" id="vfh-api-key-input" placeholder="Masukkan Gemini API key..." value="${SentenceVocab._getApiKey()}"
            style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
            oninput="SentenceVocab._setApiKey(this.value)">
          <div style="font-size:11px;color:#888;margin-top:5px">Key sama dipakai di semua fitur AI (tersimpan di browser saja).</div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="VocabAIFreeChat.mulai()">🚀 Mulai Chat Bebas</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="VocabAIFreeChat.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggleTampil(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("vfh-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi", "pinyin", "indo"][i])));
  },
  _toggleHSK(id) {
    const s = this._cfg.hskSet;
    if (s.has(id)) { if (s.size === 1) { tampilToast("Pilih minimal 1 sumber kosakata!"); return; } s.delete(id); }
    else s.add(id);
    const wrap = el("vfh-hsk-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(SHEET_VOCAB[i].id)));
  },
  _setSuara(v) {
    this._cfg.aiSuara = v;
    const ya = el("vfh-suara-ya"), tidak = el("vfh-suara-tidak");
    if (ya) ya.classList.toggle("aktif", v);
    if (tidak) tidak.classList.toggle("aktif", !v);
  },
  _setJawab(v) {
    this._cfg.caraJawab = v;
    const a = el("vfh-jawab-ketik"), b = el("vfh-jawab-suara");
    if (a) a.classList.toggle("aktif", v === "ketik");
    if (b) b.classList.toggle("aktif", v === "suara");
  },
  _setPakaiTopik(v) {
    this._cfg.pakaiTopik = v;
    const wrap = el("vfh-topik-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", (i === 1) === v));
    const inWrap = el("vfh-topik-input-wrap");
    if (inWrap) inWrap.style.display = v ? "block" : "none";
  },
  _setTopikTeks(v) { this._cfg.topikTeks = v; },
  _setModeKetat(v) {
    this._cfg.modeKetat = v;
    const wrap = el("vfh-ketat-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", (i === 1) === v));
    setHTML("vfh-ketat-desc", v
      ? "AI dicek tiap giliran: kalau ada karakter di luar daftar kosakata, otomatis diminta menulis ulang (maks 2x) sampai patuh."
      : "AI hanya diberi instruksi untuk patuh pada daftar kosakata — cepat & hemat kuota, tapi TIDAK 100% dijamin selalu patuh.");
  },

  async mulai() {
    if (!SentenceVocab._getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    if (!this._cfg.hskSet.size) { tampilToast("⚠️ Pilih minimal 1 sumber kosakata HSK!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">📚 Mengambil kosakata ${[...this._cfg.hskSet].join(", ")}...</div>
      </div>`;
    const words = await VocabAIData.ambilKataDariHSK([...this._cfg.hskSet]);
    if (!words.length) { tampilToast("⚠️ Gagal mengambil data kosakata untuk sumber yang dipilih."); this.kembaliMenu(); return; }
    const topik = this._cfg.pakaiTopik ? this._cfg.topikTeks.trim() : "";
    VocabAIFreeFlow.reset(words, topik, this._cfg.modeKetat);
    this._renderChatUI(words.length);
    await this._giliran(() => VocabAIFreeFlow.mulai());
  },

  _renderChatUI(jumlahKata) {
    const topik = VocabAIFreeFlow.topik;
    const ketatBadge = VocabAIFreeFlow.modeKetat
      ? `<span style="color:#2e7d32;font-weight:600">🔒 Ketat</span>`
      : `<span style="color:#e65100;font-weight:600">🔓 Longgar</span>`;
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🗨️ Chat Bebas (HSK)</div>
        <div style="text-align:center;color:#546e7a;font-size:12px;margin-bottom:6px">
          📚 ${jumlahKata} kata dari ${[...this._cfg.hskSet].join(", ")} · ${ketatBadge}${topik ? ` · 💡 Topik: ${VocabAIData.esc2(topik)}` : " · 🎲 Bebas"}
        </div>
        <div id="vfh-chat-area" class="sv-chat-area" style="max-height:340px"></div>
        <div id="vfh-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar obrolan, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="vfh-tanya-input" placeholder="Misal: apa arti 认真?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')VocabAIFreeChat._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="VocabAIFreeChat._kirimTanya()">Tanya</button>
          </div>
          <div id="vfh-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="VocabAIFreeChat.kembaliMenu()">← Selesai & Keluar</button>
        </div>
      </div>`;
  },

  async _giliran(fn) {
    VocabAIFreeFlow.sedangProses = true;
    this._appendChat("ai", "⏳ Sedang mengetik...", "sv-chat-ai-loading");
    try {
      const parsed = await fn();
      this._updateLastAI(parsed);
      if (this._cfg.aiSuara && parsed.hanzi) TTS.mandarin(parsed.hanzi);
      if (parsed.selesai) {
        setHTML("vfh-input-area", "");
        if (typeof App !== "undefined" && App.catatSesiSelesai) App.catatSesiSelesai("vocab", 1, 1);
        return;
      }
      VocabAIFreeFlow.sedangProses = false;
      this._renderInputArea();
      return;
    } catch (e) {
      this._updateLastAI({ hanzi: "", pinyin: "", indonesia: "", koreksi: "", _error: e.message });
    }
    VocabAIFreeFlow.sedangProses = false;
    this._renderInputArea();
  },

  _bubbleAIHtml(parsed) {
    if (parsed._error) return `<span style="color:#c62828">❌ ${VocabAIData.esc2(parsed._error)}</span>`;
    const c = this._cfg.tampilAI;
    let info = "";
    if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${VocabAIData.esc2md(parsed.koreksi)}</div>`;
    if (c.has("hanzi") && parsed.hanzi) info += `<div>${parsed.hanzi} <button class="btn-audio-kecil" onclick="TTS.mandarin('${VocabAIData.esc(parsed.hanzi)}')">🔊</button></div>`;
    if (c.has("pinyin") && parsed.pinyin) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin}</div>`;
    if (c.has("indo")) info += `<div style="font-size:13px;color:#37474f;margin-top:2px">${VocabAIData.esc2md(parsed.indonesia || "")}</div>`;
    if (VocabAIFreeFlow.modeKetat && parsed._pelanggaranSisa && parsed._pelanggaranSisa.length) {
      info += `<div style="font-size:11px;color:#c62828;margin-top:2px">⚠️ Masih ada di luar daftar meski sudah divalidasi 2x: ${parsed._pelanggaranSisa.join("、")}</div>`;
    }
    return `<span class="sv-chat-label">🤖 Partner:</span> ${info}`;
  },

  _appendChat(role, teks, extraClass = "") {
    const area = el("vfh-chat-area");
    if (!area) return;
    const div = document.createElement("div");
    div.className = `sv-chat-bubble sv-chat-${role} ${extraClass}`;
    div.innerHTML = role === "ai"
      ? `<span class="sv-chat-label">🤖 Partner:</span> ${teks}`
      : `<span class="sv-chat-label">👤 Kamu:</span> ${VocabAIData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  _updateLastAI(parsed) {
    const area = el("vfh-chat-area");
    if (!area) return;
    const loading = area.querySelector(".sv-chat-ai-loading");
    const html = this._bubbleAIHtml(parsed);
    if (loading) { loading.className = "sv-chat-bubble sv-chat-ai"; loading.innerHTML = html; }
    else this._appendChat("ai", html);
    area.scrollTop = area.scrollHeight;
  },

  _renderInputArea() {
    if (this._cfg.caraJawab === "ketik") {
      setHTML("vfh-input-area", `
        <div class="sv-tanya-input-wrap" style="margin-top:8px">
          <input type="text" id="vfh-input" placeholder="Ketik balasanmu..." onkeydown="if(event.key==='Enter')VocabAIFreeChat._jawabTeks()">
          <button onclick="VocabAIFreeChat._jawabTeks()">Kirim</button>
        </div>`);
      setTimeout(() => { const i = el("vfh-input"); if (i) i.focus(); }, 100);
    } else {
      const label = VocabAIFreeFlow.bahasaJawabanBerikutnya === "id" ? "🎤 Bicara (Indonesia)" : "🎤 Bicara (Mandarin)";
      setHTML("vfh-input-area", `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-merah" id="vfh-btn-mic" onclick="VocabAIFreeChat._jawabSuara()">${label}</button>
        </div>`);
    }
  },

  async _jawabTeks() {
    if (VocabAIFreeFlow.sedangProses) return;
    const inp = el("vfh-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    inp.value = "";
    this._appendChat("user", teks);
    setHTML("vfh-input-area", "");
    await this._giliran(() => VocabAIFreeFlow.kirimJawaban(teks));
  },

  _jawabSuara() {
    if (VocabAIFreeFlow.sedangProses) return;
    const btnMic = el("vfh-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    STT.mulai(VocabAIFreeFlow.bahasaSTT(),
      async (hasil) => {
        this._appendChat("user", hasil);
        setHTML("vfh-input-area", "");
        await this._giliran(() => VocabAIFreeFlow.kirimJawaban(hasil));
      },
      err => { tampilToast("❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } },
      dapat => { if (!dapat) { tampilToast("⚠️ Tidak terdeteksi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } } }
    );
  },

  async _kirimTanya() {
    const inp = el("vfh-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("vfh-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan ngobrol bebas lewat chat dengan AI.
Siswa bertanya hal DI LUAR obrolan yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk obrolan, jadi jangan anggap sebagai jawaban.
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await SentenceVocab._callAI(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${VocabAIData.esc2(teks)}</b></div><div>💡 ${VocabAIData.esc2md(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = VocabAIHub.renderMenu();
  },
};
