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

  reset(words, koreksiRounds) {
    this.words = words;
    this.wordIdx = 0;
    this.subPhase = "kalimat";
    this.history = [];
    this.putaran = 0;
    this.koreksiRounds = koreksiRounds || 1;
    this.sedangProses = false;
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

Balas HANYA dengan JSON valid (tanpa markdown/komentar):
{
  "hanzi": "kalimat Mandarin utama (atau kosong)",
  "pinyin": "pinyin bertanda nada (atau kosong)",
  "indonesia": "narasi lengkap pesanmu",
  "koreksi": "feedback singkat, atau string kosong",
  "cocok": false,
  "selesai": false
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
Karena ini kata TERAKHIR dari 5 kata (${daftar}), lanjutkan pesan yang sama dengan mengajak siswa membuat SATU kalimat yang memuat SEMUA 5 kata tersebut sekaligus sebagai tantangan penutup sesi. Jelaskan tantangan ini dengan jelas & memotivasi di field "indonesia". Set "selesai": false (belum selesai, masih menunggu kalimat gabungan siswa).`;
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
      this.subPhase = "final";
      this.putaran = 0;
    } else {
      this.wordIdx++;
      this.subPhase = "kalimat";
      this.putaran = 0;
    }
    return parsed;
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
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="VocabAIChat.kembaliMenu()">← Selesai & Keluar</button>
        </div>
      </div>`;
    this._updateProgres();
  },

  _updateProgres() {
    const p = VocabAIFlow.progres();
    const w = VocabAIFlow.kataSaatIni();
    let teks;
    if (p.fase === "final" || p.fase === "selesai") teks = `🏁 Tantangan akhir: kalimat gabungan 5 kata`;
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
      setHTML("vac-input-area", `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-merah" id="vac-btn-mic" onclick="VocabAIChat._jawabSuara()">🎤 Bicara</button>
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
    STT.mulai("zh-CN",
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
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-merah" onclick="VocabAICall._tutupTelepon()">📵 Tutup Telepon</button>
        </div>
      </div>`;
    this._updateProgres();
  },

  _updateProgres() {
    const p = VocabAIFlow.progres();
    const w = VocabAIFlow.kataSaatIni();
    let teks;
    if (p.fase === "final" || p.fase === "selesai") teks = `🏁 Tantangan akhir: kalimat gabungan 5 kata`;
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
      this._tampilStatus("🎤 Giliranmu menjawab");
      this._renderInputArea();
    };

    if (parsed.hanzi) TTS.mandarin(parsed.hanzi, lanjut);
    else if (parsed.indonesia) TTS.indo(parsed.indonesia.replace(/[*`]/g, ""), lanjut);
    else setTimeout(lanjut, 300);
  },

  _renderInputArea() {
    setHTML("vap-input-area", `
      <textarea id="vap-input" class="input-jawab" rows="2" placeholder="Ketik jawabanmu, atau pakai mic..."></textarea>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-hijau" onclick="VocabAICall._jawabTeks()">✅ Kirim</button>
        <button class="btn btn-merah" id="vap-btn-mic" onclick="VocabAICall._jawabSuara()">🎤 Bicara</button>
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
    STT.mulai("zh-CN",
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
