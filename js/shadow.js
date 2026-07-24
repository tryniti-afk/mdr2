// ================================================================
//  SHADOW.JS — Fitur "Shadowing" (dipakai Vocab & Sentence)
//    1. Audio diputar (hanzi/pinyin bebas tampil/sembunyi)
//    2. User menirukan via mic → ditranskrip (STT) → dibanding teks asli
//       → kata/karakter yang meleset ditandai
//    3. Opsional: rekam ulang khusus untuk grafik kontur nada per kalimat
// ================================================================

var ShadowModule = {
  ctx: "vocab",           // "vocab" | "sentence"
  disp: { hanzi: true, pinyin: true },
  pakaiKontur: false,
  soalList: [],
  idx: 0,

  // ── ENTRY POINTS ─────────────────────────────────────────────
  bukaVocab() { this.ctx = "vocab"; el("konten-utama").innerHTML = this.renderSetup(); },
  bukaSentence() { this.ctx = "sentence"; el("konten-utama").innerHTML = this.renderSetup(); },

  renderSetup() {
    const modulLabel = this.ctx === "vocab" ? "Vocabulary" : "Sentence";
    return `
      <div class="soal-wrap">
        <div class="label-mode">🗣️ Shadowing — ${modulLabel}</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">Dengar audio, tirukan langsung, lalu lihat kata mana yang meleset.</div>
        <div class="sub-menu-grid" id="shadow-disp-grid">
          ${this._card("hanzi", "🈯", "Hanzi", "Tampilkan teks Hanzi")}
          ${this._card("pinyin", "🔤", "Pinyin", "Tampilkan Pinyin")}
        </div>
        <div class="sub-card ${this.pakaiKontur ? "sub-card-aktif" : ""}" style="margin-top:10px" onclick="ShadowModule._toggleKontur()">
          <div class="sub-icon">🎵</div>
          <div class="sub-label">Sertakan Grafik Kontur Nada</div>
          <div class="sub-desc">${this.pakaiKontur ? "Aktif — ada rekaman tambahan per kalimat" : "Nonaktif — hanya cek teks lewat STT"}</div>
        </div>
        ${renderKontrolLanjut("ShadowModule._renderUlangSetup")}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="ShadowModule.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="${this.ctx === "vocab" ? "Vocab.kembaliMenu()" : "Sentence.kembaliMenu()"}">← Batal</button>
        </div>
      </div>`;
  },
  _renderUlangSetup() { el("konten-utama").innerHTML = ShadowModule.renderSetup(); },
  _card(key, icon, label, desc) {
    const aktif = this.disp[key];
    return `
      <div class="sub-card ${aktif ? "sub-card-aktif" : ""}" onclick="ShadowModule._toggleDisp('${key}')">
        <div class="sub-icon">${icon}</div>
        <div class="sub-label">${label}</div>
        <div class="sub-desc">${desc} — ${aktif ? "ON" : "OFF"}</div>
      </div>`;
  },
  _toggleDisp(key) {
    this.disp[key] = !this.disp[key];
    setHTML("shadow-disp-grid", `${this._card("hanzi","🈯","Hanzi","Tampilkan teks Hanzi")}${this._card("pinyin","🔤","Pinyin","Tampilkan Pinyin")}`);
  },
  _toggleKontur() {
    this.pakaiKontur = !this.pakaiKontur;
    el("konten-utama").innerHTML = this.renderSetup();
  },

  // ── MULAI ────────────────────────────────────────────────────
  async mulai() {
    resetSkor();
    this.idx = 0;
    setHTML("konten-utama", `<div class="soal-wrap"><div class="label-mode">Menyiapkan soal...</div></div>`);
    if (this.ctx === "vocab") {
      const kata = await VocabAIData.ambilKata(10);
      this.soalList = kata.filter(k => k.hanzi);
    } else {
      let pool = [];
      try { pool = await SetSoal.getSoalSiap("sentence"); } catch (e) {}
      if (!pool.length && typeof DB !== "undefined") pool = DB.sentences.map(s => ({ hanzi: s.hanzi, pinyin: s.pinyin, arti: s.arti }));
      this.soalList = acak(pool).slice(0, 8);
    }
    if (!this.soalList.length) { tampilToast("⚠️ Data soal kosong."); el("konten-utama").innerHTML = this.renderSetup(); return; }
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this._selesai(); return; }
    const item = this.soalList[this.idx];
    let teksHTML = "";
    if (this.disp.hanzi) teksHTML += `<div class="soal-kalimat">${item.hanzi}</div>`;
    if (this.disp.pinyin) teksHTML += `<div class="soal-pinyin-hint">${item.pinyin || ""}</div>`;
    if (!teksHTML) teksHTML = `<div class="soal-teks-indo" style="font-style:italic">(teks disembunyikan — dengar audio saja)</div>`;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Soal ${this.idx + 1}/${this.soalList.length}</div>
          <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
        </div>
        <div class="label-mode">🗣️ Shadowing — tirukan setelah dengar</div>
        <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${ShadowModule._esc(item.hanzi)}')">🔊 Putar Audio</button></div>
        ${teksHTML}
        <div class="hasil-box" id="hasil-shadow" style="display:none"></div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-shadow-rec" onclick="ShadowModule._rekamTeks()">🎤 Rekam & Bandingkan Teks</button>
          <button class="btn btn-kuning" onclick="ShadowModule._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="ShadowModule.kembaliMenu()">← Menu</button>
        </div>
        ${this.pakaiKontur ? `<div class="btn-row" id="shadow-kontur-row" style="margin-top:6px"><button class="btn btn-ungu" onclick="ShadowModule._rekamKontur()">🎵 Rekam untuk Grafik Nada</button></div>` : ""}
        <div id="shadow-kontur-hasil"></div>
      </div>`;
    setTimeout(() => TTS.mandarin(item.hanzi), 350);
  },

  // ── REKAM & BANDING TEKS (STT) ──────────────────────────────
  _rekamTeks() {
    const btn = el("btn-shadow-rec");
    const item = this.soalList[this.idx];
    btn.disabled = true; btn.innerText = "🎙️ Mendengarkan...";
    setHTML("hasil-shadow", "🎙️ Silakan bicara..."); el("hasil-shadow").style.display = "block"; el("hasil-shadow").className = "hasil-box info";
    STT.mulai("zh-CN",
      (hasil) => {
        const diffHTML = this._diffHanzi(item.hanzi, hasil);
        const cocokPct = this._pctCocok(item.hanzi, hasil);
        const benar = cocokPct >= 70;
        // Kalau ini pengulangan ucapan (bukan percobaan pertama), jangan hitung skor dua kali.
        if (!this._modeUlangUcap) tambahSkor(benar);
        this._modeUlangUcap = false;
        const hEl = el("hasil-shadow");
        hEl.className = "hasil-box " + (benar ? "benar" : "salah");
        hEl.innerHTML = `
          ${benar ? "✅" : "❌"} Kecocokan ~${cocokPct}%<br>
          <div style="margin-top:6px;font-size:20px;letter-spacing:1px">${diffHTML}</div>
          <div style="margin-top:6px;font-size:12px;color:#777">Hijau = cocok, merah = meleset/kurang jelas. Kamu ucapkan: "${hasil}"</div>
          <div class="btn-row" style="justify-content:center;margin-top:10px">
            <button class="btn btn-kuning" onclick="ShadowModule._ulangiUcap()">🔁 Ulangi Ucapan</button>
          </div>`;
        // Tombol rekam dikunci (bukan diberi label "Selesai" yang membingungkan) —
        // untuk mengulang pakai tombol "🔁 Ulangi Ucapan" di atas.
        btn.innerText = "✔ Terekam";
        this._timerLanjut = tampilTombolLanjut("hasil-shadow", () => { this.idx++; this.tampilSoal(); });
      },
      err => { setTeks("hasil-shadow", "❌ Error mic: " + err); btn.disabled = false; btn.innerText = "🎤 Coba Lagi"; },
      dapat => { if (!dapat) { setTeks("hasil-shadow", "⚠️ Tidak terdeteksi."); btn.disabled = false; btn.innerText = "🎤 Coba Lagi"; } }
    );
  },

  // Batalkan auto-lanjut yang berjalan lalu rekam ulang ucapan untuk soal yang sama (tanpa dobel skor).
  _ulangiUcap() {
    if (this._timerLanjut) { clearTimeout(this._timerLanjut); this._timerLanjut = null; }
    this._modeUlangUcap = true;
    this._rekamTeks();
  },


  // ── REKAM TAMBAHAN UNTUK KONTUR NADA ────────────────────────
  async _rekamKontur() {
    if (!PitchRecorder.supported()) { tampilToast("⚠️ Mic/pitch tidak didukung."); return; }
    const item = this.soalList[this.idx];
    const row = el("shadow-kontur-row");
    const btn = row?.querySelector("button");
    if (btn) { btn.disabled = true; btn.innerText = "🎙️ Merekam..."; }
    try {
      const maxMs = Math.min(8000, 1500 + item.hanzi.length * 500);
      const { contour } = await PitchRecorder.start(maxMs);
      const ref = ToneUtil.buildReferenceContour(item.pinyin || item.hanzi);
      const chars = item.hanzi.replace(/[，。！？、,\.!\?\s]/g, "").split("");
      const box = el("shadow-kontur-hasil");
      if (!contour) {
        box.innerHTML = `<div class="hasil-box salah">⚠️ Suara kurang jelas, coba lagi.</div>`;
      } else {
        const notes = ToneUtil.compareContours(contour, ref);
        box.innerHTML = `<div class="hasil-box info">${ContourChart.svg(contour, ref, { labelChars: chars })}
          <div style="margin-top:8px;text-align:left">${notes.map(n => `<div>${n}</div>`).join("")}</div></div>`;
      }
    } catch (e) {
      tampilToast("❌ " + (e.message || "Gagal merekam."));
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = "🎵 Rekam Ulang untuk Grafik Nada"; }
    }
  },

  // ── DIFF KARAKTER (LCS sederhana) ───────────────────────────
  _diffHanzi(target, spoken) {
    const t = target.replace(/[，。！？、,\.!\?\s]/g, "").split("");
    const s = (spoken || "").replace(/[，。！？、,\.!\?\s]/g, "").split("");
    // longest common subsequence utk highlight karakter yang match posisi wajar
    const m = t.length, n = s.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = t[i-1] === s[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const matched = new Array(m).fill(false);
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (t[i-1] === s[j-1]) { matched[i-1] = true; i--; j--; }
      else if (dp[i-1][j] >= dp[i][j-1]) i--; else j--;
    }
    return t.map((ch, idx) => `<span style="color:${matched[idx] ? "#388e3c" : "#f44336"};font-weight:700">${ch}</span>`).join("");
  },
  _pctCocok(target, spoken) {
    const t = target.replace(/[，。！？、,\.!\?\s]/g, "").split("");
    if (!t.length) return 0;
    const s = (spoken || "");
    let cocok = 0;
    t.forEach(ch => { if (s.includes(ch)) cocok++; });
    return Math.round((cocok / t.length) * 100);
  },
  _esc(s) { return (s || "").replace(/'/g, "\\'").replace(/\n/g, " "); },

  _skip() { tambahSkor(true); this.idx++; this.tampilSoal(); },

  _selesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    App.catatSesiSelesai(this.ctx, sesiSkor.benar, sesiSkor.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Shadowing Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Cocok: <b>${sesiSkor.benar}</b></div>
          <div>❌ Kurang cocok: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="ShadowModule.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="ShadowModule.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); STT.berhenti();
    if (this.ctx === "vocab") Vocab.kembaliMenu(); else Sentence.kembaliMenu();
  },
};
