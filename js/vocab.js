// ================================================================
//  VOCAB.JS — Vocabulary Training + Set Soal Terpusat + Mode Game
// ================================================================

var Vocab = {

  soalList: [],
  idx: 0,
  skor: { benar:0, salah:0 },
  modeSaat: null,
  speakingTipe: "arti",
  audioHanziIndo: false,   // preferensi audio di mode hanzi-indo
  pinyinStrict: true,      // mode ketat untuk soal pinyin (true = nada harus tepat)

  // ── RENDER MENU ──────────────────────────────────────────────
  renderMenu() {
    const subFitur = [
      { id:"hanzi-indo",   icon:"🈯", label:"Hanzi → Indonesia",  desc:"Lihat karakter, jawab artinya", fn:"pilihOpsiHanziIndo" },
      { id:"indo-hanzi",   icon:"🔤", label:"Indonesia → Hanzi",  desc:"Lihat arti, tulis karakternya", fn:"mulai('indo-hanzi')" },
      { id:"hanzi-pinyin", icon:"🔤", label:"Hanzi → Pinyin",     desc:"Tulis cara baca (romanisasi)",  fn:"pilihOpsiPinyin('hanzi-pinyin')" },
      { id:"indo-pinyin",  icon:"🔠", label:"Indonesia → Pinyin", desc:"Lihat arti, tulis pinyin-nya",  fn:"pilihOpsiPinyin('indo-pinyin')" },
      { id:"audio-arti",   icon:"🔊", label:"Audio → Arti",       desc:"Dengar audio, jawab artinya",   fn:"mulai('audio-arti')" },
      { id:"audio-hanzi",  icon:"🎧", label:"Audio → Hanzi",      desc:"Dengar audio, tulis karakter",  fn:"mulai('audio-hanzi')" },
      { id:"speaking",     icon:"🎤", label:"Speaking Vocab",     desc:"Lihat arti, ucapkan Hanzi-nya", fn:"pilihTipeSpeaking" },
    ];
    return `
      <div style="padding-bottom:12px">
        ${SetSoal.renderWidget("vocab", "v")}
        <div class="sub-menu-grid" style="margin-top:12px">
          ${subFitur.map(f => `
            <div class="sub-card" onclick="Vocab.${f.fn}()">
              <div class="sub-icon">${f.icon}</div>
              <div class="sub-label">${f.label}</div>
              <div class="sub-desc">${f.desc}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  _pasangEventMenu() {
    SetSoal._pilihSheet("vocab", SetSoal.get("vocab").sheet, "v");
  },

  // ── PILIH TIPE SPEAKING ──────────────────────────────────────
  pilihTipeSpeaking() {
    const opsi = [
      { id:"arti",         label:"Terjemahan Saja",    desc:"Lihat arti Indonesia, ucapkan Hanzi-nya" },
      { id:"hanzi",        label:"Hanzi Saja",         desc:"Lihat karakter Hanzi, ucapkan ulang" },
      { id:"pinyin",       label:"Pinyin Saja",        desc:"Lihat Pinyin, ucapkan pengucapannya" },
      { id:"hanzi-pinyin", label:"Hanzi + Pinyin",     desc:"Lihat karakter dan Pinyin sekaligus" },
      { id:"hanzi-audio",  label:"Hanzi + Audio",      desc:"Lihat Hanzi, dengar audio, lalu tirukan" },
      { id:"audio",        label:"Audio Saja",         desc:"Hanya dengar audio, lalu tirukan" },
    ];
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking Vocab — Pilih Tipe Soal</div>
        <div class="soal-hint" style="margin-bottom:12px">Bagaimana soal ingin ditampilkan?</div>
        <div class="sub-menu-grid">
          ${opsi.map(o => `
            <div class="sub-card ${this.speakingTipe === o.id ? 'sub-card-aktif' : ''}"
                 onclick="Vocab._pilihSpeakingTipe('${o.id}')">
              <div class="sub-label">${o.label}</div>
              <div class="sub-desc">${o.desc}</div>
            </div>
          `).join("")}
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="Vocab.mulai('speaking')">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _pilihSpeakingTipe(tipe) {
    this.speakingTipe = tipe;
    // refresh highlight pilihan
    document.querySelectorAll(".sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    event.currentTarget.classList.add("sub-card-aktif");
  },

  // ── PILIH OPSI HANZI-INDO ────────────────────────────────────
  pilihOpsiHanziIndo() {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🈯 Hanzi → Indonesia — Pilih Opsi</div>
        <div class="soal-hint" style="margin-bottom:14px">Apakah soal disertai audio pengucapan?</div>
        <div class="sub-menu-grid">
          <div class="sub-card ${!this.audioHanziIndo ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihAudioHanziIndo(false)">
            <div class="sub-icon">👁️</div>
            <div class="sub-label">Tanpa Audio</div>
            <div class="sub-desc">Hanya tampil karakter Hanzi</div>
          </div>
          <div class="sub-card ${this.audioHanziIndo ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihAudioHanziIndo(true)">
            <div class="sub-icon">🔊</div>
            <div class="sub-label">Dengan Audio</div>
            <div class="sub-desc">Karakter Hanzi + audio diputar otomatis</div>
          </div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="Vocab.mulai('hanzi-indo')">▶ Mulai</button>
          <button class="btn btn-abu"   onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _pilihAudioHanziIndo(pakai) {
    this.audioHanziIndo = pakai;
    document.querySelectorAll(".sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    event.currentTarget.classList.add("sub-card-aktif");
  },

  // ── PILIH OPSI PINYIN (Hanzi→Pinyin / Indo→Pinyin) ───────────
  pilihOpsiPinyin(mode) {
    const judul = mode === "hanzi-pinyin" ? "🔤 Hanzi → Pinyin" : "🔠 Indonesia → Pinyin";
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">${judul} — Pilih Opsi</div>
        <div class="soal-hint" style="margin-bottom:14px">Seberapa ketat pengecekan tanda nada?</div>
        <div class="sub-menu-grid">
          <div class="sub-card ${this.pinyinStrict ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihPinyinStrict(true)">
            <div class="sub-icon">🎯</div>
            <div class="sub-label">Ketat (sesuai nada)</div>
            <div class="sub-desc">Tanda nada harus tepat, mis. nǐ ≠ nì</div>
          </div>
          <div class="sub-card ${!this.pinyinStrict ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihPinyinStrict(false)">
            <div class="sub-icon">🌊</div>
            <div class="sub-label">Longgar (tanpa nada)</div>
            <div class="sub-desc">Nada diabaikan, ni = nǐ = nì dianggap benar</div>
          </div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="Vocab.mulai('${mode}')">▶ Mulai</button>
          <button class="btn btn-abu"   onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _pilihPinyinStrict(strict) {
    this.pinyinStrict = strict;
    document.querySelectorAll(".sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    event.currentTarget.classList.add("sub-card-aktif");
  },

  async mulai(mode) {
    this.modeSaat         = mode;
    this.idx              = 0;
    this.streak           = 0;
    this._infinityRetry   = false;
    this._retryIdx        = -1;
    this._sedangTransisi  = false;
    this._soalSelesai     = 0;
    resetSkor();

    const raw = await SetSoal.getSoalSiap("vocab", mode);
    if (!raw || !raw.length) {
      tampilToast("Tidak ada soal! Cek set soal yang dipilih.");
      return;
    }
    this.soalList = SetSoal.potongSoal(raw, "vocab");
    this.tampilSoal();
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  tampilSoal() {
    this._sedangTransisi = false;   // pastikan selalu reset saat soal baru tampil
    const cfg = SetSoal.get("vocab");
    const modeRetry = cfg.mode === "infinity" || cfg.mode === "jumlah";
    // Semua soal sudah dijawab → tampil layar selesai
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }

    const item  = this.soalList[this.idx];
    const total = this.soalList.length;
    const mode  = this.modeSaat;

    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${modeRetry ? this._soalSelesai+1 : this.idx+1} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${modeRetry ? (this._soalSelesai/total)*100 : (this.idx/total)*100}%"></div>
      </div>
      <div class="quiz-streak" id="vocab-streak">${this.streak > 1 ? "🔥 Streak: "+this.streak : ""}</div>
    `;

    if (mode === "hanzi-indo")   html += this._soalHanziIndo(item);
    else if (mode === "indo-hanzi")   html += this._soalIndoHanzi(item);
    else if (mode === "hanzi-pinyin") html += this._soalHanziPinyin(item);
    else if (mode === "indo-pinyin")  html += this._soalIndoPinyin(item);
    else if (mode === "audio-arti")   html += this._soalAudioArti(item);
    else if (mode === "audio-hanzi")  html += this._soalAudioHanzi(item);
    else if (mode === "speaking")     html += this._soalSpeaking(item);

    el("konten-utama").innerHTML = html;
    this._pasangEvent();

    // Auto-play audio jika mode hanzi-indo dengan audio aktif
    if (mode === "hanzi-indo" && this.audioHanziIndo) {
      setTimeout(() => TTS.bicara(item.hanzi, "zh-CN"), 300);
    }
  },

  // ── SOAL A: Hanzi → Indonesia ────────────────────────────────
  _soalHanziIndo(item) {
    const pool     = this.soalList.filter(v => v.arti !== item.arti);
    const salahArr = acak(pool.length >= 3 ? pool : (DB.vocab.filter(v => v.arti !== item.arti))).slice(0,3);
    const semua    = acak([item.arti, ...salahArr.map(v => v.arti)]);
    const audioBtn = this.audioHanziIndo
      ? `<button class="btn btn-abu" style="margin-bottom:8px" onclick="TTS.bicara('${this._esc(item.hanzi)}','zh-CN')">🔊 Putar Audio</button>`
      : "";
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Indonesia${this.audioHanziIndo ? " 🔊" : ""}</div>
        <div class="soal-hanzi">${item.hanzi}</div>
        ${audioBtn}
        <div class="soal-hint">Apa arti kata di atas?</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map((p,i) => `<button class="btn-pilihan"
            onclick="Vocab._jawabPilihan(${i},'${this._esc(p)}','${this._esc(item.arti)}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL B: Indonesia → Hanzi ────────────────────────────────
  _soalIndoHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Indonesia → Hanzi</div>
        <div class="soal-arti">${item.arti}</div>
        <input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik Hanzi..." autocomplete="off">
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabKetikHanzi()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL C: Hanzi → Pinyin ───────────────────────────────────
  _soalHanziPinyin(item) {
    const modeTag = this.pinyinStrict
      ? `<span class="pinyin-mode-tag ketat">🎯 Mode Ketat (nada wajib sesuai)</span>`
      : `<span class="pinyin-mode-tag longgar">🌊 Mode Longgar (nada diabaikan)</span>`;
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Pinyin</div>
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="soal-hint">Tulis Pinyin (dengan tanda nada): ${modeTag}</div>
        <div id="kb-pinyin-cont"></div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabPinyin()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL C2: Indonesia → Pinyin ──────────────────────────────
  _soalIndoPinyin(item) {
    const modeTag = this.pinyinStrict
      ? `<span class="pinyin-mode-tag ketat">🎯 Mode Ketat (nada wajib sesuai)</span>`
      : `<span class="pinyin-mode-tag longgar">🌊 Mode Longgar (nada diabaikan)</span>`;
    return `
      <div class="soal-wrap">
        <div class="label-mode">🔠 Indonesia → Pinyin</div>
        <div class="soal-arti">${item.arti}</div>
        <div class="soal-hint">Tulis Pinyin kata di atas (dengan tanda nada): ${modeTag}</div>
        <div id="kb-pinyin-cont"></div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabPinyin()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL D: Audio → Arti ─────────────────────────────────────
  _soalAudioArti(item) {
    const pool  = this.soalList.filter(v => v.arti !== item.arti);
    const sarr  = acak(pool.length >= 3 ? pool : DB.vocab.filter(v => v.arti !== item.arti)).slice(0,3);
    const semua = acak([item.arti, ...sarr.map(v => v.arti)]);
    return `
      <div class="soal-wrap">
        <div class="label-mode">Audio → Arti</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan lalu pilih artinya:</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map((p,i) => `<button class="btn-pilihan"
            onclick="Vocab._jawabPilihan(${i},'${this._esc(p)}','${this._esc(item.arti)}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL E: Audio → Hanzi ────────────────────────────────────
  _soalAudioHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Audio → Hanzi</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan lalu tulis Hanzi-nya:</div>
        <input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik Hanzi...">
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabKetikHanzi()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL F: Speaking ─────────────────────────────────────────
  _soalSpeaking(item) {
    const tipe = this.speakingTipe;

    // Bangun tampilan prompt berdasarkan tipe yang dipilih
    let promptHTML = "";
    let labelTipe  = "";

    if (tipe === "arti") {
      labelTipe  = "Lihat Terjemahan → Ucapkan Hanzi";
      promptHTML = `<div class="soal-arti">${item.arti}</div>`;
    } else if (tipe === "hanzi") {
      labelTipe  = "Lihat Hanzi → Ucapkan Ulang";
      promptHTML = `<div class="soal-hanzi">${item.hanzi}</div>`;
    } else if (tipe === "pinyin") {
      labelTipe  = "Lihat Pinyin → Ucapkan";
      promptHTML = `<div class="soal-hanzi" style="font-size:28px">${item.pinyin || "(no pinyin)"}</div>`;
    } else if (tipe === "hanzi-pinyin") {
      labelTipe  = "Hanzi + Pinyin → Ucapkan";
      promptHTML = `
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="soal-hint" style="font-size:16px;color:#555">${item.pinyin || ""}</div>`;
    } else if (tipe === "hanzi-audio") {
      labelTipe  = "Hanzi + Audio → Tirukan";
      promptHTML = `
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="audio-btn-wrap" style="margin:8px 0">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Dengar Audio</button>
        </div>`;
    } else if (tipe === "audio") {
      labelTipe  = "Audio Saja → Tirukan";
      promptHTML = `
        <div class="audio-btn-wrap" style="margin:16px 0">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>`;
    }

    return `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking — ${labelTipe}</div>
        ${promptHTML}
        <div class="hasil-box" id="hasil-vocab">Tekan tombol mic lalu bicara...</div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-mic" onclick="Vocab._jawabSuara()">🎤 Mulai Bicara</button>
          <button class="btn btn-kuning" onclick="Vocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── EVENT ────────────────────────────────────────────────────
  _pasangEvent() {
    const mode = this.modeSaat;
    const cfg  = App._settings;
    if (mode === "hanzi-pinyin" || mode === "indo-pinyin") setTimeout(() => buildKbPinyin("kb-display", null), 50);
    if (mode === "audio-arti" || mode === "audio-hanzi") {
      setTimeout(() => TTS.bicara(this.soalList[this.idx].hanzi, "zh-CN", cfg.ttRate || 0.85), 300);
    }
    // speaking: auto-putar audio jika tipe hanzi-audio atau audio
    if (mode === "speaking" && (this.speakingTipe === "hanzi-audio" || this.speakingTipe === "audio")) {
      setTimeout(() => TTS.bicara(this.soalList[this.idx].hanzi, "zh-CN", cfg.ttRate || 0.85), 400);
    }
    setTimeout(() => {
      const inp = el("input-jawab");
      if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === "Enter") this._jawabKetikHanzi(); }; }
    }, 100);
  },

  _updateStreak(benar) {
    if (benar) { this.streak++; } else { this.streak = 0; }
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    setTeks("vocab-streak", this.streak > 1 ? `🔥 Streak: ${this.streak}` : "");
  },

  // ── PROSES JAWABAN ───────────────────────────────────────────
  _jawabPilihan(idx, dipilih, jawaban) {
    if (this._sedangTransisi) return;
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    el("pilihan-cont")?.querySelectorAll(".btn-pilihan").forEach(b => {
      b.disabled = true;
      if (b.innerText === jawaban) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });
    const msg = benar
      ? `Benar! <b>${item.hanzi}</b>${item.pinyin ? " ("+item.pinyin+")" : ""} = ${item.arti}`
      : `Salah. Jawaban: <b>${item.arti}</b>${item.pinyin ? " ("+item.pinyin+")" : ""}`;
    const hEl = el("hasil-vocab");
    if (hEl) { hEl.innerHTML = (benar?"✅ ":"❌ ") + msg; hEl.className = "hasil-box " + (benar?"benar":"salah"); }
    this._updateStreak(benar);
    this._nextOrRetry(benar);
  },

  _jawabKetikHanzi() {
    if (this._sedangTransisi) return;
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const item  = this.soalList[this.idx];
    const benar = cekHanzi(input, item.hanzi);
    tambahSkor(benar);
    const hEl = el("hasil-vocab");
    if (hEl) {
      hEl.innerHTML = benar
        ? `✅ Benar! <b>${item.hanzi}</b>${item.pinyin ? " ("+item.pinyin+")" : ""}`
        : `❌ Salah. Jawaban: <b>${item.hanzi}</b>${item.pinyin ? " ("+item.pinyin+")" : ""}`;
      hEl.className = "hasil-box " + (benar?"benar":"salah");
    }
    if (inp) inp.disabled = true;
    this._updateStreak(benar);
    this._nextOrRetry(benar);
  },

  _jawabPinyin() {
    if (this._sedangTransisi) return;
    const input = getKbTeks();
    if (!input) return;
    const item  = this.soalList[this.idx];
    const benar = cekPinyin(input, item.pinyin, this.pinyinStrict);
    tambahSkor(benar);
    const hEl = el("hasil-vocab");
    if (hEl) {
      hEl.innerHTML = benar
        ? `✅ Benar! Pinyin: <b>${item.pinyin}</b>${this.modeSaat === "indo-pinyin" ? ` — Hanzi: <b>${item.hanzi}</b>` : ""}`
        : `❌ Salah. Pinyin benar: <b>${item.pinyin}</b>${this.modeSaat === "indo-pinyin" ? ` — Hanzi: <b>${item.hanzi}</b>` : ""}`;
      hEl.className = "hasil-box " + (benar?"benar":"salah");
    }
    this._updateStreak(benar);
    this._nextOrRetry(benar);
  },

  _jawabSuara() {
    if (this._sedangTransisi) return;
    const btnMic = el("btn-mic");
    const item   = this.soalList[this.idx];
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    setTeks("hasil-vocab", "🎙️ Silakan bicara...");
    STT.mulai("zh-CN",
      (hasil, semua) => {
        const benar = semua.some(h => h.includes(item.hanzi) || cekHanzi(h, item.hanzi));
        tambahSkor(benar);
        const hEl = el("hasil-vocab");
        if (hEl) {
          hEl.innerHTML = benar
            ? `✅ Benar! Kamu: "${hasil}"`
            : `❌ Salah. Kamu: "${hasil}" — Target: <b>${item.hanzi}</b>`;
          hEl.className = "hasil-box " + (benar?"benar":"salah");
        }
        if (btnMic) btnMic.innerText = "✔ Selesai";
        this._updateStreak(benar);
        this._nextOrRetry(benar);
      },
      err => { setTeks("hasil-vocab", "❌ Error mic: "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} },
      dapat => { if(!dapat){ setTeks("hasil-vocab","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} } }
    );
  },

  _skip() {
    const item = this.soalList[this.idx];
    tambahSkor(true);
    const hEl = el("hasil-vocab");
    if (hEl) {
      const mode = this.modeSaat;
      let jawaban = "";
      if (mode === "hanzi-pinyin" || mode === "indo-pinyin") {
        jawaban = `Pinyin: <b>${item.pinyin || "-"}</b>${mode === "indo-pinyin" ? ` — Hanzi: <b>${item.hanzi}</b>` : ""}`;
      } else {
        jawaban = `<b>${item.hanzi}</b>${item.arti ? " = "+item.arti : ""}`;
      }
      hEl.innerHTML = `⏭ Di-skip. Jawaban: ${jawaban}`;
      hEl.className = "hasil-box benar";
    }
    this._updateStreak(true);
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1500);
  },

  // ── NEXT / INFINITY RETRY ────────────────────────────────────
  _nextOrRetry(benar) {
    if (this._sedangTransisi) return;
    this._sedangTransisi = true;
    const cfg = SetSoal.get("vocab");
    const modeRetry = cfg.mode === "infinity" || cfg.mode === "jumlah";

    if (modeRetry) {
      if (!benar) {
        // Salah → ulangi soal ini dulu sampai benar, lalu reset ke soal pertama
        this._infinityRetry = true;
        const hEl = el("hasil-vocab");
        if (hEl) hEl.innerHTML += "<br><small>🔄 Jawab ulang soal ini hingga benar, lalu mulai dari soal pertama...</small>";
        setTimeout(() => this.tampilSoal(), 2800);
      } else {
        if (this._infinityRetry) {
          // Setelah retry berhasil → cek apakah ini soal terakhir
          this._infinityRetry = false;
          this._soalSelesai++;
          if (this.idx >= this.soalList.length - 1) {
            // Soal terakhir → selesai
            setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
          } else {
            // Bukan soal terakhir → reset ke soal pertama + reset progress
            setTimeout(() => { this.idx = 0; this._soalSelesai = 0; this.tampilSoal(); }, 1600);
          }
        } else {
          // Benar normal → lanjut soal berikutnya (selesai jika sudah habis)
          this._soalSelesai++;
          setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
        }
      }
    } else {
      setTimeout(() => { this.idx++; this.tampilSoal(); }, benar ? 1600 : 2000);
    }
  },

  // ── SELESAI ──────────────────────────────────────────────────
  tampilSelesai() {
    const pct  = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    App.catatSesiSelesai("vocab", sesiSkor.benar, sesiSkor.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Sesi Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
          <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="Vocab.mulai('${this.modeSaat}')">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="Vocab.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },

  kembaliMenu() { TTS.berhenti(); STT.berhenti(); App.renderModul("vocab"); },
  _esc(s) { return (s||"").replace(/'/g,"\\'").replace(/"/g,"&quot;"); },
};
