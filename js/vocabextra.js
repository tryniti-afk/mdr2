// ================================================================
//  VOCABEXTRA.JS — 2 fitur baru di modul Vocabulary
//    A. Buat Kalimat dari 1 Kata (speaking + timer + feedback AI/Gemini)
//    B. Baca Berulang dengan Timer (speaking berulang + grafik progres waktu)
// ================================================================

// ================================================================
//  A. BUAT KALIMAT DARI 1 KATA
// ================================================================
var VocabMakeSentence = {
  disp: { audio: true, hanzi: true, pinyin: true },
  durasi: 6,          // detik, 5-8
  jumlah: 5,
  soalList: [],
  idx: 0,
  _sttResult: "",
  _sttDone: false,
  _timerDone: false,

  buka() { el("konten-utama").innerHTML = this.renderSetup(); },

  renderSetup() {
    return `
      <div class="soal-wrap">
        <div class="label-mode">✍️ Buat Kalimat dari 1 Kata</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">Kamu akan diberi 1 kata, lalu harus langsung berbicara membuat kalimat sebelum waktu habis. Hasil dinilai AI.</div>

        <div style="font-weight:700;margin:10px 0 6px">Tampilan Soal</div>
        <div class="sub-menu-grid" id="vms-disp-grid">
          ${this._card("audio", "🔊", "Audio")}
          ${this._card("hanzi", "🈯", "Hanzi")}
          ${this._card("pinyin", "🔤", "Pinyin")}
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Waktu Bicara</div>
        <div class="sub-menu-grid">
          ${[5,6,7,8].map(d => `
            <div class="sub-card ${this.durasi===d?"sub-card-aktif":""}" onclick="VocabMakeSentence._pilihDurasi(${d})">
              <div class="sub-label">${d} detik</div>
            </div>`).join("")}
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Jumlah Soal</div>
        <div class="sub-menu-grid">
          ${[3,5,8].map(n => `
            <div class="sub-card ${this.jumlah===n?"sub-card-aktif":""}" onclick="VocabMakeSentence._pilihJumlah(${n})">
              <div class="sub-label">${n} kata</div>
            </div>`).join("")}
        </div>

        ${renderKontrolLanjut("VocabMakeSentence._renderUlangSetup")}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="VocabMakeSentence.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },
  _renderUlangSetup() { el("konten-utama").innerHTML = VocabMakeSentence.renderSetup(); },
  _card(key, icon, label) {
    const aktif = this.disp[key];
    return `<div class="sub-card ${aktif?"sub-card-aktif":""}" onclick="VocabMakeSentence._toggle('${key}')">
      <div class="sub-icon">${icon}</div><div class="sub-label">${label}</div>
      <div class="sub-desc">${aktif?"ON":"OFF"}</div></div>`;
  },
  _toggle(key) {
    const n = Object.values(this.disp).filter(Boolean).length;
    if (this.disp[key] && n === 1) { tampilToast("⚠️ Minimal 1 tampilan aktif."); return; }
    this.disp[key] = !this.disp[key];
    setHTML("vms-disp-grid", `${this._card("audio","🔊","Audio")}${this._card("hanzi","🈯","Hanzi")}${this._card("pinyin","🔤","Pinyin")}`);
  },
  _pilihDurasi(d) { this.durasi = d; el("konten-utama").innerHTML = this.renderSetup(); },
  _pilihJumlah(n) { this.jumlah = n; el("konten-utama").innerHTML = this.renderSetup(); },

  async mulai() {
    if (!GeminiAPI.getKey()) {
      const k = prompt("Masukkan Gemini API key (dipakai juga oleh fitur AI lain):");
      if (k) GeminiAPI.setKey(k); else { tampilToast("⚠️ Perlu API key Gemini untuk fitur ini."); return; }
    }
    resetSkor();
    this.idx = 0;
    const kata = await VocabAIData.ambilKata(this.jumlah);
    if (!kata.length) { tampilToast("⚠️ Data vocab kosong."); this.buka(); return; }
    this.soalList = kata;
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this._selesai(); return; }
    const item = this.soalList[this.idx];
    this._sttResult = ""; this._sttDone = false; this._timerDone = false;

    let promptHTML = "";
    if (this.disp.hanzi) promptHTML += `<div class="soal-hanzi">${item.hanzi}</div>`;
    if (this.disp.pinyin) promptHTML += `<div class="soal-pinyin-hint">${item.pinyin || ""}</div>`;
    promptHTML += `<div class="soal-teks-indo">${item.arti}</div>`;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Kata ${this.idx + 1}/${this.soalList.length}</div>
          <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
        </div>
        <div class="label-mode">✍️ Buat 1 kalimat pakai kata ini!</div>
        ${promptHTML}
        ${this.disp.audio ? `<div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${item.hanzi}')">🔊 Dengar Kata</button></div>` : ""}
        <div style="text-align:center;margin:14px 0">
          <div id="vms-timer" style="font-size:44px;font-weight:900;color:var(--c-merah)">${this.durasi}</div>
          <div style="font-size:12px;color:#888">detik tersisa untuk mulai bicara</div>
        </div>
        <div class="hasil-box" id="hasil-vms" style="display:none"></div>
        <div class="btn-row">
          <button class="btn btn-abu" onclick="VocabMakeSentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;

    if (this.disp.audio) setTimeout(() => TTS.mandarin(item.hanzi), 300);
    // Mulai rekam STT langsung begitu soal tampil
    setTimeout(() => this._mulaiRekam(), 500);
    // Timer visual hitung mundur
    mulaiTimer(this.durasi, (sisa) => setTeks("vms-timer", sisa), () => this._waktuHabis());
  },

  _mulaiRekam() {
    STT.mulai("zh-CN",
      (hasil) => { this._sttResult = hasil; this._sttDone = true; this._cobaTampilHasil(); },
      () => { this._sttDone = true; this._cobaTampilHasil(); },
      () => { this._sttDone = true; this._cobaTampilHasil(); }
    );
  },

  _waktuHabis() {
    this._timerDone = true;
    STT.berhenti();
    this._cobaTampilHasil();
  },

  // Hasil BARU ditampilkan setelah waktu habis (dan STT sudah beres) —
  // supaya user tidak terganggu saat masih bicara.
  async _cobaTampilHasil() {
    if (!this._timerDone) return;
    if (this._alreadyShown) return;
    this._alreadyShown = true;
    const item = this.soalList[this.idx];
    const hEl = el("hasil-vms");
    hEl.style.display = "block"; hEl.className = "hasil-box info";
    if (!this._sttResult) {
      hEl.innerHTML = "⚠️ Tidak ada suara terdeteksi.";
      tambahSkor(false);
      tampilTombolLanjut("hasil-vms", () => { this.idx++; this._alreadyShown = false; this.tampilSoal(); });
      return;
    }
    hEl.innerHTML = `🤖 Menilai kalimat kamu dengan AI...<br><i>"${this._sttResult}"</i>`;
    try {
      const prompt = `Kamu guru bahasa Mandarin. Siswa diminta membuat 1 kalimat Mandarin memakai kata "${item.hanzi}" (${item.pinyin || ""}, arti: ${item.arti}) secara lisan dalam waktu singkat.
Hasil transkrip ucapan siswa: "${this._sttResult}"

Nilai dalam Bahasa Indonesia, bukan skor angka, dengan format:
1. Penilaian singkat: apakah kalimatnya natural dan pemakaian kata "${item.hanzi}" sudah tepat?
2. Saran perbaikan kata/susunan kalimat (jika ada).
3. Contoh alternatif kalimat yang lebih natural memakai kata yang sama.
Jawab ringkas, maksimal 5 kalimat total.`;
      const teks = await GeminiAPI.call(prompt, 500);
      tambahSkor(true);
      hEl.innerHTML = `
        <div><b>Kamu:</b> "${this._sttResult}"</div>
        <div style="margin-top:8px">${GeminiAPI.esc2(teks)}</div>`;
    } catch (e) {
      hEl.innerHTML = `<div><b>Kamu:</b> "${this._sttResult}"</div><div style="margin-top:8px;color:#f44336">⚠️ ${e.message}</div>`;
    }
    tampilTombolLanjut("hasil-vms", () => { this.idx++; this._alreadyShown = false; this.tampilSoal(); });
  },

  _selesai() {
    App.catatSesiSelesai("vocab", sesiSkor.benar, sesiSkor.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">🏆</div>
        <h2>Latihan Selesai!</h2>
        <div class="selesai-skor"><div>Kalimat dibuat: <b>${sesiSkor.total}</b></div></div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="VocabMakeSentence.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="VocabMakeSentence.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },
  kembaliMenu() { TTS.berhenti(); STT.berhenti(); hentikanTimer(); Vocab.kembaliMenu(); },
};

// ================================================================
//  B. BACA BERULANG DENGAN TIMER
// ================================================================
var VocabRepeatRead = {
  jmlKalimat: 2,      // berapa kalimat digabung jadi 1 soal
  putaran: 3,         // berapa kali dibaca ulang
  tampilkanPinyin: true,
  soalTeks: "",
  soalPinyin: "",
  waktuPutaran: [],   // detik per putaran
  putaranSaat: 0,
  _startT: 0,
  _kataSalah: [],

  buka() { el("konten-utama").innerHTML = this.renderSetup(); },

  renderSetup() {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🔁 Baca Berulang dengan Timer</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">Baca teks yang sama beberapa kali, lihat progres kecepatan bacamu.</div>

        <div style="font-weight:700;margin:10px 0 6px">Jumlah Kalimat per Soal</div>
        <div class="sub-menu-grid">
          ${[1,2,3].map(n => `<div class="sub-card ${this.jmlKalimat===n?"sub-card-aktif":""}" onclick="VocabRepeatRead._pilih('jmlKalimat',${n})"><div class="sub-label">${n} kalimat</div></div>`).join("")}
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Berapa Kali Putaran</div>
        <div class="sub-menu-grid">
          ${[3,4].map(n => `<div class="sub-card ${this.putaran===n?"sub-card-aktif":""}" onclick="VocabRepeatRead._pilih('putaran',${n})"><div class="sub-label">${n}x putaran</div></div>`).join("")}
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Tampilan Teks</div>
        <div class="sub-menu-grid">
          <div class="sub-card ${this.tampilkanPinyin?"":"sub-card-aktif"}" onclick="VocabRepeatRead._pilihBool(false)"><div class="sub-label">Hanzi Saja</div></div>
          <div class="sub-card ${this.tampilkanPinyin?"sub-card-aktif":""}" onclick="VocabRepeatRead._pilihBool(true)"><div class="sub-label">Hanzi + Pinyin</div></div>
        </div>

        ${renderKontrolLanjut("VocabRepeatRead._renderUlangSetup")}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="VocabRepeatRead.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },
  _renderUlangSetup() { el("konten-utama").innerHTML = VocabRepeatRead.renderSetup(); },
  _pilih(key, val) { this[key] = val; el("konten-utama").innerHTML = this.renderSetup(); },
  _pilihBool(val) { this.tampilkanPinyin = val; el("konten-utama").innerHTML = this.renderSetup(); },

  async mulai() {
    let pool = [];
    try { pool = await SetSoal.getSoalSiap("sentence"); } catch (e) {}
    if (!pool.length && typeof DB !== "undefined") pool = DB.sentences.map(s => ({ hanzi: s.hanzi, pinyin: s.pinyin, arti: s.arti }));
    if (!pool.length) { tampilToast("⚠️ Data kalimat kosong."); this.buka(); return; }
    const dipilih = acak(pool).slice(0, this.jmlKalimat);
    this.soalTeks = dipilih.map(s => s.hanzi).join("");
    this.soalPinyin = dipilih.map(s => s.pinyin || "").filter(Boolean).join(" / ");
    this.waktuPutaran = [];
    this._kataSalahPutaran = [];
    this.putaranSaat = 0;
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.putaranSaat >= this.putaran) { this._selesai(); return; }
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Putaran ${this.putaranSaat + 1}/${this.putaran}</div>
        </div>
        <div class="label-mode">🔁 Baca teks berikut dengan lantang</div>
        <div class="soal-kalimat">${this.soalTeks}</div>
        ${this.tampilkanPinyin && this.soalPinyin ? `<div class="soal-pinyin-hint">${this.soalPinyin}</div>` : ""}
        <div style="text-align:center;margin:14px 0">
          <div id="vrr-stopwatch" style="font-size:36px;font-weight:900;color:var(--c-biru)">0.0s</div>
        </div>
        <div class="hasil-box" id="hasil-vrr" style="display:none"></div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-vrr-mulai" onclick="VocabRepeatRead._mulaiBaca()">🎤 Mulai Baca</button>
          <button class="btn btn-kuning" id="btn-vrr-stop" style="display:none" onclick="VocabRepeatRead._berhentiManual()">⏹ Berhenti (Sudah Selesai Baca)</button>
          <button class="btn btn-abu" onclick="VocabRepeatRead.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _mulaiBaca() {
    const btn = el("btn-vrr-mulai");
    btn.disabled = true; btn.innerText = "🎙️ Membaca...";
    const stopBtn = el("btn-vrr-stop");
    if (stopBtn) stopBtn.style.display = "inline-block";
    this._sudahSelesaiBaca = false;
    this._startT = performance.now();
    this._swInterval = setInterval(() => {
      setTeks("vrr-stopwatch", ((performance.now() - this._startT) / 1000).toFixed(1) + "s");
    }, 100);
    STT.mulai("zh-CN",
      (hasil) => this._selesaiBaca(hasil),
      () => this._selesaiBaca(""),
      () => {}
    );
  },

  // Tombol manual kalau user sudah selesai membaca sebelum STT
  // otomatis mendeteksi jeda diam (mis. lingkungan bising).
  _berhentiManual() {
    if (this._sudahSelesaiBaca) return;
    STT.berhentiHalus();
  },

  _selesaiBaca(hasil) {
    if (this._sudahSelesaiBaca) return;
    this._sudahSelesaiBaca = true;
    const stopBtn = el("btn-vrr-stop");
    if (stopBtn) stopBtn.style.display = "none";
    clearInterval(this._swInterval);
    const detik = (performance.now() - this._startT) / 1000;
    this.waktuPutaran.push(detik);
    const targetChars = this.soalTeks.replace(/[，。！？、,\.!\?\s]/g, "").split("");
    const salah = targetChars.filter(ch => !hasil.includes(ch));
    this._kataSalahPutaran.push(salah);

    const hEl = el("hasil-vrr");
    hEl.style.display = "block"; hEl.className = "hasil-box info";
    hEl.innerHTML = `
      ⏱️ Waktu: <b>${detik.toFixed(1)} detik</b><br>
      ${salah.length ? `⚠️ Kemungkinan kurang jelas: <b>${salah.join(" ")}</b>` : "✅ Semua karakter terdengar!"}
    `;
    setTeks("btn-vrr-mulai", "✔ Selesai");
    tampilTombolLanjut("hasil-vrr", () => { this.putaranSaat++; this.tampilSoal(); });
  },

  _selesai() {
    App.catatSesiSelesai("vocab", this.putaran, this.putaran);
    const maxT = Math.max(...this.waktuPutaran, 1);
    const bars = this.waktuPutaran.map((t, i) => {
      const h = Math.max(8, Math.round((t / maxT) * 90));
      return `
        <div style="display:flex;flex-direction:column;align-items:center;flex:1">
          <div style="font-size:11px;color:#666;margin-bottom:2px">${t.toFixed(1)}s</div>
          <div style="width:70%;height:${h}px;background:linear-gradient(180deg,var(--c-biru),var(--c-hijau));border-radius:4px 4px 0 0"></div>
          <div style="font-size:11px;color:#888;margin-top:4px">Putaran ${i+1}</div>
        </div>`;
    }).join("");
    const membaik = this.waktuPutaran.length > 1 && this.waktuPutaran[this.waktuPutaran.length - 1] < this.waktuPutaran[0];

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${membaik ? "🚀" : "💪"}</div>
        <h2>Baca Berulang Selesai!</h2>
        <div style="display:flex;align-items:flex-end;gap:8px;margin:20px 0;height:130px">${bars}</div>
        <div class="soal-teks-indo">${membaik ? "Kecepatan bacamu meningkat di putaran terakhir! 🎉" : "Terus berlatih, kecepatan baca akan makin stabil."}</div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="VocabRepeatRead.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="VocabRepeatRead.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },
  kembaliMenu() { TTS.berhenti(); STT.berhenti(); clearInterval(this._swInterval); Vocab.kembaliMenu(); },
};
