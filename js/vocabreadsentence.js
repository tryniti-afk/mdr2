// ================================================================
//  VOCABREADSENTENCE.JS — "Baca Kalimat AI" (fitur baru di Vocabulary)
//    • Ambil kata dari set soal vocab yang sudah dipilih user (SetSoal)
//    • AI (Gemini) buatkan 1 kalimat baru yang WAJIB memuat kata fokus
//      tsb, dengan kosakata lain dibatasi ke level HSK set yang sedang
//      aktif (atau di bawahnya) supaya kalimat tetap bisa dipahami
//    • Tampilan default: hanya hanzi (mirip RealtimeReading), lalu:
//        - 🔊 Dengar Kalimat  → audio saja, tampilan tetap hanzi
//        - 🔤 Pinyin          → toggle pinyin per kata
//        - 💬 Arti            → toggle terjemahan kalimat
//        - 🈯 Penjelasan Tiap Hanzi → breakdown pinyin+arti per karakter
//        - 🎯 Kegunaan Kata Fokus  → penjelasan fungsi kata fokus di kalimat
//        - 🎤 Coba Membaca    → STT, lalu AI menilai bacaan (opsional,
//          boleh dilewati langsung ke kalimat berikutnya)
//        - 🔄 Kalimat Lain    → AI buatkan kalimat baru, kata fokus sama
//        - ❓ Tanya AI         → tanya bebas seputar kalimat/kata ini
//
//  Dipakai: pitch.js (GeminiAPI), engine.js (TTS, STT, el, dst),
//           vocab_ai.js (VocabAIData.ambilKata), setsoal.js (SetSoal),
//           datamanager.js (SHEET_VOCAB)
// ================================================================

var VocabReadSentence = {
  jumlah: 5,
  soalList: [],
  idx: 0,
  current: null,     // { word, data } — data = hasil parse JSON dari AI
  showPinyin: false,
  showArti: false,
  showBreakdown: false,
  showFokus: false,
  _listening: false,

  // ── ENTRY ────────────────────────────────────────────────────
  buka() { el("konten-utama").innerHTML = this.renderSetup(); },

  _levelInfo() {
    const sheet = (typeof SetSoal !== "undefined") ? SetSoal.get("vocab").sheet : "lokal";
    const MAP = {
      "hsk1-2": { label: "HSK 1-2", desc: "HSK 1 dan HSK 2" },
      "Hsk3":   { label: "HSK 1-3", desc: "HSK 1 sampai HSK 3" },
      "Hsk4":   { label: "HSK 1-4", desc: "HSK 1 sampai HSK 4" },
      "Hsk5":   { label: "HSK 1-5", desc: "HSK 1 sampai HSK 5" },
    };
    return MAP[sheet] || { label: "Dasar-Menengah", desc: "kosakata dasar-menengah yang umum dipakai sehari-hari (setara HSK 1-3)" };
  },

  renderSetup() {
    const lv = this._levelInfo();
    return `
      <div class="soal-wrap">
        <div class="label-mode">📖 Baca Kalimat AI</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">
          AI akan membuatkan 1 kalimat baru untuk tiap kata dari set soal yang sudah kamu pilih di menu Vocabulary.
          Kata-kata lain dalam kalimat dibatasi ke level <b>${lv.label}</b> (${vrsEsc(lv.desc)}) supaya tetap bisa dipahami.
          Kamu bebas cuma baca-baca, dengar, lihat pinyin/arti, atau coba membaca keras — semuanya opsional.
        </div>

        <div style="font-weight:700;margin:10px 0 6px">Jumlah Kata Fokus</div>
        <div class="sub-menu-grid">
          ${[3, 5, 8].map(n => `
            <div class="sub-card ${this.jumlah === n ? "sub-card-aktif" : ""}" onclick="VocabReadSentence._pilihJumlah(${n})">
              <div class="sub-label">${n} kata</div>
            </div>`).join("")}
        </div>

        ${renderKontrolLanjut("VocabReadSentence._renderUlangSetup")}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="VocabReadSentence.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },
  _renderUlangSetup() { el("konten-utama").innerHTML = VocabReadSentence.renderSetup(); },
  _pilihJumlah(n) { this.jumlah = n; el("konten-utama").innerHTML = this.renderSetup(); },

  // ── MULAI SESI ───────────────────────────────────────────────
  async mulai() {
    if (!GeminiAPI.getKey()) {
      const k = prompt("Masukkan Gemini API key (dipakai juga oleh fitur AI lain):");
      if (k) GeminiAPI.setKey(k); else { tampilToast("⚠️ Perlu API key Gemini untuk fitur ini."); return; }
    }
    this.idx = 0;
    const kata = await VocabAIData.ambilKata(this.jumlah);
    if (!kata.length) { tampilToast("⚠️ Data vocab kosong."); this.buka(); return; }
    this.soalList = kata;
    this.tampilSoal();
  },

  // ── TAMPILKAN 1 SOAL (buat kalimat via AI lalu render) ────────
  tampilSoal() {
    if (this.idx >= this.soalList.length) { this._selesai(); return; }
    const word = this.soalList[this.idx];
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Kata ${this.idx + 1}/${this.soalList.length}</div>
        </div>
        <div class="label-mode">🤖 Membuat kalimat untuk "${vrsEsc(word.hanzi)}"...</div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-abu" onclick="VocabReadSentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
    this._generate(word);
  },

  async _generate(word) {
    const lv = this._levelInfo();
    const promptTeks = `Kamu tutor bahasa Mandarin yang membuat contoh kalimat latihan membaca untuk siswa.
Kata FOKUS yang WAJIB muncul dalam kalimat: "${word.hanzi}" (pinyin: ${word.pinyin || "-"}, arti: ${word.arti || "-"}).
Buat SATU kalimat Mandarin natural yang memakai kata fokus tsb. SEMUA kata LAIN dalam kalimat (selain kata fokus) WAJIB berupa kosakata level ${lv.desc} atau lebih rendah/sederhana — JANGAN pakai kosakata yang lebih sulit dari level itu untuk kata selain kata fokus. Panjang kalimat wajar (sekitar 4-12 karakter hanzi), natural, dan masuk akal untuk percakapan/tulisan sehari-hari.

Balas HANYA JSON valid (tanpa markdown, tanpa penjelasan tambahan) dengan format PERSIS:
{
  "kalimat": "seluruh kalimat hanzi termasuk tanda baca, tanpa spasi antar kata",
  "arti": "terjemahan Indonesia lengkap kalimat ini",
  "tokens": [
    {"type":"word","hanzi":"...","pinyin":"... (pakai diakritik nada ā á ǎ à, BUKAN angka)","arti":"arti kata ini dalam konteks kalimat","chars":[{"c":"satu karakter hanzi","py":"pinyin karakter itu","arti":"arti/makna karakter itu"}]},
    {"type":"punct","text":"，"}
  ],
  "penjelasanFokus": "2-4 kalimat Bahasa Indonesia yang menjelaskan KEGUNAAN/FUNGSI kata fokus \\"${word.hanzi}\\" dalam kalimat ini: posisinya dalam kalimat, pola/struktur yang dipakai, dan kenapa kata itu dipakai seperti itu."
}
Aturan PENTING:
- Gabungan semua token (hanzi kata + text tanda baca) berurutan HARUS persis sama dengan field "kalimat".
- Kata fokus "${word.hanzi}" HARUS muncul sebagai salah satu token type "word" dengan hanzi PERSIS "${word.hanzi}".
- Setiap token type "word" WAJIB punya "chars": array per-karakter (jika kata itu 1 karakter, array berisi 1 elemen saja), urut sesuai hanzi kata tsb.
- Tanda baca (，。！？：、) jadi token terpisah type "punct", jangan digabung ke token kata.`;

    let data = null, lastErr = null;
    for (let percobaan = 0; percobaan < 2 && !data; percobaan++) {
      try {
        const hasil = await GeminiAPI.callJSON(promptTeks, 1200, 0.7);
        if (!hasil || !hasil.kalimat || !Array.isArray(hasil.tokens) || !hasil.tokens.length) {
          throw new Error("Format AI tidak sesuai.");
        }
        hasil.tokens.forEach(t => {
          if (t.type === "word") {
            if (!t.chars || !t.chars.length) t.chars = _vrsAutoSplit(t.hanzi, t.pinyin);
          }
        });
        data = hasil;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!data) {
      this._tampilError(word, lastErr ? lastErr.message : "Gagal membuat kalimat. Coba lagi.");
      return;
    }

    this.current = { word, data };
    this.showPinyin = false;
    this.showArti = false;
    this.showBreakdown = false;
    this.showFokus = false;
    this._renderSoal();
  },

  _tampilError(word, msg) {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Kata ${this.idx + 1}/${this.soalList.length}</div>
        </div>
        <div class="label-mode">📖 Baca Kalimat AI — "${vrsEsc(word.hanzi)}"</div>
        <div class="hasil-box salah" style="margin-top:10px">⚠️ ${vrsEsc(msg)}</div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-hijau" onclick="VocabReadSentence._generate(VocabReadSentence.soalList[VocabReadSentence.idx])">🔄 Coba Lagi</button>
          <button class="btn btn-kuning" onclick="VocabReadSentence._lanjutKata()">⏭ Lewati</button>
          <button class="btn btn-abu" onclick="VocabReadSentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── RENDER SOAL UTAMA ────────────────────────────────────────
  _renderSoal() {
    const { word, data } = this.current;
    const lv = this._levelInfo();

    let kalimatHTML = "";
    (data.tokens || []).forEach(tok => {
      if (tok.type === "punct") { kalimatHTML += `<span class="rtr-punct">${vrsEsc(tok.text)}</span>`; return; }
      const isFokus = tok.hanzi === word.hanzi;
      kalimatHTML += `<span class="rtr-word${isFokus ? " vrs-fokus" : ""}">
        <span class="vrs-char">${vrsEsc(tok.hanzi)}</span>
        ${this.showPinyin ? `<div class="rtr-pinyin">${vrsEsc(tok.pinyin || "")}</div>` : ""}
      </span>`;
    });

    let breakdownHTML = "";
    (data.tokens || []).forEach(tok => {
      if (tok.type !== "word") return;
      (tok.chars || []).forEach(c => {
        breakdownHTML += `<div class="vrs-breakdown-row">
          <div class="vrs-bd-hanzi">${vrsEsc(c.c)}</div>
          <div class="vrs-bd-pinyin">${vrsEsc(c.py || "")}</div>
          <div class="vrs-bd-arti">${vrsEsc(c.arti || "")}</div>
        </div>`;
      });
    });

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Kata ${this.idx + 1}/${this.soalList.length}</div>
        </div>
        <div class="label-mode">📖 Fokus kata: <b>${vrsEsc(word.hanzi)}</b> (${vrsEsc(word.pinyin || "")}) — ${vrsEsc(word.arti || "")}</div>
        <div class="soal-teks-indo" style="margin-bottom:10px">Coba baca kalimat berikut. Kosakata lainnya level ${lv.label}.</div>

        <div class="btn-row" style="margin-bottom:10px;flex-wrap:wrap">
          <button class="btn-audio" onclick="VocabReadSentence._dengar()">🔊 Dengar Kalimat</button>
          <button class="btn ${this.showPinyin ? "btn-biru" : "btn-abu"}" onclick="VocabReadSentence._toggle('showPinyin')">🔤 Pinyin</button>
          <button class="btn ${this.showArti ? "btn-biru" : "btn-abu"}" onclick="VocabReadSentence._toggle('showArti')">💬 Arti</button>
        </div>

        ${this.showArti ? `<div class="hasil-box info" style="margin-bottom:10px">${vrsEsc(data.arti || "-")}</div>` : ""}

        <div class="rtr-passage">${kalimatHTML}</div>

        <div class="btn-row" style="margin-top:10px;flex-wrap:wrap">
          <button class="btn ${this.showBreakdown ? "btn-ungu" : "btn-abu"}" onclick="VocabReadSentence._toggle('showBreakdown')">🈯 Penjelasan Tiap Hanzi</button>
          <button class="btn ${this.showFokus ? "btn-kuning" : "btn-abu"}" onclick="VocabReadSentence._toggle('showFokus')">🎯 Kegunaan Kata Fokus</button>
        </div>

        ${this.showBreakdown ? `<div class="vrs-breakdown">${breakdownHTML || "-"}</div>` : ""}
        ${this.showFokus ? `<div class="hasil-box info" style="margin-top:10px;text-align:left">🎯 ${vrsEsc(data.penjelasanFokus || "-")}</div>` : ""}

        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-hijau" id="vrs-btn-baca" onclick="VocabReadSentence._cobaBaca()">🎤 Coba Membaca</button>
          <button class="btn btn-kuning" onclick="VocabReadSentence._kalimatLain()">🔄 Kalimat Lain</button>
        </div>
        <div id="vrs-hasil-baca"></div>

        <div id="vrs-tanya-wrap">${this._kotakTanya()}</div>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-biru" onclick="VocabReadSentence._lanjutKata()">➡️ Kata Berikutnya</button>
          <button class="btn btn-abu" onclick="VocabReadSentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _toggle(key) { this[key] = !this[key]; this._renderSoal(); },

  _dengar() {
    const { data } = this.current;
    TTS.mandarin(data.kalimat);
  },

  // ── COBA MEMBACA (STT + penilaian AI, opsional) ───────────────
  _cobaBaca() {
    if (this._listening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { tampilToast("⚠️ SpeechRecognition tidak tersedia. Gunakan Chrome."); return; }
    this._listening = true;
    const btn = el("vrs-btn-baca");
    if (btn) { btn.disabled = true; btn.innerText = "🎙️ Mendengarkan..."; }
    setHTML("vrs-hasil-baca", `<div class="hasil-box info" style="margin-top:10px">🎙️ Silakan baca kalimatnya sekarang...</div>`);

    STT.mulai("zh-CN",
      (hasil) => { this._listening = false; this._nilaiBacaan(hasil); },
      (errMsg) => {
        this._listening = false;
        if (btn) { btn.disabled = false; btn.innerText = "🎤 Coba Membaca"; }
        setHTML("vrs-hasil-baca", `<div class="hasil-box salah" style="margin-top:10px">⚠️ Error mic: ${vrsEsc(errMsg)}</div>`);
      },
      (dapat) => {
        this._listening = false;
        if (btn) { btn.disabled = false; btn.innerText = "🎤 Coba Membaca"; }
        if (!dapat) setHTML("vrs-hasil-baca", `<div class="hasil-box salah" style="margin-top:10px">⚠️ Tidak ada suara terdeteksi. Coba lagi, atau langsung lanjut saja.</div>`);
      }
    );
  },

  async _nilaiBacaan(transkrip) {
    const { word, data } = this.current;
    const btn = el("vrs-btn-baca");
    if (btn) { btn.disabled = false; btn.innerText = "🎤 Coba Membaca"; }
    setHTML("vrs-hasil-baca", `<div class="hasil-box info" style="margin-top:10px">🤖 Menilai bacaan kamu...<br><i>"${vrsEsc(transkrip)}"</i></div>`);
    try {
      const prompt = `Kamu guru bahasa Mandarin yang menilai bacaan siswa.
Kalimat target: "${data.kalimat}"
Kata fokus yang sedang dipelajari: "${word.hanzi}" (${word.pinyin || "-"})
Hasil rekaman ucapan siswa (dari speech-to-text, bisa saja kurang akurat): "${transkrip}"

Nilai apakah bacaan siswa sudah cukup sesuai dengan kalimat target (toleransi kesalahan kecil karena keterbatasan speech-to-text), dengan perhatian khusus pada kata fokus.
Balas HANYA JSON valid format PERSIS:
{"benar": true atau false, "catatan": "1-3 kalimat Bahasa Indonesia, jelaskan bagian yang meleset kalau ada (terutama kata fokus), beri semangat singkat"}`;
      const hasil = await GeminiAPI.callJSON(prompt, 350, 0.4);
      const kelas = hasil.benar ? "benar" : "salah";
      const ikon = hasil.benar ? "✅" : "⚠️";
      setHTML("vrs-hasil-baca", `
        <div class="hasil-box ${kelas}" style="margin-top:10px;text-align:left">
          <div><b>Kamu:</b> "${vrsEsc(transkrip)}"</div>
          <div style="margin-top:6px">${ikon} ${vrsEsc(hasil.catatan || "")}</div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-kuning" onclick="VocabReadSentence._cobaBaca()">🔁 Coba Lagi</button>
          </div>
        </div>`);
    } catch (e) {
      setHTML("vrs-hasil-baca", `
        <div class="hasil-box salah" style="margin-top:10px;text-align:left">
          <div><b>Kamu:</b> "${vrsEsc(transkrip)}"</div>
          <div style="margin-top:6px">⚠️ ${vrsEsc(e.message)}</div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-kuning" onclick="VocabReadSentence._cobaBaca()">🔁 Coba Lagi</button>
          </div>
        </div>`);
    }
  },

  // ── KALIMAT LAIN (kata fokus sama, kalimat baru) ──────────────
  _kalimatLain() {
    const word = this.current.word;
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Kata ${this.idx + 1}/${this.soalList.length}</div>
        </div>
        <div class="label-mode">🤖 Membuat kalimat baru untuk "${vrsEsc(word.hanzi)}"...</div>
      </div>`;
    this._generate(word);
  },

  // ── TANYA AI BEBAS SEPUTAR KALIMAT INI ────────────────────────
  _kotakTanya() {
    return `
      <div class="vrs-tanya-box">
        <div style="font-size:12px;color:var(--c-biru);font-weight:600;margin-bottom:4px">❓ Belum paham? Tanya AI</div>
        <div style="display:flex;gap:6px">
          <input type="text" id="vrs-tanya-input" placeholder="Misal: kenapa pakai kata itu di situ?"
            style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--c-border);border-radius:6px;font-size:13px;outline:none;background:var(--c-card);color:var(--c-text)"
            onkeydown="if(event.key==='Enter')VocabReadSentence._tanyaAI()">
          <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="VocabReadSentence._tanyaAI()">Tanya</button>
        </div>
        <div id="vrs-tanya-hasil" style="font-size:12.5px;margin-top:6px;color:var(--c-sub)"></div>
      </div>`;
  },

  async _tanyaAI() {
    const inp = el("vrs-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const { word, data } = this.current;
    const hasilEl = el("vrs-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      if (!GeminiAPI.getKey()) throw new Error("Perlu API key Gemini dulu.");
      const prompt = `Kamu tutor bahasa Mandarin yang ramah. Konteks: siswa sedang belajar kata fokus "${word.hanzi}" (${word.pinyin || "-"}, arti: ${word.arti || "-"}) lewat kalimat contoh: "${data.kalimat}" (arti: ${data.arti || "-"}).
Penjelasan kegunaan kata fokus yang sudah diberikan: "${data.penjelasanFokus || "-"}"
Siswa bertanya: "${teks}"
Jawab dengan jelas, singkat (maksimal 4 kalimat), berbahasa Indonesia.`;
      const jawaban = await GeminiAPI.call(prompt, 350);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${vrsEsc(teks)}</b></div><div>💡 ${GeminiAPI.esc2(jawaban.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + vrsEsc(e.message);
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  // ── NAVIGASI ─────────────────────────────────────────────────
  _lanjutKata() {
    TTS.berhenti(); STT.berhenti();
    this.idx++;
    this.tampilSoal();
  },

  _selesai() {
    App.catatSesiSelesai("vocab", this.soalList.length, this.soalList.length);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">🏆</div>
        <h2>Baca Kalimat AI Selesai!</h2>
        <div class="selesai-skor"><div>Kalimat dipelajari: <b>${this.soalList.length}</b></div></div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="VocabReadSentence.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="VocabReadSentence.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti();
    STT.berhenti();
    this._listening = false;
    Vocab.kembaliMenu();
  },
};

// Pecah 1 kata jadi per-karakter kalau AI tidak menyertakan field "chars"
// (fallback darurat — pinyin ditaruh di karakter pertama saja kalau tidak
// bisa dipecah rapi per suku kata).
function _vrsAutoSplit(hanzi, pinyin) {
  const chars = [...(hanzi || "")];
  if (chars.length <= 1) return [{ c: hanzi, py: pinyin || "", arti: "" }];
  const bySpace = (pinyin || "").trim().split(/\s+/);
  if (bySpace.length === chars.length) return chars.map((c, i) => ({ c, py: bySpace[i], arti: "" }));
  return chars.map((c, i) => ({ c, py: i === 0 ? (pinyin || "") : "", arti: "" }));
}

function vrsEsc(s) {
  return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
