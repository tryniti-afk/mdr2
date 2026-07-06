// ================================================================
//  INTERVIEW.JS — Sub-fitur Sentence: Latihan Interview
//  Data diambil dari spreadsheet sheet "interview" dengan kolom:
//    Pertanyaan Hanzi | Pertanyaan Pinyin | Pertanyaan Indonesia |
//    Jawaban Hanzi    | Jawaban Pinyin    | Jawaban Indonesia    |
//    Kunci Hanzi      | Kunci Pinyin      | Kunci Indonesia
//
//  3 mode:
//    1. Interview        → latihan soal/jawaban tanya-jawab biasa
//    2. InterviewCall     → simulasi telepon interview dengan AI (Gemini)
//    3. InterviewChat     → chat teks/suara dengan AI (Gemini)
// ================================================================

// ── HUB (dipanggil dari Sentence.mulai('interview')) ───────────
var InterviewHub = {
  renderMenu() {
    const cards = [
      { obj:"Interview",     icon:"📋", label:"Latihan Soal",   desc:"Tanya-jawab dari data interview" },
      { obj:"InterviewCall", icon:"📞", label:"Telepon AI",     desc:"Simulasi panggilan interview real-time" },
      { obj:"InterviewChat", icon:"💬", label:"Chat AI",        desc:"Ngobrol teks/suara, dikoreksi AI" },
    ];
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">💼</div>
          <div>
            <div class="sv-title">Latihan Interview</div>
            <div class="sv-subtitle">Data dari sheet "interview" di spreadsheet kamu</div>
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
        <button class="btn btn-abu" style="width:100%;margin-top:14px" onclick="App.renderModul('sentence')">← Kembali ke Sentence</button>
      </div>`;
  }
};

// ── UTIL BERSAMA ────────────────────────────────────────────────
var InterviewData = {
  _cache: null,

  async ambil() {
    if (this._cache) return this._cache;
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("interview")}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const teks = await res.text();
      const baris = teks.trim().split("\n").slice(1);
      const data = baris.map(b => {
        const c = DataMgr._splitCSVRow(b);
        if (!c[0]) return null;
        return {
          qHanzi:  (c[0] || "").trim(),
          qPinyin: (c[1] || "").trim(),
          qIndo:   (c[2] || "").trim(),
          aHanzi:  (c[3] || "").trim(),
          aPinyin: (c[4] || "").trim(),
          aIndo:   (c[5] || "").trim(),
          kHanzi:  (c[6] || "").trim(),
          kPinyin: (c[7] || "").trim(),
          kIndo:   (c[8] || "").trim(),
        };
      }).filter(x => x && x.qHanzi);
      if (data.length) this._cache = data;
      return data;
    } catch (e) { return []; }
  },

  // Jawaban dianggap benar jika mengandung SALAH SATU dari Kunci Hanzi/Pinyin/Indo
  cekBenar(input, item) {
    const daftarKunci = [item.kHanzi, item.kPinyin, item.kIndo].filter(Boolean);
    if (!daftarKunci.length) return false;
    return daftarKunci.some(k => cekJawaban(input, k));
  },

  esc(s) { return (s || "").replace(/'/g, "\\'").replace(/\n/g, " "); },
  esc2(s) {
    return (s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  },
};

// ================================================================
//  1) INTERVIEW — Latihan Soal Biasa
// ================================================================
var Interview = {

  _cfg: {
    jumlahMode: "n",          // "n" | "semua"
    jumlahN: 10,
    tampilQ: new Set(["hanzi", "pinyin"]),   // audio | hanzi | pinyin | indo
    tampilK: new Set(["hanzi", "indo"]),     // hanzi | pinyin | indo
    gameMode: "off",          // off | ulang | mundur2 | awal
    autoLanjut: true,
    autoDelay: 3,
  },

  soalList: [],
  idx: 0,
  _retryFlag: false,
  _transisi: false,
  _pendingNext: null,

  // ── SETTINGS MENU ────────────────────────────────────────────
  renderMenu() {
    const c = this._cfg;
    const chipQ = (key, label) => `
      <button class="sv-chip ${c.tampilQ.has(key) ? "aktif" : ""}" onclick="Interview._toggleQ('${key}')">${label}</button>`;
    const chipK = (key, label) => `
      <button class="sv-chip ${c.tampilK.has(key) ? "aktif" : ""}" onclick="Interview._toggleK('${key}')">${label}</button>`;

    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">📋</div>
          <div>
            <div class="sv-title">Latihan Soal Interview</div>
            <div class="sv-subtitle">Jawab pertanyaan interview seperti aslinya</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔢 Jumlah Soal:</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.jumlahMode === "n" ? "aktif" : ""}" id="iv-jm-n" onclick="Interview._setJumlahMode('n')">🔢 Sejumlah</button>
            <button class="sv-chip ${c.jumlahMode === "semua" ? "aktif" : ""}" id="iv-jm-semua" onclick="Interview._setJumlahMode('semua')">♾ Semua Soal</button>
          </div>
          <div id="iv-jumlah-n-wrap" style="margin-top:8px;display:${c.jumlahMode === "n" ? "block" : "none"}">
            <input type="range" min="1" max="50" value="${c.jumlahN}" oninput="Interview._setJumlahN(this.value)" style="width:100%;accent-color:#1565c0">
            <div style="font-size:12px;color:#546e7a">Jumlah: <b id="iv-jumlah-label">${c.jumlahN}</b> soal</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Pertanyaan Ditampilkan (bisa lebih dari satu):</div>
          <div class="sv-chips" id="iv-q-chips">
            ${chipQ("audio", "🔊 Audio")}
            ${chipQ("hanzi", "🈯 Hanzi")}
            ${chipQ("pinyin", "🔤 Pinyin")}
            ${chipQ("indo", "🇮🇩 Indonesia")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔑 Kunci Jawaban Ditampilkan:</div>
          <div class="sv-chips" id="iv-k-chips">
            ${chipK("hanzi", "🈯 Hanzi")}
            ${chipK("pinyin", "🔤 Pinyin")}
            ${chipK("indo", "🇮🇩 Indonesia")}
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">🎮 Mode Permainan (saat jawaban salah)</div>
          <div class="sv-chips" id="iv-game-chips">
            <button class="sv-chip ${c.gameMode === "off" ? "aktif" : ""}" onclick="Interview._setGame('off')">📝 Normal</button>
            <button class="sv-chip ${c.gameMode === "ulang" ? "aktif" : ""}" onclick="Interview._setGame('ulang')">🔁 Soal Muncul Lagi</button>
            <button class="sv-chip ${c.gameMode === "mundur2" ? "aktif" : ""}" onclick="Interview._setGame('mundur2')">⏮ Mundur 2 Soal</button>
            <button class="sv-chip ${c.gameMode === "awal" ? "aktif" : ""}" onclick="Interview._setGame('awal')">⏪ Kembali ke Awal</button>
          </div>
          <div style="font-size:11px;color:#78909c;margin-top:6px">Jika salah, soal akan diulang sampai kamu jawab benar, baru dilanjut sesuai pilihan di atas.</div>
        </div>

        <div class="sv-section">
          <div class="sv-label">⏭ Lanjut Soal:</div>
          <div class="sv-chips" id="iv-auto-chips">
            <button class="sv-chip ${c.autoLanjut ? "aktif" : ""}" id="iv-auto-ya" onclick="Interview._setAuto(true)">⏱ Otomatis</button>
            <button class="sv-chip ${!c.autoLanjut ? "aktif" : ""}" id="iv-auto-tidak" onclick="Interview._setAuto(false)">✋ Klik Manual</button>
          </div>
          <div id="iv-auto-delay-wrap" style="margin-top:8px;display:${c.autoLanjut ? "block" : "none"}">
            <input type="range" min="1" max="10" value="${c.autoDelay}" oninput="Interview._setAutoDelay(this.value)" style="width:100%;accent-color:#1565c0">
            <div style="font-size:12px;color:#546e7a">Delay setelah salah: <b id="iv-delay-label">${c.autoDelay}</b> detik</div>
          </div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="Interview.mulai()">🚀 Mulai Latihan</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="el('konten-utama').innerHTML = InterviewHub.renderMenu()">← Kembali</button>
      </div>`;
  },

  _refreshChipGroup(id, keys, activeSet) {
    const wrap = el(id);
    if (!wrap) return;
    wrap.querySelectorAll(".sv-chip").forEach((btn, i) => {
      btn.classList.toggle("aktif", activeSet.has(keys[i]));
    });
  },

  _toggleQ(key) {
    const s = this._cfg.tampilQ;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    this._refreshChipGroup("iv-q-chips", ["audio", "hanzi", "pinyin", "indo"], s);
  },
  _toggleK(key) {
    const s = this._cfg.tampilK;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    this._refreshChipGroup("iv-k-chips", ["hanzi", "pinyin", "indo"], s);
  },
  _setJumlahMode(mode) {
    this._cfg.jumlahMode = mode;
    const wrap = el("iv-jumlah-n-wrap");
    if (wrap) wrap.style.display = mode === "n" ? "block" : "none";
    const a = el("iv-jm-n"), b = el("iv-jm-semua");
    if (a) a.classList.toggle("aktif", mode === "n");
    if (b) b.classList.toggle("aktif", mode === "semua");
  },
  _setJumlahN(v) {
    this._cfg.jumlahN = parseInt(v);
    const lbl = el("iv-jumlah-label"); if (lbl) lbl.textContent = v;
  },
  _setGame(mode) {
    this._cfg.gameMode = mode;
    const wrap = el("iv-game-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach(b => b.classList.remove("aktif"));
    if (event && event.currentTarget) event.currentTarget.classList.add("aktif");
  },
  _setAuto(aktif) {
    this._cfg.autoLanjut = aktif;
    const ya = el("iv-auto-ya"), tidak = el("iv-auto-tidak");
    if (ya) ya.classList.toggle("aktif", aktif);
    if (tidak) tidak.classList.toggle("aktif", !aktif);
    const wrap = el("iv-auto-delay-wrap");
    if (wrap) wrap.style.display = aktif ? "block" : "none";
  },
  _setAutoDelay(v) {
    this._cfg.autoDelay = parseInt(v);
    const lbl = el("iv-delay-label"); if (lbl) lbl.textContent = v;
  },

  // ── MULAI ────────────────────────────────────────────────────
  async mulai() {
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">Mengambil soal interview dari spreadsheet...</div>
      </div>`;
    const data = await InterviewData.ambil();
    if (!data.length) {
      tampilToast("⚠️ Data sheet 'interview' tidak ditemukan / kosong.");
      el("konten-utama").innerHTML = this.renderMenu();
      return;
    }
    let pool = acak(data);
    if (this._cfg.jumlahMode === "n") pool = pool.slice(0, this._cfg.jumlahN);
    this.soalList = pool;
    this.idx = 0;
    this._retryFlag = false;
    this._transisi = false;
    this._pendingNext = null;
    resetSkor();
    this.tampilSoal();
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  tampilSoal() {
    this._transisi = false;
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    const total = this.soalList.length;
    const q = this._cfg.tampilQ;

    let qBlock = `<div class="label-mode">💼 Latihan Interview</div>`;
    if (q.has("audio")) {
      qBlock += `<div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${InterviewData.esc(item.qHanzi)}')">🔊 Putar Pertanyaan</button></div>`;
    }
    if (q.has("hanzi") && item.qHanzi) qBlock += `<div class="soal-kalimat">${item.qHanzi}</div>`;
    if (q.has("pinyin") && item.qPinyin) qBlock += `<div class="soal-pinyin-hint">${item.qPinyin}</div>`;
    if (q.has("indo") && item.qIndo) qBlock += `<div class="soal-kalimat indo" style="font-size:15px">${item.qIndo}</div>`;

    el("konten-utama").innerHTML = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${this.idx + 1} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar"><div class="progres-fill" style="width:${(this.idx / total * 100).toFixed(1)}%"></div></div>
      <div class="soal-wrap">
        ${qBlock}
        <div class="soal-hint">Jawab pertanyaan di atas (boleh ketik atau suara):</div>
        <textarea id="iv-input" class="input-jawab" rows="3" placeholder="Ketik jawabanmu..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Interview._jawabTeks()">✅ Submit</button>
          <button class="btn btn-merah" id="iv-btn-mic" onclick="Interview._jawabSuara()">🎤 Jawab Suara</button>
          <button class="btn btn-kuning" onclick="Interview._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Interview.kembaliMenu()">← Menu</button>
        </div>
      </div>`;

    if (q.has("audio")) setTimeout(() => TTS.mandarin(item.qHanzi), 350);
    setTimeout(() => { const inp = el("iv-input"); if (inp) inp.focus(); }, 100);
  },

  _jawabTeks() {
    if (this._transisi) return;
    const inp = el("iv-input");
    const input = inp ? inp.value.trim() : "";
    if (!input) { tampilToast("Tulis jawaban dulu!"); return; }
    const item = this.soalList[this.idx];
    const benar = InterviewData.cekBenar(input, item);
    tambahSkor(benar);
    if (inp) inp.disabled = true;
    const btnMic = el("iv-btn-mic"); if (btnMic) btnMic.disabled = true;
    this._tampilHasil(benar, item, input);
  },

  _jawabSuara() {
    if (this._transisi) return;
    const item = this.soalList[this.idx];
    const btnMic = el("iv-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    setTeks("hasil-box", "🎙️ Silakan jawab...");
    STT.mulai("zh-CN",
      (hasil) => {
        const inp = el("iv-input");
        if (inp) { inp.value = hasil; inp.disabled = true; }
        if (btnMic) btnMic.innerText = "✔ Selesai";
        const benar = InterviewData.cekBenar(hasil, item);
        tambahSkor(benar);
        this._tampilHasil(benar, item, hasil);
      },
      err => { setTeks("hasil-box", "❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Jawab Suara"; } },
      dapat => { if (!dapat) { setTeks("hasil-box", "⚠️ Tidak terdeteksi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Jawab Suara"; } } }
    );
  },

  _tampilHasil(benar, item, inputUser) {
    this._transisi = true;
    const k = this._cfg.tampilK;
    let kunciHtml = "";
    if (k.has("hanzi") && item.aHanzi) kunciHtml += `<div class="sv-info-row"><b>🈯 Hanzi:</b> ${item.aHanzi} <button class="btn-audio-kecil" onclick="TTS.mandarin('${InterviewData.esc(item.aHanzi)}')">🔊</button></div>`;
    if (k.has("pinyin") && item.aPinyin) kunciHtml += `<div class="sv-info-row"><b>🔤 Pinyin:</b> ${item.aPinyin}</div>`;
    if (k.has("indo") && item.aIndo) kunciHtml += `<div class="sv-info-row"><b>🇮🇩 Indonesia:</b> ${item.aIndo}</div>`;

    const isGame = this._cfg.gameMode !== "off";
    const gameNote = (!benar && isGame) ? `
      <div style="margin:8px 0;padding:8px 12px;background:#fff3e0;border-left:3px solid #ff9800;border-radius:6px;font-size:13px;color:#e65100">
        🎮 Soal ini akan diulang sampai kamu jawab benar.
      </div>` : "";

    const showManualBtn = !this._cfg.autoLanjut;

    const hEl = el("hasil-box");
    if (hEl) {
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
      hEl.innerHTML = `
        <div class="sv-hasil-status ${benar ? "sv-benar-status" : "sv-salah-status"}">${benar ? "✅ Benar! Bagus sekali!" : "❌ Kurang tepat."}</div>
        ${inputUser ? `<div style="font-size:12px;color:#78909c;margin-bottom:4px">Jawabanmu: "${InterviewData.esc2(inputUser)}"</div>` : ""}
        ${gameNote}
        <div class="sv-info-kalimat">${kunciHtml || "<i>(tidak ada kunci dipilih)</i>"}</div>
        ${showManualBtn ? `<div class="btn-row" style="margin-top:10px"><button class="btn btn-biru" onclick="Interview._manualLanjut()">→ Lanjut</button></div>` : ""}
      `;
    }
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    this._nextOrRetry(benar);
  },

  _nextOrRetry(benar) {
    const cfg = this._cfg;
    if (cfg.gameMode === "off") {
      this._scheduleNext(benar, () => { this.idx++; this.tampilSoal(); });
      return;
    }
    if (!benar) {
      this._retryFlag = true;
      this._scheduleNext(false, () => { this.tampilSoal(); });
      return;
    }
    if (this._retryFlag) {
      this._retryFlag = false;
      let tuju = this.idx + 1;
      if (cfg.gameMode === "mundur2") tuju = Math.max(0, this.idx - 2);
      else if (cfg.gameMode === "awal") tuju = 0;
      this._scheduleNext(true, () => { this.idx = tuju; this.tampilSoal(); });
    } else {
      this._scheduleNext(true, () => { this.idx++; this.tampilSoal(); });
    }
  },

  _scheduleNext(benar, fn) {
    if (this._cfg.autoLanjut) {
      const delay = benar ? 1500 : Math.max(1500, this._cfg.autoDelay * 1000);
      setTimeout(fn, delay);
    } else {
      this._pendingNext = fn;
    }
  },

  _manualLanjut() {
    if (this._pendingNext) { const fn = this._pendingNext; this._pendingNext = null; fn(); }
  },

  _skip() {
    if (this._transisi) return;
    this._transisi = true;
    const item = this.soalList[this.idx];
    tambahSkor(false);
    const hEl = el("hasil-box");
    if (hEl) {
      hEl.className = "hasil-box salah";
      hEl.innerHTML = `⏭ Di-skip.<br>Jawaban: <b>${item.aHanzi || item.aIndo}</b>`;
    }
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    this._retryFlag = false;
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
  },

  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    if (typeof App !== "undefined" && App.catatSesiSelesai) App.catatSesiSelesai("sentence", sesiSkor.benar, sesiSkor.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Sesi Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
          <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px">
          <button class="btn btn-hijau" onclick="Interview.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="Interview.kembaliMenu()">← Menu Interview</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = InterviewHub.renderMenu();
  },
};

// ================================================================
//  SHARED AI ENGINE (dipakai InterviewCall & InterviewChat)
// ================================================================
var InterviewAI = {
  // Ambil topik pertanyaan dari data spreadsheet untuk jadi konteks AI
  buildTopikContext(data, n = 10) {
    return acak(data).slice(0, n).map(d =>
      `- ${d.qHanzi}${d.qPinyin ? " (" + d.qPinyin + ")" : ""} = ${d.qIndo}`
    ).join("\n");
  },

  async call(messages, maxTokens = 700) {
    // Pakai infrastruktur Gemini yang sudah ada di SentenceVocab (API key sama)
    return SentenceVocab._callAI(messages, maxTokens);
  },

  getApiKey() { return SentenceVocab._getApiKey(); },

  parseJSON(rawText) {
    try {
      const clean = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(clean);
    } catch (e) {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
      throw new Error("Gagal parse JSON dari AI. Response: " + rawText.slice(0, 300));
    }
  },
};

// ================================================================
//  2) INTERVIEWCALL — Simulasi Telepon Interview dengan AI
// ================================================================
var InterviewCall = {

  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin"]),  // hanzi | pinyin | indo — teks yang ditampilkan di bawah gelembung AI
    totalTanya: 5,
    koreksiRounds: 1,      // 1 = langsung lanjut, 2/3 = tetap di pertanyaan sama sampai N kali jawab (kecuali sudah benar)
  },

  _state: {
    aktif: false,
    berakhir: false,
    history: [],          // {role:'user'|'model', text}
    topikPool: [],
    jumlahTanya: 0,
    putaran: 0,            // percobaan ke-berapa untuk pertanyaan yang sedang berjalan
    sedangProses: false,
  },

  renderMenu() {
    const c = this._cfg;
    const chip = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="InterviewCall._toggle('${key}')">${label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">📞</div>
          <div>
            <div class="sv-title">Telepon Interview AI</div>
            <div class="sv-subtitle">AI menelepon & mewawancarai kamu secara real-time</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info yang ditampilkan saat AI "bicara" (audio selalu aktif):</div>
          <div class="sv-chips" id="ivc-chips">
            ${chip("hanzi", "🈯 Hanzi")}
            ${chip("pinyin", "🔤 Pinyin")}
            ${chip("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔢 Jumlah Pertanyaan: <b id="ivc-total-label">${c.totalTanya}</b></div>
          <input type="range" min="3" max="12" value="${c.totalTanya}" oninput="InterviewCall._setTotal(this.value)" style="width:100%;accent-color:#1565c0">
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">🔁 Sebelum Lanjut ke Pertanyaan Berikutnya</div>
          <div class="sv-chips" id="ivc-koreksi-chips">
            <button class="sv-chip ${c.koreksiRounds === 1 ? "aktif" : ""}" onclick="InterviewCall._setKoreksi(1)">➡️ Langsung</button>
            <button class="sv-chip ${c.koreksiRounds === 2 ? "aktif" : ""}" onclick="InterviewCall._setKoreksi(2)">🔁 2x Jawab</button>
            <button class="sv-chip ${c.koreksiRounds === 3 ? "aktif" : ""}" onclick="InterviewCall._setKoreksi(3)">🔁 3x Jawab</button>
          </div>
          <div style="font-size:11px;color:#78909c;margin-top:6px">Jika dipilih 2x/3x: AI fokus mengoreksi & memintamu mencoba lagi pada pertanyaan yang sama selama jawabanmu belum tepat, baru lanjut ke pertanyaan baru setelah mencoba sejumlah itu — kecuali jawabanmu sudah benar, maka langsung lanjut.</div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="password" id="ivc-api-key-input" placeholder="Masukkan Gemini API key..." value="${InterviewAI.getApiKey()}"
              style="flex:1;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
              oninput="SentenceVocab._setApiKey(this.value)">
          </div>
          <div style="font-size:11px;color:#888;margin-top:5px">Key sama dipakai di semua fitur AI (tersimpan di browser saja).</div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="InterviewCall.mulai()">📞 Mulai Panggilan</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="InterviewCall.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggle(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("ivc-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi","pinyin","indo"][i])));
  },
  _setTotal(v) {
    this._cfg.totalTanya = parseInt(v);
    const lbl = el("ivc-total-label"); if (lbl) lbl.textContent = v;
  },
  _setKoreksi(v) {
    this._cfg.koreksiRounds = v;
    const wrap = el("ivc-koreksi-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", [1,2,3][i] === v));
  },

  async mulai() {
    if (!InterviewAI.getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">📞 Menyiapkan panggilan...</div>
      </div>`;
    const data = await InterviewData.ambil();
    if (!data.length) { tampilToast("⚠️ Data sheet 'interview' kosong."); this.kembaliMenu(); return; }

    const s = this._state;
    s.aktif = true; s.berakhir = false; s.history = [];
    s.topikPool = data; s.jumlahTanya = 0; s.putaran = 0; s.sedangProses = false;

    this._renderCallUI();
    await this._giliranAI(true);
  },

  _systemPrompt() {
    const topik = InterviewAI.buildTopikContext(this._state.topikPool, 10);
    const rounds = this._cfg.koreksiRounds;
    const aturanLanjut = rounds > 1
      ? `- Setiap giliran, kamu akan diberi tahu apakah kamu WAJIB TETAP di pertanyaan yang sama atau BOLEH PINDAH ke pertanyaan baru — ikuti instruksi itu dengan patuh.
- Saat diberi tahu WAJIB TETAP: JANGAN mengajukan pertanyaan baru. Fokus penuh mengoreksi/menjelaskan kekurangan jawaban kandidat, lalu minta kandidat mencoba menjawab ULANG pertanyaan yang sama (boleh beri clue tambahan).
- Kecualinya: jika jawaban kandidat menurutmu SUDAH benar/tepat secara memadai walau instruksi bilang WAJIB TETAP, kamu tetap BOLEH langsung pindah ke pertanyaan baru — set "cocok": true.
- Saat diberi tahu BOLEH PINDAH: beri koreksi singkat atas jawaban terakhir, lalu ajukan pertanyaan baru.`
      : `- Setiap giliran berikan koreksi singkat atas jawaban kandidat sebelumnya, lalu langsung lanjut ke pertanyaan baru.`;
    return `Kamu adalah seorang pewawancara (interviewer) HR yang sedang menelepon kandidat untuk latihan wawancara kerja berbahasa Mandarin.
Gunakan tema/gaya pertanyaan berikut sebagai referensi (boleh dimodifikasi agar terasa alami dan mengalir sebagai percakapan telepon):
${topik}

Aturan:
- Ajukan HANYA SATU pertanyaan per giliran (kecuali sedang diminta tetap di pertanyaan yang sama, lihat di bawah).
- Jika ini bukan giliran pertama, berikan dulu koreksi/masukan singkat (1-2 kalimat, bahasa Indonesia) atas jawaban kandidat sebelumnya.
${aturanLanjut}
- Isi selalu field "cocok": true jika jawaban kandidat yang barusan dinilai SUDAH benar/tepat secara memadai (grammar & makna sesuai), false jika masih ada kekurangan berarti. Saat giliran pertama, set "cocok": false.
- Total wawancara sekitar ${this._cfg.totalTanya} pertanyaan (dihitung dari pertanyaan baru, bukan pengulangan). Setelah tercapai, akhiri panggilan dengan ucapan penutup ramah dan set "akhiri": true.
- Nada bicara sopan, natural, seperti telepon interview sungguhan.

Balas HANYA dengan JSON valid (tanpa markdown/komentar):
{
  "hanzi": "ucapan AI dalam Hanzi",
  "pinyin": "pinyin bertanda nada",
  "indonesia": "terjemahan bahasa Indonesia",
  "koreksi": "koreksi singkat atas jawaban user sebelumnya, atau string kosong jika giliran pertama",
  "cocok": false,
  "akhiri": false
}`;
  },

  async _giliranAI(pertama) {
    const s = this._state;
    const cfg = this._cfg;
    s.sedangProses = true;
    this._tampilStatus("📞 AI sedang bicara...");
    try {
      const messages = [{ role: "user", content: this._systemPrompt() }];
      for (const h of s.history) messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });

      let attemptNumber = 0, wajibPindah = true;
      if (!pertama) {
        attemptNumber = s.putaran + 1;
        wajibPindah = attemptNumber >= cfg.koreksiRounds;
        const instruksi = wajibPindah
          ? `(Beri koreksi singkat atas jawaban kandidat barusan, lalu kamu BOLEH PINDAH ke pertanyaan baru.)`
          : `(Ini percobaan ke-${attemptNumber} dari ${cfg.koreksiRounds} untuk pertanyaan yang sama. Kamu WAJIB TETAP di pertanyaan ini — jangan ajukan pertanyaan baru dulu, fokus koreksi & minta kandidat mencoba lagi. KECUALI jawabannya sudah benar/tepat, maka boleh set "cocok": true dan pindah ke pertanyaan baru.)`;
        messages.push({ role: "user", content: instruksi });
      }

      const raw = await InterviewAI.call(messages, 500);
      const parsed = InterviewAI.parseJSON(raw);
      s.history.push({ role: "model", text: JSON.stringify(parsed) });

      const pindahTopik = pertama || wajibPindah || parsed.cocok === true;
      if (pindahTopik) { s.jumlahTanya++; s.putaran = 0; }
      else { s.putaran = attemptNumber; }

      this._tampilGiliranAI(parsed);
      if (parsed.akhiri || s.jumlahTanya > cfg.totalTanya) {
        s.berakhir = true;
      }
    } catch (e) {
      this._tampilStatus("❌ " + e.message);
    }
    s.sedangProses = false;
  },

  _renderCallUI() {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">📞 Panggilan Interview AI</div>
        <div id="ivc-status" style="text-align:center;color:#546e7a;font-size:13px;margin-bottom:8px">Menyambungkan...</div>
        <div id="ivc-transcript" class="sv-chat-area" style="max-height:280px"></div>
        <div id="ivc-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar wawancara, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="ivc-tanya-input" placeholder="Misal: apa arti 面试?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')InterviewCall._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="InterviewCall._kirimTanya()">Tanya</button>
          </div>
          <div id="ivc-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-merah" onclick="InterviewCall._tutupTelepon()">📵 Tutup Telepon</button>
        </div>
      </div>`;
  },

  _tampilStatus(teks) { setTeks("ivc-status", teks); },

  _tampilGiliranAI(parsed) {
    const c = this._cfg.tampilAI;
    const area = el("ivc-transcript");
    if (area) {
      const div = document.createElement("div");
      div.className = "sv-chat-bubble sv-chat-ai";
      let info = "";
      if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${InterviewData.esc2(parsed.koreksi)}</div>`;
      if (c.has("hanzi")) info += `<div>${parsed.hanzi}</div>`;
      if (c.has("pinyin")) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin || ""}</div>`;
      if (c.has("indo")) info += `<div style="font-size:12px;color:#546e7a">${parsed.indonesia || ""}</div>`;
      div.innerHTML = `<span class="sv-chat-label">🤖 Pewawancara:</span> ${info}`;
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
    }
    TTS.mandarin(parsed.hanzi, () => this._tampilStatus(this._state.berakhir ? "📴 Panggilan berakhir" : "🎤 Giliranmu menjawab"));

    if (this._state.berakhir) {
      setHTML("ivc-input-area", "");
      setTimeout(() => this._tampilSelesai(), 1200);
      return;
    }
    this._renderInputArea();
  },

  _renderInputArea() {
    setHTML("ivc-input-area", `
      <textarea id="ivc-input" class="input-jawab" rows="2" placeholder="Ketik jawabanmu, atau pakai mic..."></textarea>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-hijau" onclick="InterviewCall._jawabTeks()">✅ Kirim</button>
        <button class="btn btn-merah" id="ivc-btn-mic" onclick="InterviewCall._jawabSuara()">🎤 Bicara</button>
      </div>`);
  },

  _tambahUserBubble(teks) {
    const area = el("ivc-transcript");
    if (!area) return;
    const div = document.createElement("div");
    div.className = "sv-chat-bubble sv-chat-user";
    div.innerHTML = `<span class="sv-chat-label">👤 Kamu:</span> ${InterviewData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  async _jawabTeks() {
    const inp = el("ivc-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks || this._state.sedangProses) return;
    this._tambahUserBubble(teks);
    this._state.history.push({ role: "user", text: teks });
    setHTML("ivc-input-area", "");
    await this._giliranAI(false);
  },

  _jawabSuara() {
    const btnMic = el("ivc-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    this._tampilStatus("🎙️ Silakan bicara...");
    STT.mulai("zh-CN",
      async (hasil) => {
        this._tambahUserBubble(hasil);
        this._state.history.push({ role: "user", text: hasil });
        setHTML("ivc-input-area", "");
        await this._giliranAI(false);
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
    const inp = el("ivc-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("ivc-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan wawancara kerja lewat telepon simulasi.
Siswa bertanya hal DI LUAR pertanyaan wawancara yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk pertanyaan wawancara, jadi jangan anggap sebagai jawaban wawancara.
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await InterviewAI.call(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${InterviewData.esc2(teks)}</b></div><div>💡 ${InterviewData.esc2(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },

  _tampilSelesai() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">📴</div>
        <h2>Panggilan Selesai</h2>
        <div style="font-size:13px;color:#546e7a;margin:10px 0">Kamu menjawab ${this._state.history.filter(h=>h.role==="user").length} pertanyaan dalam simulasi ini.</div>
        <div class="btn-row" style="justify-content:center;margin-top:20px">
          <button class="btn btn-hijau" onclick="InterviewCall.mulai()">🔄 Telepon Lagi</button>
          <button class="btn btn-biru" onclick="InterviewCall.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = InterviewHub.renderMenu();
  },
};

// ================================================================
//  3) INTERVIEWCHAT — Chat Teks/Suara dengan AI, dikoreksi AI
// ================================================================
var InterviewChat = {

  _cfg: {
    tampilAI: new Set(["hanzi", "pinyin", "indo"]),  // apa yg ditampilkan dari pesan AI
    aiSuara: true,          // AI kirim pesan pakai suara (TTS) juga
    caraJawab: "ketik",     // "ketik" | "suara"
    koreksiRounds: 1,       // 1 = langsung lanjut, 2/3 = tetap di topik sama sampai N kali jawab (kecuali sudah benar)
  },

  _state: { history: [], sedangProses: false, topikPool: [], putaran: 0 },

  renderMenu() {
    const c = this._cfg;
    const chip = (key, label) => `
      <button class="sv-chip ${c.tampilAI.has(key) ? "aktif" : ""}" onclick="InterviewChat._toggle('${key}')">${label}</button>`;
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">💬</div>
          <div>
            <div class="sv-title">Chat Interview AI</div>
            <div class="sv-subtitle">Ngobrol bebas seputar topik interview, dikoreksi AI</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Info pesan AI yang ditampilkan:</div>
          <div class="sv-chips" id="ivh-chips">
            ${chip("hanzi", "🈯 Hanzi")}
            ${chip("pinyin", "🔤 Pinyin")}
            ${chip("indo", "🇮🇩 Terjemahan")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔊 Pesan AI pakai suara juga?</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.aiSuara ? "aktif" : ""}" id="ivh-suara-ya" onclick="InterviewChat._setSuara(true)">🔊 Ya</button>
            <button class="sv-chip ${!c.aiSuara ? "aktif" : ""}" id="ivh-suara-tidak" onclick="InterviewChat._setSuara(false)">🚫 Teks saja</button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">✏️ Cara Kamu Menjawab:</div>
          <div class="sv-chips">
            <button class="sv-chip ${c.caraJawab === "ketik" ? "aktif" : ""}" id="ivh-jawab-ketik" onclick="InterviewChat._setJawab('ketik')">⌨️ Ketik</button>
            <button class="sv-chip ${c.caraJawab === "suara" ? "aktif" : ""}" id="ivh-jawab-suara" onclick="InterviewChat._setJawab('suara')">🎤 Suara</button>
          </div>
        </div>

        <div class="sv-section" style="padding:10px;background:#f3e5f5;border-radius:8px;border-left:3px solid #9c27b0">
          <div style="font-size:13px;color:#6a1b9a;font-weight:600;margin-bottom:8px">🔁 Sebelum Lanjut ke Topik/Pertanyaan Berikutnya</div>
          <div class="sv-chips" id="ivh-koreksi-chips">
            <button class="sv-chip ${c.koreksiRounds === 1 ? "aktif" : ""}" onclick="InterviewChat._setKoreksi(1)">➡️ Langsung</button>
            <button class="sv-chip ${c.koreksiRounds === 2 ? "aktif" : ""}" onclick="InterviewChat._setKoreksi(2)">🔁 2x Jawab</button>
            <button class="sv-chip ${c.koreksiRounds === 3 ? "aktif" : ""}" onclick="InterviewChat._setKoreksi(3)">🔁 3x Jawab</button>
          </div>
          <div style="font-size:11px;color:#78909c;margin-top:6px">Jika dipilih 2x/3x: AI fokus mengoreksi & memintamu mencoba lagi pada topik yang sama selama jawabanmu belum tepat, baru lanjut ke topik baru setelah mencoba sejumlah itu — kecuali jawabanmu sudah benar, maka langsung lanjut.</div>
        </div>

        <div class="sv-section" style="padding:10px;background:#fff8e1;border-radius:8px;border-left:3px solid #ffa000">
          <div style="font-size:13px;color:#5d4037;font-weight:600;margin-bottom:6px">🔑 Gemini API Key</div>
          <input type="password" id="ivh-api-key-input" placeholder="Masukkan Gemini API key..." value="${InterviewAI.getApiKey()}"
            style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ffa000;border-radius:6px;font-size:13px;outline:none"
            oninput="SentenceVocab._setApiKey(this.value)">
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px" onclick="InterviewChat.mulai()">🚀 Mulai Chat</button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px" onclick="InterviewChat.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  _toggle(key) {
    const s = this._cfg.tampilAI;
    if (s.has(key)) { if (s.size === 1) { tampilToast("Pilih minimal 1!"); return; } s.delete(key); }
    else s.add(key);
    const wrap = el("ivh-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", s.has(["hanzi","pinyin","indo"][i])));
  },
  _setSuara(v) {
    this._cfg.aiSuara = v;
    const ya = el("ivh-suara-ya"), tidak = el("ivh-suara-tidak");
    if (ya) ya.classList.toggle("aktif", v);
    if (tidak) tidak.classList.toggle("aktif", !v);
  },
  _setJawab(v) {
    this._cfg.caraJawab = v;
    const a = el("ivh-jawab-ketik"), b = el("ivh-jawab-suara");
    if (a) a.classList.toggle("aktif", v === "ketik");
    if (b) b.classList.toggle("aktif", v === "suara");
  },
  _setKoreksi(v) {
    this._cfg.koreksiRounds = v;
    const wrap = el("ivh-koreksi-chips");
    if (wrap) wrap.querySelectorAll(".sv-chip").forEach((btn, i) => btn.classList.toggle("aktif", [1,2,3][i] === v));
  },

  async mulai() {
    if (!InterviewAI.getApiKey()) { tampilToast("⚠️ Masukkan Gemini API key dulu!"); return; }
    el("konten-utama").innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">Menyiapkan chat...</div>
      </div>`;
    const data = await InterviewData.ambil();
    if (!data.length) { tampilToast("⚠️ Data sheet 'interview' kosong."); this.kembaliMenu(); return; }
    this._state.topikPool = data;
    this._state.history = [];
    this._state.putaran = 0;
    this._renderChatUI();
    await this._giliranAI(true);
  },

  _systemPrompt() {
    const topik = InterviewAI.buildTopikContext(this._state.topikPool, 10);
    const rounds = this._cfg.koreksiRounds;
    const aturanLanjut = rounds > 1
      ? `- Setiap giliran, kamu akan diberi tahu apakah kamu WAJIB TETAP di topik/pertanyaan yang sama atau BOLEH PINDAH ke topik baru — ikuti instruksi itu dengan patuh.
- Saat diberi tahu WAJIB TETAP: JANGAN memberi topik/pertanyaan baru. Fokus penuh mengoreksi/menjelaskan kekurangan jawaban siswa, lalu minta siswa mencoba menjawab ULANG hal yang sama (boleh beri clue tambahan).
- Kecualinya: jika jawaban siswa menurutmu SUDAH benar/tepat secara memadai walau instruksi bilang WAJIB TETAP, kamu tetap BOLEH langsung lanjut ke topik baru — set "cocok": true.
- Saat diberi tahu BOLEH PINDAH: beri koreksi singkat atas jawaban terakhir, lalu lanjutkan obrolan dengan topik/pertanyaan baru.`
      : `- Jika bukan giliran pertama, berikan koreksi singkat & jelas atas jawaban siswa sebelumnya, lalu langsung lanjutkan obrolan dengan pertanyaan/topik baru.`;
    return `Kamu adalah partner latihan interview kerja berbahasa Mandarin yang ramah, mengobrol santai lewat chat dengan siswa.
Gunakan tema pertanyaan berikut sebagai inspirasi topik obrolan (boleh dikembangkan bebas, tidak harus persis sama):
${topik}

Aturan:
- Kirim SATU pesan per giliran: bisa berupa pertanyaan lanjutan, komentar, atau koreksi.
- Jika bukan giliran pertama, berikan koreksi singkat & jelas (bahasa Indonesia) terhadap jawaban siswa sebelumnya (grammar/pilihan kata/kewajaran kalimat).
${aturanLanjut}
- Isi selalu field "cocok": true jika jawaban siswa yang barusan dinilai SUDAH benar/tepat secara memadai, false jika masih ada kekurangan berarti. Saat giliran pertama, set "cocok": false.
- Nada natural seperti chat sehari-hari, tidak kaku.

Balas HANYA dengan JSON valid (tanpa markdown/komentar):
{
  "hanzi": "isi pesan dalam Hanzi",
  "pinyin": "pinyin bertanda nada",
  "indonesia": "terjemahan bahasa Indonesia",
  "koreksi": "koreksi singkat, atau string kosong jika giliran pertama",
  "cocok": false
}`;
  },

  _renderChatUI() {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">💬 Chat Interview AI</div>
        <div id="ivh-chat-area" class="sv-chat-area" style="max-height:320px"></div>
        <div id="ivh-input-area"></div>
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:#e3f2fd;border-radius:8px">
          <div style="font-size:12px;color:#0d47a1;font-weight:600;margin-bottom:4px">❓ Tanya AI (di luar obrolan, mis. arti sebuah hanzi)</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="ivh-tanya-input" placeholder="Misal: apa arti 面试?" style="flex:1;min-width:0;padding:7px 9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')InterviewChat._kirimTanya()">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="InterviewChat._kirimTanya()">Tanya</button>
          </div>
          <div id="ivh-tanya-hasil" style="font-size:12px;color:#37474f;margin-top:6px"></div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="InterviewChat.kembaliMenu()">← Selesai & Keluar</button>
        </div>
      </div>`;
  },

  async _giliranAI(pertama) {
    const s = this._state;
    const cfg = this._cfg;
    s.sedangProses = true;
    this._appendChat("ai", "⏳ Sedang mengetik...", "sv-chat-ai-loading");
    try {
      const messages = [{ role: "user", content: this._systemPrompt() }];
      for (const h of s.history) messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });

      let attemptNumber = 0, wajibPindah = true;
      if (!pertama) {
        attemptNumber = s.putaran + 1;
        wajibPindah = attemptNumber >= cfg.koreksiRounds;
        const instruksi = wajibPindah
          ? `(Beri koreksi singkat atas jawaban barusan, lalu kamu BOLEH PINDAH ke topik/pertanyaan baru.)`
          : `(Ini percobaan ke-${attemptNumber} dari ${cfg.koreksiRounds} untuk hal yang sama. Kamu WAJIB TETAP di topik ini — jangan beri topik baru dulu, fokus koreksi & minta siswa mencoba lagi. KECUALI jawabannya sudah benar/tepat, maka boleh set "cocok": true dan lanjut ke topik baru.)`;
        messages.push({ role: "user", content: instruksi });
      }

      const raw = await InterviewAI.call(messages, 500);
      const parsed = InterviewAI.parseJSON(raw);
      s.history.push({ role: "model", text: JSON.stringify(parsed) });

      const pindahTopik = pertama || wajibPindah || parsed.cocok === true;
      s.putaran = pindahTopik ? 0 : attemptNumber;

      this._updateLastAI(parsed);
      if (cfg.aiSuara) TTS.mandarin(parsed.hanzi);
    } catch (e) {
      this._updateLastAI({ hanzi: "", pinyin: "", indonesia: "", koreksi: "", _error: e.message });
    }
    s.sedangProses = false;
    this._renderInputArea();
  },

  _bubbleAIHtml(parsed) {
    if (parsed._error) return `<span style="color:#c62828">❌ ${InterviewData.esc2(parsed._error)}</span>`;
    const c = this._cfg.tampilAI;
    let info = "";
    if (parsed.koreksi) info += `<div style="font-size:12px;color:#e65100;margin-bottom:4px">💡 ${InterviewData.esc2(parsed.koreksi)}</div>`;
    if (c.has("hanzi")) info += `<div>${parsed.hanzi} <button class="btn-audio-kecil" onclick="TTS.mandarin('${InterviewData.esc(parsed.hanzi)}')">🔊</button></div>`;
    if (c.has("pinyin")) info += `<div style="font-size:12px;color:#0277bd">${parsed.pinyin || ""}</div>`;
    if (c.has("indo")) info += `<div style="font-size:12px;color:#546e7a">${parsed.indonesia || ""}</div>`;
    return `<span class="sv-chat-label">🤖 Partner:</span> ${info}`;
  },

  _appendChat(role, teks, extraClass = "") {
    const area = el("ivh-chat-area");
    if (!area) return;
    const div = document.createElement("div");
    div.className = `sv-chat-bubble sv-chat-${role} ${extraClass}`;
    div.innerHTML = role === "ai"
      ? `<span class="sv-chat-label">🤖 Partner:</span> ${teks}`
      : `<span class="sv-chat-label">👤 Kamu:</span> ${InterviewData.esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  _updateLastAI(parsed) {
    const area = el("ivh-chat-area");
    if (!area) return;
    const loading = area.querySelector(".sv-chat-ai-loading");
    const html = this._bubbleAIHtml(parsed);
    if (loading) { loading.className = "sv-chat-bubble sv-chat-ai"; loading.innerHTML = html; }
    else this._appendChat("ai", html);
    area.scrollTop = area.scrollHeight;
  },

  _renderInputArea() {
    if (this._cfg.caraJawab === "ketik") {
      setHTML("ivh-input-area", `
        <div class="sv-tanya-input-wrap" style="margin-top:8px">
          <input type="text" id="ivh-input" placeholder="Ketik balasanmu..." onkeydown="if(event.key==='Enter')InterviewChat._jawabTeks()">
          <button onclick="InterviewChat._jawabTeks()">Kirim</button>
        </div>`);
      setTimeout(() => { const i = el("ivh-input"); if (i) i.focus(); }, 100);
    } else {
      setHTML("ivh-input-area", `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-merah" id="ivh-btn-mic" onclick="InterviewChat._jawabSuara()">🎤 Bicara</button>
        </div>`);
    }
  },

  async _jawabTeks() {
    if (this._state.sedangProses) return;
    const inp = el("ivh-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    inp.value = "";
    this._appendChat("user", teks);
    this._state.history.push({ role: "user", text: teks });
    setHTML("ivh-input-area", "");
    await this._giliranAI(false);
  },

  _jawabSuara() {
    if (this._state.sedangProses) return;
    const btnMic = el("ivh-btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    STT.mulai("zh-CN",
      async (hasil) => {
        this._appendChat("user", hasil);
        this._state.history.push({ role: "user", text: hasil });
        setHTML("ivh-input-area", "");
        await this._giliranAI(false);
      },
      err => { tampilToast("❌ Error mic: " + err); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } },
      dapat => { if (!dapat) { tampilToast("⚠️ Tidak terdeteksi."); if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Bicara"; } } }
    );
  },

  kembaliMenu() {
    TTS.berhenti(); if (window.STT) STT.berhenti();
    el("konten-utama").innerHTML = InterviewHub.renderMenu();
  },

  async _kirimTanya() {
    const inp = el("ivh-tanya-input");
    const teks = inp ? inp.value.trim() : "";
    if (!teks) return;
    const hasilEl = el("ivh-tanya-hasil");
    if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
    if (inp) inp.disabled = true;
    try {
      const messages = [{
        role: "user",
        content: `Kamu adalah asisten bahasa Mandarin yang membantu siswa yang sedang latihan chat interview kerja berbahasa Mandarin.
Siswa bertanya hal DI LUAR obrolan interview yang sedang berjalan — misalnya arti sebuah hanzi/kata, cara baca (pinyin), atau tata bahasa. Ini BUKAN jawaban untuk pertanyaan dalam chat, jadi jangan anggap sebagai balasan chat.
Jawab singkat, jelas, dalam Bahasa Indonesia. Sertakan Hanzi & pinyin jika relevan.

Pertanyaan siswa: "${teks}"`
      }];
      const raw = await InterviewAI.call(messages, 300);
      if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${InterviewData.esc2(teks)}</b></div><div>💡 ${InterviewData.esc2(raw.trim())}</div>`;
    } catch (e) {
      if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
    }
    if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
  },
};
