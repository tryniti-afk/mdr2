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
  difficulty: "hard",      // "hard" = kembali ke soal 1 | "easy" = mundur 2 soal

  // ── RENDER MENU ──────────────────────────────────────────────
  renderMenu() {
    const subFitur = [
      { id:"hanzi-indo",   icon:"🈯", label:"Hanzi → Indonesia",  desc:"Lihat karakter, jawab artinya", fn:"pilihOpsiHanziIndo()" },
      { id:"indo-hanzi",   icon:"🔤", label:"Indonesia → Hanzi",  desc:"Lihat arti, tulis karakternya", fn:"mulai('indo-hanzi')" },
      { id:"hanzi-pinyin", icon:"🔤", label:"Hanzi → Pinyin",     desc:"Tulis cara baca (romanisasi)",  fn:"pilihOpsiPinyin('hanzi-pinyin')" },
      { id:"indo-pinyin",  icon:"🔠", label:"Indonesia → Pinyin", desc:"Lihat arti, tulis pinyin-nya",  fn:"pilihOpsiPinyin('indo-pinyin')" },
      { id:"audio-arti",   icon:"🔊", label:"Audio → Arti",       desc:"Dengar audio, jawab artinya",   fn:"mulai('audio-arti')" },
      { id:"audio-hanzi",  icon:"🎧", label:"Audio → Hanzi",      desc:"Dengar audio, tulis karakter",  fn:"mulai('audio-hanzi')" },
      { id:"speaking",     icon:"🎤", label:"Speaking Vocab",     desc:"Lihat arti, ucapkan Hanzi-nya", fn:"pilihTipeSpeaking()" },
      { id:"cocok-kata",   icon:"🧩", label:"Cocok Kata",         desc:"Cocokkan Hanzi/Pinyin/Arti/Audio, pilih sendiri kombinasinya", fn:"pilihOpsiCocokKata()" },
      { id:"all-in",       icon:"🔥", label:"All In",              desc:"Review + 6 tipe soal sekaligus!",fn:"mulaiAllIn()" },
      { id:"ai-latihan",   icon:"🤖", label:"Latihan AI",          desc:"Chat/telepon AI, bahas 5 kata sekaligus", fn:"bukaLatihanAI()" },
    ];
    return `
      <div style="padding-bottom:12px">
        ${SetSoal.renderWidget("vocab", "v")}
        <div class="sub-menu-grid" style="margin-top:12px">
          ${subFitur.map(f => `
            <div class="sub-card" onclick="Vocab.${f.fn}">
              <div class="sub-icon">${f.icon}</div>
              <div class="sub-label">${f.label}</div>
              <div class="sub-desc">${f.desc}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  // ── LATIHAN VOCAB DENGAN AI (chat / telepon) ─────────────────
  bukaLatihanAI() {
    el("konten-utama").innerHTML = VocabAIHub.renderMenu();
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

  // ── PILIH OPSI COCOK KATA (pasangan & arah tampilan bebas) ────
  pasanganCocok: "hanzi-arti", // salah satu key PASANGAN_COCOK
  arahCocok:  "a-kiri",        // "a-kiri" = field A (lihat PASANGAN_COCOK) di kiri | "b-kiri" = sebaliknya
  barisCocok: 6,               // jumlah baris/kata yang tampil bersamaan di papan

  PASANGAN_COCOK: {
    "hanzi-arti":   { a:"hanzi", b:"arti",   iconA:"🈯", iconB:"🔤", labelA:"Hanzi",  labelB:"Arti",   labelMenu:"Hanzi ↔ Arti" },
    "hanzi-pinyin": { a:"hanzi", b:"pinyin", iconA:"🈯", iconB:"🔠", labelA:"Hanzi",  labelB:"Pinyin", labelMenu:"Hanzi ↔ Pinyin" },
    "audio-hanzi":  { a:"audio", b:"hanzi",  iconA:"🔊", iconB:"🈯", labelA:"Audio",  labelB:"Hanzi",  labelMenu:"Audio ↔ Hanzi" },
    "audio-arti":   { a:"audio", b:"arti",   iconA:"🔊", iconB:"🔤", labelA:"Audio",  labelB:"Arti",   labelMenu:"Audio ↔ Arti" },
    "pinyin-arti":  { a:"pinyin",b:"arti",   iconA:"🔠", iconB:"🔤", labelA:"Pinyin", labelB:"Arti",   labelMenu:"Pinyin ↔ Arti" },
  },

  pilihOpsiCocokKata() {
    const presetBaris = [4, 6, 8, 10, 12];
    const pasanganList = Object.keys(this.PASANGAN_COCOK);
    const p = this.PASANGAN_COCOK[this.pasanganCocok];

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🧩 Cocok Kata — Pilih Opsi</div>
        <div class="soal-hint" style="margin-bottom:10px">Mau mencocokkan apa dengan apa?</div>
        <div class="sub-menu-grid" id="cocok-pasangan-grid">
          ${pasanganList.map(key => {
            const c = this.PASANGAN_COCOK[key];
            return `<div class="sub-card ${this.pasanganCocok === key ? 'sub-card-aktif' : ''}"
                 id="cocok-pasangan-${key}"
                 onclick="Vocab._pilihPasanganCocok('${key}')">
              <div class="sub-icon">${c.iconA}${c.iconB}</div>
              <div class="sub-label">${c.labelMenu}</div>
            </div>`;
          }).join("")}
        </div>

        <div class="soal-hint" style="margin:16px 0 8px" id="cocok-arah-hint">${p.labelA} di sisi mana?</div>
        <div class="sub-menu-grid" id="cocok-arah-grid">
          ${this._htmlArahCocok()}
        </div>

        <div class="soal-hint" style="margin:16px 0 8px">Berapa baris kata tampil bersamaan di papan?</div>
        <div class="ss-opsi-row" id="cocok-baris-preset">
          ${presetBaris.map(n => `
            <button class="ss-btn ${this.barisCocok === n ? 'aktif' : ''}"
              id="cocok-baris-btn-${n}"
              onclick="Vocab._pilihBarisCocok(${n})">${n}</button>
          `).join("")}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
          <label style="font-size:13px;color:#555">Custom:</label>
          <input type="number" id="cocok-baris-custom" class="ss-input-num" min="2" max="20"
            value="${this.barisCocok}"
            onchange="Vocab._pilihBarisCocokCustom(this.value)">
          <span style="font-size:12px;color:var(--c-sub)">(min 2, maks 20 — dibatasi jumlah soal tersedia)</span>
        </div>

        <div class="soal-hint" style="margin-top:14px" id="cocok-ringkasan-hint">${this._htmlRingkasanCocok()}</div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="Vocab._mulaiCocokKata()">▶ Mulai</button>
          <button class="btn btn-abu"   onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _htmlArahCocok() {
    const p = this.PASANGAN_COCOK[this.pasanganCocok];
    return `
      <div class="sub-card ${this.arahCocok === 'a-kiri' ? 'sub-card-aktif' : ''}"
           onclick="Vocab._pilihArahCocok('a-kiri')">
        <div class="sub-icon">${p.iconA}➡️${p.iconB}</div>
        <div class="sub-label">${p.labelA} Kiri, ${p.labelB} Kanan</div>
      </div>
      <div class="sub-card ${this.arahCocok === 'b-kiri' ? 'sub-card-aktif' : ''}"
           onclick="Vocab._pilihArahCocok('b-kiri')">
        <div class="sub-icon">${p.iconB}➡️${p.iconA}</div>
        <div class="sub-label">${p.labelB} Kiri, ${p.labelA} Kanan</div>
      </div>`;
  },

  _htmlRingkasanCocok() {
    return `Akan tampil <b>${this.barisCocok}</b> baris kata sekaligus. Klik satu kata di satu sisi, lalu klik pasangannya di sisi lain.
      Kata yang cocok akan hilang dan diganti kata berikutnya, sampai semua soal habis.`;
  },

  _pilihPasanganCocok(key) {
    this.pasanganCocok = key;
    document.querySelectorAll("#cocok-pasangan-grid .sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    const btn = el("cocok-pasangan-" + key);
    if (btn) btn.classList.add("sub-card-aktif");
    // Refresh bagian arah karena label/icon ikut berubah sesuai pasangan baru
    const arahGrid = el("cocok-arah-grid");
    if (arahGrid) arahGrid.innerHTML = this._htmlArahCocok();
    const arahHint = el("cocok-arah-hint");
    if (arahHint) arahHint.textContent = `${this.PASANGAN_COCOK[key].labelA} di sisi mana?`;
  },

  _pilihArahCocok(arah) {
    this.arahCocok = arah;
    const arahGrid = el("cocok-arah-grid");
    if (arahGrid) arahGrid.innerHTML = this._htmlArahCocok();
  },

  _pilihBarisCocok(n) {
    this.barisCocok = n;
    document.querySelectorAll("#cocok-baris-preset .ss-btn").forEach(b => b.classList.remove("aktif"));
    const btn = el("cocok-baris-btn-" + n);
    if (btn) btn.classList.add("aktif");
    const custom = el("cocok-baris-custom");
    if (custom) custom.value = n;
    this._refreshHintBarisCocok();
  },

  _pilihBarisCocokCustom(val) {
    let n = parseInt(val) || 6;
    n = Math.max(2, Math.min(20, n));
    this.barisCocok = n;
    document.querySelectorAll("#cocok-baris-preset .ss-btn").forEach(b => b.classList.remove("aktif"));
    const btn = el("cocok-baris-btn-" + n);
    if (btn) btn.classList.add("aktif");
    const custom = el("cocok-baris-custom");
    if (custom) custom.value = n;
    this._refreshHintBarisCocok();
  },

  _refreshHintBarisCocok() {
    const h = el("cocok-ringkasan-hint");
    if (h) h.innerHTML = this._htmlRingkasanCocok();
  },

  // Filter soal sesuai field yang dibutuhkan pasangan yang dipilih
  _filterSoalCocok(soal, pasangan) {
    const p = this.PASANGAN_COCOK[pasangan];
    const perluField = f => f === "audio" ? "hanzi" : f;   // audio butuh hanzi utk diucapkan
    const fA = perluField(p.a), fB = perluField(p.b);
    return soal.filter(w => w[fA] && w[fB]);
  },

  // ── COCOK KATA: mulai game ────────────────────────────────────
  async _mulaiCocokKata() {
    const raw = await SetSoal.getSoalSiap("vocab", "cocok-kata");
    if (!raw || !raw.length) {
      tampilToast("Tidak ada soal! Cek set soal yang dipilih.");
      return;
    }
    const potong = SetSoal.potongSoal(raw, "vocab");
    const soal = this._filterSoalCocok(potong, this.pasanganCocok);
    if (soal.length < 2) {
      tampilToast("Data tidak cukup lengkap (mis. pinyin kosong) untuk pasangan ini. Coba pasangan lain atau set soal lain.");
      return;
    }
    const jumlahBaris = Math.max(2, Math.min(this.barisCocok || 6, soal.length));
    CocokKata.mulai(acak(soal), this.arahCocok, jumlahBaris, this.pasanganCocok, this.PASANGAN_COCOK[this.pasanganCocok]);
  },

  mulai(mode) {
    const cfg = SetSoal.get("vocab");
    const modeRetry = cfg.mode === "infinity" || cfg.mode === "jumlah";
    if (modeRetry) {
      this._tanyaDifficulty(mode);
    } else {
      this._mulaiLangsung(mode);
    }
  },

  _tanyaDifficulty(mode) {
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">⚙️ Pilih Tingkat Kesulitan</div>
        <div class="soal-hint" style="margin-bottom:14px">
          Jika jawaban salah, kamu harus menjawab ulang soal tersebut hingga benar.<br>
          Setelah benar, soal akan dilanjutkan ke mana?
        </div>
        <div class="sub-menu-grid">
          <div class="sub-card ${this.difficulty === 'hard' ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihDifficulty('hard', '${mode}')">
            <div class="sub-icon">💀</div>
            <div class="sub-label">Hard</div>
            <div class="sub-desc">Kembali ke soal 1 dari awal</div>
          </div>
          <div class="sub-card ${this.difficulty === 'easy' ? 'sub-card-aktif' : ''}"
               onclick="Vocab._pilihDifficulty('easy', '${mode}')">
            <div class="sub-icon">😊</div>
            <div class="sub-label">Mudah</div>
            <div class="sub-desc">Mundur 2 soal sebelumnya</div>
          </div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="Vocab._mulaiLangsung('${mode}')">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _pilihDifficulty(diff, mode) {
    this.difficulty = diff;
    document.querySelectorAll(".sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    event.currentTarget.classList.add("sub-card-aktif");
  },

  async _mulaiLangsung(mode) {
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
        <div class="progres-teks">Soal ${Math.min(this.idx+1, total)} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${(Math.min(this.idx,total)/total*100).toFixed(1)}%"></div>
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
    const inputArea = this.pinyinStrict
      ? `<div id="kb-pinyin-cont"></div>`
      : `<input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik pinyin..." autocomplete="off">`;
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Pinyin</div>
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="soal-hint">Tulis Pinyin${this.pinyinStrict ? " (dengan tanda nada)" : ""}: ${modeTag}</div>
        ${inputArea}
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
    const inputArea = this.pinyinStrict
      ? `<div id="kb-pinyin-cont"></div>`
      : `<input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik pinyin..." autocomplete="off">`;
    return `
      <div class="soal-wrap" style="text-align:center">
        <div class="label-mode">🔠 Indonesia → Pinyin</div>
        <div class="soal-arti">${item.arti}</div>
        <div class="soal-hint">Tulis Pinyin kata di atas${this.pinyinStrict ? " (dengan tanda nada)" : ""}: ${modeTag}</div>
        ${inputArea}
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row" style="justify-content:center">
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
    if (mode === "hanzi-pinyin" || mode === "indo-pinyin") {
      if (this.pinyinStrict) {
        setTimeout(() => buildKbPinyin("kb-display", null), 50);
      } else {
        setTimeout(() => {
          const inp = el("input-jawab");
          if (inp) {
            inp.focus();
            inp.onkeydown = e => { if (e.key === "Enter") this._jawabPinyin(); };
          }
        }, 100);
      }
    }
    if (mode === "audio-arti" || mode === "audio-hanzi") {
      setTimeout(() => TTS.bicara(this.soalList[this.idx].hanzi, "zh-CN", cfg.ttRate || 0.85), 300);
    }
    // speaking: auto-putar audio jika tipe hanzi-audio atau audio
    if (mode === "speaking" && (this.speakingTipe === "hanzi-audio" || this.speakingTipe === "audio")) {
      setTimeout(() => TTS.bicara(this.soalList[this.idx].hanzi, "zh-CN", cfg.ttRate || 0.85), 400);
    }
    // Pasang Enter handler untuk mode ketik hanzi (bukan pinyin — sudah dipasang di atas)
    if (mode !== "hanzi-pinyin" && mode !== "indo-pinyin") {
      setTimeout(() => {
        const inp = el("input-jawab");
        if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === "Enter") this._jawabKetikHanzi(); }; }
      }, 100);
    }
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
    let input;
    if (this.pinyinStrict) {
      input = getKbTeks();
    } else {
      const inp = el("input-jawab");
      input = inp ? inp.value.trim() : "";
    }
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
        // Salah → ulangi soal ini dulu sampai benar
        this._infinityRetry = true;
        const pesanDiff = this.difficulty === "easy"
          ? "🔄 Jawab ulang soal ini hingga benar, lalu mundur 2 soal..."
          : "🔄 Jawab ulang soal ini hingga benar, lalu mulai dari soal pertama...";
        const hEl = el("hasil-vocab");
        if (hEl) hEl.innerHTML += `<br><small>${pesanDiff}</small>`;
        setTimeout(() => this.tampilSoal(), 2800);
      } else {
        if (this._infinityRetry) {
          // Setelah retry berhasil
          this._infinityRetry = false;
          if (this.idx >= this.soalList.length - 1) {
            // Soal terakhir → selesai
            setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
          } else {
            // Tentukan tujuan berdasarkan difficulty
            const isEasy = this.difficulty === "easy";
            const nomorTuju = isEasy ? Math.max(0, this.idx - 2) : 0;
            setTimeout(() => { this.idx = nomorTuju; this.tampilSoal(); }, 1600);
          }
        } else {
          // Benar normal → lanjut soal berikutnya
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

  // ── ALL IN entry point ───────────────────────────────────────
  async mulaiAllIn() {
    await AllIn.init();
  },
};

// ================================================================
//  COCOK KATA — Game mencocokkan Hanzi ↔ Arti (6 baris berjalan)
// ================================================================
var CocokKata = {

  N_BARIS: 6,          // jumlah baris tampil bersamaan (default, ditimpa oleh parameter mulai())

  pool: [],            // seluruh soal (urutan sudah diacak sebelum masuk sini)
  antrian: 0,          // index kata berikutnya di pool yang belum masuk papan
  arah: "a-kiri",      // "a-kiri" = field A di kiri | "b-kiri" = sebaliknya
  pasangan: "hanzi-arti",
  pasanganCfg: { a:"hanzi", b:"arti", iconA:"🈯", iconB:"🔤", labelA:"Hanzi", labelB:"Arti" },

  slotKiri: [],        // array of {id, hanzi, arti, pinyin} | null — sejajar kolom kiri
  slotKanan: [],       // array of {id, hanzi, arti, pinyin} | null — sejajar kolom kanan (urutan acak sendiri)

  pilih: null,         // { sisi:'kiri'|'kanan', idx:Number } | null
  benar: 0,
  salah: 0,
  totalKata: 0,
  selesaiKata: 0,
  waktuMulai: 0,
  _timerId: null,
  _sedang: false,      // lock saat animasi benar/salah berjalan

  // ── MULAI GAME ────────────────────────────────────────────────
  mulai(soalAcak, arah, jumlahBaris, pasanganKey, pasanganCfg) {
    this.pool        = soalAcak.map((w, i) => ({ id:i, hanzi:w.hanzi, arti:w.arti, pinyin:w.pinyin || "" }));
    this.arah        = arah || "a-kiri";
    this.pasangan    = pasanganKey || "hanzi-arti";
    this.pasanganCfg = pasanganCfg || { a:"hanzi", b:"arti", iconA:"🈯", iconB:"🔤", labelA:"Hanzi", labelB:"Arti" };
    this.N_BARIS     = Math.max(2, Math.min(jumlahBaris || this.N_BARIS || 6, this.pool.length));
    this.totalKata   = this.pool.length;
    this.antrian     = 0;
    this.benar       = 0;
    this.salah       = 0;
    this.selesaiKata = 0;
    this.pilih       = null;
    this._sedang     = false;

    const nAwal = Math.min(this.N_BARIS, this.pool.length);
    this.slotKiri  = [];
    this.slotKanan = [];
    for (let i = 0; i < nAwal; i++) { this.slotKiri.push(this.pool[i]); }
    this.antrian = nAwal;
    this.slotKanan = acak(this.slotKiri);   // urutan kanan diacak terpisah dari kiri

    this.waktuMulai = Date.now();
    clearInterval(this._timerId);
    this._timerId = setInterval(() => this._updateWaktu(), 1000);

    this._render();
  },

  // Field yang tampil di sisi tertentu ("kiri"/"kanan"), sesuai arah & pasangan yang dipilih
  _fieldSisi(sisi) {
    const p = this.pasanganCfg;
    const aDiKiri = this.arah === "a-kiri";
    if (sisi === "kiri") return aDiKiri ? p.a : p.b;
    return aDiKiri ? p.b : p.a;
  },

  // ── RENDER PAPAN ──────────────────────────────────────────────
  _render() {
    const p = this.pasanganCfg;
    const aDiKiri   = this.arah === "a-kiri";
    const labelKiri  = aDiKiri ? `${p.iconA} ${p.labelA}` : `${p.iconB} ${p.labelB}`;
    const labelKanan = aDiKiri ? `${p.iconB} ${p.labelB}` : `${p.iconA} ${p.labelA}`;
    const fieldKiri  = this._fieldSisi("kiri");
    const fieldKanan = this._fieldSisi("kanan");

    const buatKartu = (w, sisi, idx, field) => {
      if (!w) return `<div class="cocok-kartu cocok-kosong"></div>`;
      const dipilih = this.pilih && this.pilih.sisi === sisi && this.pilih.idx === idx;
      const idAttr  = `id="cocok-${sisi}-${idx}"`;
      const clickAttr = `onclick="CocokKata._klik('${sisi}', ${idx})"`;

      if (field === "audio") {
        return `<button class="cocok-kartu cocok-audio ${dipilih ? 'cocok-dipilih' : ''}" ${idAttr} ${clickAttr}>🔊</button>`;
      }
      const teks = field === "hanzi" ? w.hanzi : field === "pinyin" ? w.pinyin : w.arti;
      const isHanzi = field === "hanzi";
      return `<button class="cocok-kartu ${isHanzi ? 'cocok-hanzi' : ''} ${dipilih ? 'cocok-dipilih' : ''}"
        ${idAttr} ${clickAttr}>${Vocab._esc(teks)}</button>`;
    };

    const barisKiri  = this.slotKiri.map((w,i) => buatKartu(w, "kiri", i, fieldKiri)).join("");
    const barisKanan = this.slotKanan.map((w,i) => buatKartu(w, "kanan", i, fieldKanan)).join("");
    const sisaSoal = this.totalKata - this.selesaiKata;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">🧩 Cocok Kata — Sisa ${sisaSoal} / ${this.totalKata}</div>
          <div class="skor-mini" id="cocok-skor">✅ ${this.benar} ❌ ${this.salah}</div>
        </div>
        <div class="progres-bar">
          <div class="progres-fill" style="width:${(this.selesaiKata/this.totalKata*100).toFixed(1)}%"></div>
        </div>
        <div class="cocok-timer" id="cocok-timer">⏱ ${this._formatWaktu(Date.now()-this.waktuMulai)}</div>
        <div class="soal-hint" style="margin:8px 0 12px">Klik satu kata, lalu klik pasangannya di sisi lain.${(fieldKiri==="audio"||fieldKanan==="audio") ? " 🔊 = klik untuk dengar audio." : ""}</div>
        <div class="cocok-papan">
          <div class="cocok-kolom">
            <div class="cocok-kolom-label">${labelKiri}</div>
            ${barisKiri}
          </div>
          <div class="cocok-kolom">
            <div class="cocok-kolom-label">${labelKanan}</div>
            ${barisKanan}
          </div>
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-abu" onclick="CocokKata.berhenti()">← Menu</button>
        </div>
      </div>`;
  },

  _updateWaktu() {
    const t = el("cocok-timer");
    if (t) t.textContent = "⏱ " + this._formatWaktu(Date.now() - this.waktuMulai);
  },

  _formatWaktu(ms) {
    const detik = Math.floor(ms / 1000);
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return `${m}:${s.toString().padStart(2,"0")}`;
  },

  // ── KLIK KARTU ─────────────────────────────────────────────────
  _klik(sisi, idx) {
    if (this._sedang) return;
    const arr = sisi === "kiri" ? this.slotKiri : this.slotKanan;
    const w = arr[idx];
    if (!w) return;   // slot kosong (sudah habis)

    // Kartu audio: selalu putar suara saat diklik, apa pun status pemilihan
    if (this._fieldSisi(sisi) === "audio") { TTS.mandarin(w.hanzi); }

    if (!this.pilih) {
      // Belum ada yang dipilih → pilih ini
      this.pilih = { sisi, idx };
      this._render();
      return;
    }

    if (this.pilih.sisi === sisi && this.pilih.idx === idx) {
      // Klik kartu yang sama 2x → batal pilih
      this.pilih = null;
      this._render();
      return;
    }

    if (this.pilih.sisi === sisi) {
      // Klik kartu lain di sisi yang sama → pindah prioritas ke kartu baru
      this.pilih = { sisi, idx };
      this._render();
      return;
    }

    // Klik di sisi berlawanan → cek kecocokan
    this._cekPasangan(this.pilih, { sisi, idx });
  },

  _cekPasangan(a, b) {
    const kiri  = a.sisi === "kiri" ? a : b;
    const kanan = a.sisi === "kiri" ? b : a;
    const wKiri  = this.slotKiri[kiri.idx];
    const wKanan = this.slotKanan[kanan.idx];
    if (!wKiri || !wKanan) { this.pilih = null; this._render(); return; }

    const cocok = wKiri.id === wKanan.id;
    this._sedang = true;

    // Tandai visual benar/salah sesaat
    const elKiri  = el(`cocok-kiri-${kiri.idx}`);
    const elKanan = el(`cocok-kanan-${kanan.idx}`);
    if (elKiri)  elKiri.classList.add(cocok ? "cocok-benar" : "cocok-salah");
    if (elKanan) elKanan.classList.add(cocok ? "cocok-benar" : "cocok-salah");

    if (cocok) {
      this.benar++;
      this.selesaiKata++;
      setTimeout(() => {
        this._gantiSlot(kiri.idx, kanan.idx);
        this.pilih = null;
        this._sedang = false;
        if (this.selesaiKata >= this.totalKata) { this._selesai(); }
        else { this._render(); }
      }, 500);
    } else {
      this.salah++;
      setTimeout(() => {
        this.pilih = null;
        this._sedang = false;
        this._render();
      }, 600);
    }
  },

  // Ganti slot yang sudah cocok dengan kata berikutnya dari antrian (jika ada)
  _gantiSlot(idxKiri, idxKanan) {
    if (this.antrian < this.pool.length) {
      const wBaru = this.pool[this.antrian];
      this.antrian++;
      this.slotKiri[idxKiri]   = wBaru;
      this.slotKanan[idxKanan] = wBaru;
    } else {
      this.slotKiri[idxKiri]   = null;
      this.slotKanan[idxKanan] = null;
    }
  },

  // ── SELESAI ──────────────────────────────────────────────────
  _selesai() {
    clearInterval(this._timerId);
    const totalWaktuMs = Date.now() - this.waktuMulai;
    App.catatSesiSelesai("vocab", this.benar, this.totalKata);
    const pct = this.totalKata ? Math.round((this.benar/(this.benar+this.salah || 1))*100) : 0;
    const emoji = this.salah === 0 ? "🏆" : this.salah <= 3 ? "👍" : "💪";

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Cocok Kata — Selesai! 🧩</h2>
        <div class="selesai-skor">
          <div>⏱ Waktu: <b>${this._formatWaktu(totalWaktuMs)}</b></div>
          <div>📚 Kata dicocokkan: <b>${this.totalKata}</b></div>
          <div>✅ Benar: <b>${this.benar}</b></div>
          <div>❌ Salah: <b>${this.salah}</b></div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="Vocab.pilihOpsiCocokKata()">🔄 Main Lagi</button>
          <button class="btn btn-biru" onclick="CocokKata.berhenti()">← Menu Vocab</button>
        </div>
      </div>`;
  },

  berhenti() {
    clearInterval(this._timerId);
    App.renderModul("vocab");
  },
};

// ================================================================
//  ALL IN — 7-step vocab mastery mode
// ================================================================
var AllIn = {

  soalList: [],           // kata-kata yang dipakai di sesi ini
  pinyinStrict: true,     // true = nada diperhatikan
  difficulty: "easy",     // "easy" = mundur 2 | "hard" = ulang dari awal step | "ambil" = kata salah 1x langsung muncul di akhir step
  stepIdx: 0,             // step saat ini (0-5)
  wordIdx: 0,             // kata saat ini dalam step
  _sedang: false,

  // statistik per kata per step
  // _stat[wordIdx][stepIdx] = { salah: 0, waktuMulai: 0, waktuTotal: 0, salahKe: [] }
  _stat: [],
  _errorCount: [],        // _errorCount[wordIdx][stepIdx] = jumlah salah
  _ambilQueue: [],        // kata yang harus muncul di akhir step (mode ambil)
  _retryMode: false,      // sedang retry kata yang salah
  _infinityRetry: false,  // menunggu jawab ulang soal ini benar dulu

  // Semua step yang tersedia
  ALL_STEPS: [
    { id:"audio-arti",       label:"Audio → Arti (Pilihan)", icon:"🔊", tipe:"pilihan",       star:true },
    { id:"hanzi-indo",       label:"Hanzi → Arti (Pilihan)", icon:"🈯", tipe:"pilihan",       star:false },
    { id:"audio-hanzi-arti", label:"Audio + Hanzi → Arti (Pilihan)", icon:"🔊🈯", tipe:"pilihan", star:false },
    { id:"hanzi-arti-suara", label:"Hanzi → Arti (Suara)",   icon:"🗣️", tipe:"speaking-arti", star:false },
    { id:"arti-audio",        label:"Arti → Audio (Pilihan)", icon:"🔉", tipe:"pilihan-audio",  star:false },
    { id:"audio-hanzi-suara",label:"Audio → Hanzi (Suara)",  icon:"🎤", tipe:"speaking-hanzi",star:true },
    { id:"audio-hanzi",      label:"Audio → Hanzi",          icon:"🎧", tipe:"ketik-hanzi",   star:false },
    { id:"audio-pinyin",     label:"Audio → Pinyin",         icon:"🎵", tipe:"ketik-pinyin",  star:false },
    { id:"hanzi-pinyin",     label:"Hanzi → Pinyin",         icon:"🔤", tipe:"ketik-pinyin",  star:false },
    { id:"indo-pinyin",      label:"Arti → Pinyin",          icon:"🔠", tipe:"ketik-pinyin",  star:false },
    { id:"arti-hanzi",       label:"Arti → Hanzi",           icon:"✍️", tipe:"ketik-hanzi",   star:true },
  ],

  // Step default yang aktif (bisa diubah user di opsi)
  activeStepIds: ["audio-arti","hanzi-indo","audio-hanzi","hanzi-pinyin","indo-pinyin","arti-hanzi"],

  get STEPS() {
    const order = this._stepOrder && this._stepOrder.length
      ? this._stepOrder
      : this.activeStepIds;
    return order.map(id => this.ALL_STEPS.find(s=>s.id===id)).filter(Boolean);
  },

  // ── INIT ─────────────────────────────────────────────────────
  async init() {
    const raw = await SetSoal.getSoalSiap("vocab", "hanzi-indo");
    if (!raw || !raw.length) {
      tampilToast("Tidak ada soal! Cek set soal yang dipilih.");
      return;
    }
    this.soalList = SetSoal.potongSoal(raw, "vocab");
    this._renderOpsiAwalAllIn();
  },

  // ── HALAMAN OPSI SEBELUM PREVIEW ────────────────────────────
  _renderOpsiAwalAllIn() {
    const n = this.soalList.length;
    const stepChecks = this.ALL_STEPS.map(s => {
      const aktif = this.activeStepIds.includes(s.id);
      return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:14px">
        <input type="checkbox" value="${s.id}" ${aktif?'checked':''} onchange="AllIn._toggleStep('${s.id}',this.checked)"
          style="width:18px;height:18px;cursor:pointer;flex-shrink:0">
        <span>${s.icon} ${s.label}</span>
      </label>`;
    }).join("");
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🔥 All In — ${n} Kata</div>
        <div class="soal-hint" style="margin-bottom:14px">
          Review semua ${n} kata, lalu jalani tahap latihan yang kamu pilih.
        </div>

        <div class="ss-section" style="margin-bottom:12px">
          <div class="ss-label">📋 Pilih Step yang Ingin Dilatih</div>
          <div style="display:flex;gap:4px;margin-bottom:8px">
            <button class="ss-btn" onclick="AllIn._selectAllSteps(true)" style="font-size:12px">✅ Semua</button>
            <button class="ss-btn" onclick="AllIn._selectAllSteps(false)" style="font-size:12px">❌ Batal Semua</button>
          </div>
          <div style="border:1.5px solid var(--c-border);border-radius:10px;padding:8px 12px">
            ${stepChecks}
          </div>
        </div>

        <div class="ss-section" style="margin-bottom:16px">
          <div class="ss-label">⚙️ Mode Jika Salah</div>
          <div class="ss-opsi-row" style="flex-wrap:wrap;gap:8px">
            <button class="ss-btn ${this.difficulty==='easy'?'aktif':''}"
              onclick="AllIn._setDifficulty('easy')">😊 Mudah (mundur 2 soal)</button>
            <button class="ss-btn ${this.difficulty==='hard'?'aktif':''}"
              onclick="AllIn._setDifficulty('hard')">💀 Hard (ulang dari awal step)</button>
            <button class="ss-btn ${this.difficulty==='ambil'?'aktif':''}"
              onclick="AllIn._setDifficulty('ambil')">🎴 Ambil (salah 1x → muncul di akhir step)</button>
          </div>
        </div>

        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="AllIn._validasiDanLanjutUrutan()">Atur Urutan Step ▶</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _renderUrutanStep() {
    const aktif = this.ALL_STEPS.filter(s => this.activeStepIds.includes(s.id));
    // Gunakan stepOrder jika sudah ada dan masih valid, else default urutan activeStepIds
    if (!this._stepOrder || this._stepOrder.length !== aktif.length ||
        !this._stepOrder.every(id => aktif.find(s=>s.id===id))) {
      this._stepOrder = aktif.map(s=>s.id);
    }
    const rows = this._stepOrder.map((id, i) => {
      const s = this.ALL_STEPS.find(x=>x.id===id);
      const isFirst = i === 0, isLast = i === this._stepOrder.length - 1;
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid var(--c-border);border-radius:8px;margin-bottom:6px;background:var(--c-card)">
        <span style="font-size:18px">${s.icon}</span>
        <span style="flex:1;font-size:14px">${s.label}</span>
        <span style="font-size:12px;color:var(--c-sub);min-width:28px;text-align:center">
          ${i+1}
        </span>
        <button onclick="AllIn._moveStep('${id}',-1)" ${isFirst?'disabled':''} 
          style="background:none;border:1px solid var(--c-border);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:14px;opacity:${isFirst?'0.3':'1'}">▲</button>
        <button onclick="AllIn._moveStep('${id}',1)" ${isLast?'disabled':''}
          style="background:none;border:1px solid var(--c-border);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:14px;opacity:${isLast?'0.3':'1'}">▼</button>
      </div>`;
    }).join("");
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🔥 All In — Urutan Step</div>
        <div class="soal-hint" style="margin-bottom:14px">
          Atur urutan step latihan menggunakan tombol ▲ ▼. Step paling atas dikerjakan pertama.
        </div>
        <div style="margin-bottom:16px">${rows}</div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="AllIn.mulaiPreview()">▶ Mulai Review Kata</button>
          <button class="btn btn-abu" onclick="AllIn._renderOpsiAwalAllIn()">← Kembali</button>
        </div>
      </div>`;
  },

  _moveStep(id, dir) {
    const idx = this._stepOrder.indexOf(id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this._stepOrder.length) return;
    [this._stepOrder[idx], this._stepOrder[newIdx]] = [this._stepOrder[newIdx], this._stepOrder[idx]];
    this._renderUrutanStep();
  },

  _toggleStep(id, checked) {
    if (checked) {
      if (!this.activeStepIds.includes(id)) this.activeStepIds.push(id);
    } else {
      this.activeStepIds = this.activeStepIds.filter(x => x !== id);
    }
    this.activeStepIds = this.ALL_STEPS.map(s=>s.id).filter(id => this.activeStepIds.includes(id));
    this._stepOrder = null; // reset urutan saat pilihan berubah
  },

  _selectAllSteps(all) {
    this.activeStepIds = all ? this.ALL_STEPS.map(s=>s.id) : [];
    this._stepOrder = null;
    this._renderOpsiAwalAllIn();
  },

  _validasiDanLanjutUrutan() {
    if (this.activeStepIds.length === 0) {
      tampilToast("Pilih minimal 1 step dulu!");
      return;
    }
    this._renderUrutanStep();
  },

  _setDifficulty(v) {
    this.difficulty = v;
    this._renderOpsiAwalAllIn();
  },

  // ── PREVIEW SEMUA KATA ───────────────────────────────────────
  mulaiPreview() {
    this._previewIdx = 0;
    this._tampilPreview();
  },

  _tampilPreview() {
    const list = this.soalList;
    const n = list.length;

    let tabelBaris = list.map((item, i) => `
      <tr>
        <td style="text-align:center;font-weight:700;color:var(--c-sub);padding:8px 6px;white-space:nowrap;width:32px">${i+1}</td>
        <td style="padding:8px 6px;white-space:nowrap;min-width:120px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:22px;font-weight:900;color:var(--c-hanzi);line-height:1.2;white-space:nowrap">${item.hanzi}</span>
            <button style="background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0;display:inline-flex;align-items:center"
              onclick="TTS.mandarin('${(item.hanzi||'').replace(/'/g,"\\'")}')">🔊</button>
          </div>
        </td>
        <td style="font-size:13px;color:var(--c-biru);padding:8px 6px;vertical-align:middle;white-space:nowrap">${item.pinyin||'-'}</td>
        <td style="font-size:13px;padding:8px 6px;vertical-align:middle;color:var(--c-text)">${item.arti||'-'}</td>
      </tr>
    `).join("");

    el("konten-utama").innerHTML = `
      <div class="soal-wrap" style="max-width:560px;margin:0 auto">
        <div class="label-mode">📖 Review Kata — ${n} Kata</div>
        <div class="soal-hint" style="margin-bottom:10px">Pelajari semua kata di bawah, lalu tekan <b>Mulai Latihan</b>.</div>
        <div style="overflow-x:auto;border-radius:10px;border:1.5px solid var(--c-border)">
          <table style="min-width:360px;border-collapse:collapse;font-size:14px;table-layout:auto">
            <thead>
              <tr style="background:var(--c-biru);color:#fff">
                <th style="padding:8px 6px;text-align:center;width:32px">#</th>
                <th style="padding:8px 6px;text-align:left;white-space:nowrap">Hanzi</th>
                <th style="padding:8px 6px;text-align:left;white-space:nowrap">Pinyin</th>
                <th style="padding:8px 6px;text-align:left">Arti</th>
              </tr>
            </thead>
            <tbody>${tabelBaris}</tbody>
          </table>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:16px">
          <button class="btn btn-hijau" onclick="AllIn.mulaiLatihan()">▶ Mulai Latihan</button>
          <button class="btn btn-abu" onclick="AllIn._renderOpsiAwalAllIn()">← Opsi</button>
        </div>
      </div>`;
  },

  // ── MULAI LATIHAN ────────────────────────────────────────────
  mulaiLatihan() {
    this.stepIdx = 0;
    this.wordIdx = 0;
    this._sedang = false;
    this._infinityRetry = false;
    this._inAmbilExtra = false;
    this._ambilExtraList = [];
    this._ambilExtraIdx = 0;
    const nSteps = this.STEPS.length;
    this._ambilQueue = Array.from({length:nSteps}, () => []);
    this._errorCount = this.soalList.map(() => Array(nSteps).fill(0));
    this._stat = this.soalList.map(() => Array.from({length:nSteps}, () => ({
      salah: 0, waktuMulai: 0, waktuTotal: 0
    })));
    this._tampilStepIntro();
  },

  // ── INTRO STEP ───────────────────────────────────────────────
  _tampilStepIntro() {
    const step = this.STEPS[this.stepIdx];
    const n = this.soalList.length;
    const progBar = this.STEPS.map((s, i) => `
      <div style="flex:1;height:8px;border-radius:99px;
        background:${i < this.stepIdx ? 'var(--c-hijau)' : i === this.stepIdx ? 'var(--c-biru)' : 'var(--c-border)'}"></div>
    `).join("");

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div style="display:flex;gap:4px;margin-bottom:16px">${progBar}</div>
        <div class="selesai-emoji" style="font-size:48px">${step.icon}</div>
        <div class="label-mode">Tahap ${this.stepIdx+1} / ${this.STEPS.length} — ${step.label}</div>
        <div class="soal-hint" style="margin:10px 0 18px">
          Kamu akan menjawab <b>${n} soal</b> untuk tahap ini.<br>
          ${this._deskStep(step.id)}
        </div>
        ${step.tipe === 'ketik-pinyin' ? `
          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px">
            <button class="ss-btn ${this.pinyinStrict?'aktif':''}"
              onclick="AllIn._setPinyinStrictInline(true)">🎯 Hard</button>
            <button class="ss-btn ${!this.pinyinStrict?'aktif':''}"
              onclick="AllIn._setPinyinStrictInline(false)">🌊 Longgar</button>
          </div>` : ''}
        ${(['audio-pinyin','audio-hanzi'].includes(step.id)) ? (() => {
          const sid = step.id;
          const val = (AllIn._tampilArtiDiKunci||{})[sid] || false;
          const label = sid === 'audio-pinyin' ? 'pinyin' : 'hanzi';
          return `<div style="margin-bottom:14px">
            <div style="font-size:13px;color:var(--c-sub);margin-bottom:6px">📌 Kunci Jawaban — tampilkan arti juga?</div>
            <div style="display:flex;gap:8px;justify-content:center">
              <button class="ss-btn ${val?'aktif':''}"
                onclick="AllIn._setTampilArtiDiKunci('${sid}',true)">📖 Ya, tampilkan</button>
              <button class="ss-btn ${!val?'aktif':''}"
                onclick="AllIn._setTampilArtiDiKunci('${sid}',false)">🚫 Tidak</button>
            </div>
          </div>`;
        })() : ''}
        ${step.tipe === 'pilihan' ? (() => {
          const sid = step.id;
          const val = (AllIn._pinyinDiKunci||{})[sid] || false;
          return `<div style="margin-bottom:14px">
            <div style="font-size:13px;color:var(--c-sub);margin-bottom:6px">📌 Kunci Jawaban — tampilkan pinyin?</div>
            <div style="display:flex;gap:8px;justify-content:center">
              <button class="ss-btn ${val?'aktif':''}"
                onclick="AllIn._setPinyinDiKunci('${sid}',true)">🔤 Ya, tampilkan</button>
              <button class="ss-btn ${!val?'aktif':''}"
                onclick="AllIn._setPinyinDiKunci('${sid}',false)">🚫 Tidak</button>
            </div>
          </div>`;
        })() : ''}
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="AllIn._mulaiStep()">▶ Mulai Tahap Ini</button>
          <button class="btn btn-abu" onclick="AllIn.mulaiPreview()">← Review Kata Lagi</button>
        </div>
      </div>`;
  },

  _setPinyinStrictInline(v) {
    this.pinyinStrict = v;
    this._tampilStepIntro();
  },

  _setPinyinDiKunci(stepId, v) {
    if (!this._pinyinDiKunci) this._pinyinDiKunci = {};
    this._pinyinDiKunci[stepId] = v;
    this._tampilStepIntro();
  },

  _setTampilArtiDiKunci(stepId, v) {
    if (!this._tampilArtiDiKunci) this._tampilArtiDiKunci = {};
    this._tampilArtiDiKunci[stepId] = v;
    this._tampilStepIntro();
  },

  _deskStep(id) {
    const m = {
      "audio-arti":       "Dengarkan audio → pilih arti yang benar (4 pilihan).",
      "arti-audio":        "Lihat arti → pilih audio (hanzi) yang benar (4 pilihan).",
      "audio-hanzi-suara": "Dengarkan audio → ucapkan kembali dalam Mandarin (shadowing).",
      "hanzi-indo":       "Lihat karakter Hanzi → pilih artinya (4 pilihan).",
      "audio-hanzi":      "Dengarkan audio → ketik karakter Hanzi-nya.",
      "audio-pinyin":     "Dengarkan audio → ketik Pinyin-nya.",
      "hanzi-pinyin":     "Lihat Hanzi → ketik Pinyin-nya.",
      "indo-pinyin":      "Lihat arti Indonesia → ketik Pinyin-nya.",
      "arti-hanzi":       "Lihat arti Indonesia → ketik karakter Hanzi-nya.",
      "audio-hanzi-arti": "Dengarkan audio + lihat Hanzi → pilih arti yang benar (4 pilihan).",
      "hanzi-arti-suara": "Lihat Hanzi → ucapkan artinya dengan suara.",
    };
    return m[id] || "";
  },

  // ── MULAI STEP (setup wordIdx, ambilQueue per step) ──────────
  _mulaiStep() {
    this.wordIdx = 0;
    this._infinityRetry = false;
    this._ambilQueue[this.stepIdx] = [];
    this._tampilSoalAllIn();
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  _tampilSoalAllIn() {
    this._sedang = false;
    this._inAmbilExtra = false;
    const step = this.STEPS[this.stepIdx];
    const stepList = this._buildStepList();

    if (this.wordIdx >= stepList.length) {
      // Cek apakah ada ambilQueue untuk step ini
      if (this.difficulty === 'ambil' && this._ambilQueue[this.stepIdx].length > 0) {
        const extra = this._ambilQueue[this.stepIdx];
        this._ambilQueue[this.stepIdx] = [];
        // Insert ekstra di posisi sekarang (akhir step)
        // Kita restart step dari ekstra tersebut
        this._ambilExtraList = extra;
        this._ambilExtraIdx = 0;
        this._tampilSoalAmbilExtra();
        return;
      }
      // Selesai step ini
      this._selesaiStep();
      return;
    }

    const item = stepList[this.wordIdx];
    const total = stepList.length;
    const nStep = this.stepIdx;
    const cfg = App._settings;

    const progBar = this.STEPS.map((s, i) => `
      <div style="flex:1;height:6px;border-radius:99px;margin:0 1px;
        background:${i < nStep ? 'var(--c-hijau)' : i === nStep ? 'var(--c-biru)' : 'var(--c-border)'}"></div>
    `).join("");

    let html = `
      <div class="soal-header">
        <div class="progres-teks">${step.icon} ${step.label} — ${this.wordIdx+1}/${total}</div>
        <div class="skor-mini" id="ai-skor"></div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${(this.wordIdx/total*100).toFixed(1)}%"></div>
      </div>
      <div style="display:flex;gap:3px;margin:6px 0">${progBar}</div>
    `;

    // Rekam waktu mulai
    this._stat[this._origIdx(item)][this.stepIdx].waktuMulai = Date.now();

    html += this._renderSoalStep(step, item);
    el("konten-utama").innerHTML = html;
    this._pasangEventAllIn(step, item);

    // Auto-play audio
    if (["audio-arti","audio-hanzi","audio-hanzi-suara","audio-pinyin","audio-hanzi-arti"].includes(step.id)) {
      setTimeout(() => TTS.mandarin(item.hanzi), 350);
    }
  },

  // ── Ambil Extra (kata yang salah 1x di akhir step) ──────────
  _tampilSoalAmbilExtra() {
    this._sedang = false;
    this._inAmbilExtra = true;
    const extra = this._ambilExtraList;
    const step = this.STEPS[this.stepIdx];
    const cfg = App._settings;

    if (this._ambilExtraIdx >= extra.length) {
      this._inAmbilExtra = false;
      this._selesaiStep();
      return;
    }

    const item = extra[this._ambilExtraIdx];
    const total = extra.length;
    const nStep = this.stepIdx;

    const progBar = this.STEPS.map((s, i) => `
      <div style="flex:1;height:6px;border-radius:99px;margin:0 1px;
        background:${i < nStep ? 'var(--c-hijau)' : i === nStep ? 'var(--c-biru)' : 'var(--c-border)'}"></div>
    `).join("");

    let html = `
      <div class="soal-header">
        <div class="progres-teks">🎴 Kata Ekstra — sisa ${extra.length - this._ambilExtraIdx}/${extra.length}</div>
        <div class="skor-mini" id="ai-skor"></div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${(this._ambilExtraIdx/total*100).toFixed(1)}%"></div>
      </div>
      <div style="display:flex;gap:3px;margin:6px 0">${progBar}</div>
      <div style="background:#fff3e0;border-radius:10px;padding:6px 12px;margin-bottom:8px;font-size:13px;color:#e65100">
        🎴 Kata ini kamu salah sebelumnya, coba lagi!
      </div>
    `;

    this._stat[this._origIdx(item)][this.stepIdx].waktuMulai = Date.now();
    html += this._renderSoalStep(step, item);
    el("konten-utama").innerHTML = html;
    this._pasangEventAllIn(step, item, true);

    if (["audio-arti","audio-hanzi","audio-hanzi-suara","audio-pinyin","audio-hanzi-arti"].includes(step.id)) {
      setTimeout(() => TTS.mandarin(item.hanzi), 350);
    }
  },

  // ── Daftar kata untuk step (urutan asli) ────────────────────
  _buildStepList() {
    return [...this.soalList];
  },

  // ── Cari index asli kata di soalList ────────────────────────
  _origIdx(item) {
    return this.soalList.findIndex(s => s.hanzi === item.hanzi);
  },

  // ── RENDER SOAL BERDASAR STEP ────────────────────────────────
  _renderSoalStep(step, item) {
    const id = step.id;
    const pool = this.soalList.filter(v => v.arti !== item.arti);
    const safeEsc = s => (s||"").replace(/'/g,"\\'").replace(/"/g,"&quot;");

    if (id === "audio-arti") {
      const sarr = acak(pool.length >= 3 ? pool : DB.vocab.filter(v=>v.arti!==item.arti)).slice(0,3);
      const semua = acak([item.arti, ...sarr.map(v=>v.arti)]);
      return `
        <div class="soal-wrap">
          <div class="label-mode">🔊 Audio → Arti</div>
          <div class="audio-btn-wrap">
            <button class="btn-audio" onclick="TTS.mandarin('${safeEsc(item.hanzi)}')">🔊 Putar Audio</button>
          </div>
          <div class="soal-hint">Dengarkan lalu pilih artinya:</div>
          <div class="pilihan-grid" id="pilihan-cont">
            ${semua.map(p=>`<button class="btn-pilihan"
              onclick="AllIn._jawabPilihan('${safeEsc(p)}','${safeEsc(item.arti)}')">${p}</button>`).join("")}
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row"><button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button></div>
        </div>`;
    }

    if (id === "hanzi-indo") {
      const sarr = acak(pool.length >= 3 ? pool : DB.vocab.filter(v=>v.arti!==item.arti)).slice(0,3);
      const semua = acak([item.arti, ...sarr.map(v=>v.arti)]);
      return `
        <div class="soal-wrap">
          <div class="label-mode">🈯 Hanzi → Arti</div>
          <div class="soal-hanzi">${item.hanzi}</div>
          <div class="soal-hint">Apa arti kata di atas?</div>
          <div class="pilihan-grid" id="pilihan-cont">
            ${semua.map(p=>`<button class="btn-pilihan"
              onclick="AllIn._jawabPilihan('${safeEsc(p)}','${safeEsc(item.arti)}')">${p}</button>`).join("")}
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row"><button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button></div>
        </div>`;
    }

    if (id === "arti-audio") {
      const sarr = acak(pool.length >= 3 ? pool : DB.vocab.filter(v=>v.arti!==item.arti)).slice(0,3);
      const kandidat = acak([item, ...sarr]);
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🔉 Arti → Audio (Pilihan)</div>
          <div class="soal-arti">${item.arti}</div>
          <div class="soal-hint">Dengarkan lalu pilih yang sesuai:</div>
          <div class="pilihan-grid" id="pilihan-cont">
            ${kandidat.map(v=>`<button class="btn-pilihan" data-hanzi="${safeEsc(v.hanzi)}"
              onclick="AllIn._pilihAudio('${safeEsc(v.hanzi)}',this)">
              🔊 <span style="font-size:18px;font-weight:900">${v.hanzi}</span>
            </button>`).join("")}
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" id="btn-submit-audio" onclick="AllIn._submitPilihanAudio('${safeEsc(item.hanzi)}')" disabled
              style="opacity:0.4">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "audio-hanzi") {
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🎧 Audio → Hanzi</div>
          <div class="audio-btn-wrap">
            <button class="btn-audio" onclick="TTS.mandarin('${safeEsc(item.hanzi)}')">🔊 Putar Audio</button>
          </div>
          <div class="soal-hint">Dengarkan lalu ketik Hanzi-nya:</div>
          <input type="text" id="input-ai" class="input-jawab" placeholder="Ketik Hanzi..." autocomplete="off" style="display:block;margin:0 auto;">
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._jawabKetikHanzi()">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "audio-pinyin") {
      const modeTag = this.pinyinStrict
        ? `<span class="pinyin-mode-tag ketat">🎯 Ketat</span>`
        : `<span class="pinyin-mode-tag longgar">🌊 Longgar</span>`;
      const inputArea = this.pinyinStrict
        ? `<div id="kb-pinyin-cont"></div>`
        : `<input type="text" id="input-ai" class="input-jawab" placeholder="Ketik pinyin..." autocomplete="off" style="display:block;margin:0 auto;">`;
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🎵 Audio → Pinyin ${modeTag}</div>
          <div class="audio-btn-wrap">
            <button class="btn-audio" onclick="TTS.mandarin('${safeEsc(item.hanzi)}')">🔊 Putar Audio</button>
          </div>
          <div class="soal-hint">Dengarkan lalu tulis Pinyin-nya${this.pinyinStrict?" (dengan tanda nada)":""}:</div>
          ${inputArea}
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._jawabPinyin()">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "hanzi-pinyin") {
      const modeTag = this.pinyinStrict
        ? `<span class="pinyin-mode-tag ketat">🎯 Ketat</span>`
        : `<span class="pinyin-mode-tag longgar">🌊 Longgar</span>`;
      const inputArea = this.pinyinStrict
        ? `<div id="kb-pinyin-cont"></div>`
        : `<input type="text" id="input-ai" class="input-jawab" placeholder="Ketik pinyin..." autocomplete="off" style="display:block;margin:0 auto;">`;
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🔤 Hanzi → Pinyin ${modeTag}</div>
          <div class="soal-hanzi">${item.hanzi}</div>
          <div class="soal-hint">Tulis Pinyin${this.pinyinStrict?" (dengan tanda nada)":""}:</div>
          ${inputArea}
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._jawabPinyin()">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "indo-pinyin") {
      const modeTag = this.pinyinStrict
        ? `<span class="pinyin-mode-tag ketat">🎯 Ketat</span>`
        : `<span class="pinyin-mode-tag longgar">🌊 Longgar</span>`;
      const inputArea = this.pinyinStrict
        ? `<div id="kb-pinyin-cont"></div>`
        : `<input type="text" id="input-ai" class="input-jawab" placeholder="Ketik pinyin..." autocomplete="off" style="display:block;margin:0 auto;">`;
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🔠 Indo → Pinyin ${modeTag}</div>
          <div class="soal-arti">${item.arti}</div>
          <div class="soal-hint">Tulis Pinyin kata di atas${this.pinyinStrict?" (dengan tanda nada)":""}:</div>
          ${inputArea}
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._jawabPinyin()">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "arti-hanzi") {
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">✍️ Arti → Hanzi</div>
          <div class="soal-arti">${item.arti}</div>
          <div class="soal-hint">Ketik karakter Hanzi-nya:</div>
          <input type="text" id="input-ai" class="input-jawab" placeholder="Ketik Hanzi..." autocomplete="off" style="display:block;margin:0 auto;">
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._jawabKetikHanzi()">✅ Submit</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
        </div>`;
    }

    if (id === "audio-hanzi-arti") {
      const pilihanAHA = acak(pool.length >= 3 ? pool : this.soalList.filter(v=>v.hanzi!==item.hanzi)).slice(0,3);
      const kandidatAHA = acak([item, ...pilihanAHA]);
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🔊🈯 Audio + Hanzi → Arti</div>
          <div class="audio-btn-wrap">
            <button class="btn-audio" onclick="TTS.mandarin('${safeEsc(item.hanzi)}')">🔊 Putar Audio</button>
          </div>
          <div class="soal-hanzi">${item.hanzi}</div>
          <div class="soal-hint">Pilih arti yang tepat:</div>
          <div class="pilihan-grid">
            ${kandidatAHA.map(v=>`<button class="btn-pilihan"
              onclick="AllIn._jawabPilihan('${safeEsc(v.arti)}','${safeEsc(item.arti)}')">${v.arti}</button>`).join("")}
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div class="btn-row" style="justify-content:center"><button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button></div>
        </div>`;
    }

    if (id === "hanzi-arti-suara") {
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🗣️ Hanzi → Arti (Suara)</div>
          <div class="soal-hanzi">${item.hanzi}</div>
          <div class="soal-hint">Lihat Hanzi lalu ucapkan artinya:</div>
          <div id="speaking-status" style="margin:12px 0;font-size:14px;color:var(--c-sub)">Tekan rekam untuk mulai</div>
          <div style="display:flex;gap:10px;justify-content:center;margin:10px 0">
            <button class="btn btn-hijau" id="btn-rekam" onclick="AllIn._mulaiRekam('arti')">🎙️ Rekam Jawaban</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div id="btn-lanjut-speaking" style="display:none;margin-top:8px">
            <button class="btn btn-biru" onclick="AllIn._lanjutDariSpeaking()">▶ Lanjut</button>
          </div>
        </div>`;
    }

    if (id === "audio-hanzi-suara") {
      return `
        <div class="soal-wrap" style="text-align:center">
          <div class="label-mode">🎤 Audio → Hanzi (Suara / Shadowing)</div>
          <div class="audio-btn-wrap">
            <button class="btn-audio" onclick="TTS.mandarin('${safeEsc(item.hanzi)}')">🔊 Putar Audio</button>
          </div>
          <div class="soal-hint">Dengarkan audio lalu ucapkan kembali dalam bahasa Mandarin:</div>
          <div id="speaking-status" style="margin:12px 0;font-size:14px;color:var(--c-sub)">Tekan rekam untuk mulai</div>
          <div style="display:flex;gap:10px;justify-content:center;margin:10px 0">
            <button class="btn btn-hijau" id="btn-rekam" onclick="AllIn._mulaiRekam('hanzi')">🎙️ Rekam & Shadowing</button>
            <button class="btn btn-abu" onclick="AllIn._skipAllIn()">⏭ Skip</button>
          </div>
          <div class="hasil-box" id="hasil-ai"></div>
          <div id="btn-lanjut-speaking" style="display:none;margin-top:8px">
            <button class="btn btn-biru" onclick="AllIn._lanjutDariSpeaking()">▶ Lanjut</button>
          </div>
        </div>`;
    }

    return `<div class="soal-wrap"><div class="soal-hint">Step tidak dikenal.</div></div>`;
  },

  // ── PASANG EVENT ─────────────────────────────────────────────
  _pasangEventAllIn(step, item, isExtra) {
    const id = step.id;
    if (id === "audio-hanzi-suara" || id === "hanzi-arti-suara") {
      // Speaking step — tidak perlu pasang input event
      return;
    }
    if (id === "hanzi-pinyin" || id === "indo-pinyin" || id === "audio-pinyin") {
      if (this.pinyinStrict) {
        setTimeout(() => buildKbPinyin("kb-display", null), 50);
      } else {
        setTimeout(() => {
          const inp = el("input-ai");
          if (inp) { inp.focus(); inp.onkeydown = e => { if(e.key==="Enter") AllIn._jawabPinyin(); }; }
        }, 100);
      }
    } else {
      setTimeout(() => {
        const inp = el("input-ai");
        if (inp) { inp.focus(); inp.onkeydown = e => { if(e.key==="Enter") AllIn._jawabKetikHanzi(); }; }
      }, 100);
    }
  },

  // ── JAWAB PILIHAN ─────────────────────────────────────────────
  _pilihAudio(hanzi, btnEl) {
    // Play audio dan highlight pilihan, aktifkan submit
    TTS.mandarin(hanzi);
    el("pilihan-cont")?.querySelectorAll(".btn-pilihan").forEach(b => b.classList.remove("dipilih"));
    btnEl.classList.add("dipilih");
    this._pilihanAudioDipilih = hanzi;
    const btnSubmit = el("btn-submit-audio");
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.style.opacity = "1"; }
  },

  _submitPilihanAudio(hanziBenar) {
    const hanziDipilih = this._pilihanAudioDipilih;
    if (!hanziDipilih) return;
    const benar = hanziDipilih === hanziBenar;
    el("pilihan-cont")?.querySelectorAll(".btn-pilihan").forEach(b => {
      b.disabled = true;
      const h = b.dataset.hanzi;
      if (h === hanziBenar) b.classList.add("pilihan-benar");
      else if (h === hanziDipilih && !benar) b.classList.add("pilihan-salah");
    });
    const item = this._currentItem();
    const hEl = el("hasil-ai");
    if (hEl) {
      const py = item.pinyin ? ` (${item.pinyin})` : "";
      hEl.innerHTML = benar
        ? `✅ Benar! <b>${item.hanzi}</b>${py} = ${item.arti}`
        : `❌ Salah. Jawaban: <b>${item.hanzi}</b>${py} = ${item.arti}`;
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
    }
    const btnSubmit = el("btn-submit-audio");
    if (btnSubmit) btnSubmit.disabled = true;
    this._prosesJawab(benar, item);
  },

  _jawabPilihan(dipilih, jawaban) {
    if (this._sedang) return;
    const benar = dipilih === jawaban;
    el("pilihan-cont")?.querySelectorAll(".btn-pilihan").forEach(b => {
      b.disabled = true;
      if (b.innerText === jawaban) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });
    const item = this._currentItem();
    const step = this.STEPS[this.stepIdx];
    const hEl = el("hasil-ai");
    if (hEl) {
      const tampilPinyin = (this._pinyinDiKunci||{})[step.id] && item.pinyin;
      if (benar) {
        // Benar: selalu tampil hanzi + arti (tanpa pinyin)
        hEl.innerHTML = `✅ Benar! <b>${item.hanzi}</b> = ${item.arti}`;
      } else {
        // Salah: jika pilih pinyin → pinyin + arti; jika tidak → arti saja
        hEl.innerHTML = tampilPinyin
          ? `❌ Salah. <span style="color:var(--c-biru)">${item.pinyin}</span> = ${item.arti}`
          : `❌ Salah. Jawaban: ${item.arti}`;
      }
      hEl.className = "hasil-box " + (benar?"benar":"salah");
    }
    this._prosesJawab(benar, item);
  },

  // ── JAWAB KETIK HANZI ─────────────────────────────────────────
  _jawabKetikHanzi() {
    if (this._sedang) return;
    const inp = el("input-ai");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const item = this._currentItem();
    const benar = cekHanzi(input, item.hanzi);
    const hEl = el("hasil-ai");
    if (hEl) {
      const stepIdH = this.STEPS[this.stepIdx]?.id;
      const tampilArtiH = (this._tampilArtiDiKunci||{})[stepIdH];
      const artiInfoH = tampilArtiH && item.arti ? ` = ${item.arti}` : "";
      hEl.innerHTML = benar
        ? `✅ Benar! <b>${item.hanzi}</b>${item.pinyin?" ("+item.pinyin+")":""}${artiInfoH}`
        : `❌ Salah. Jawaban: <b>${item.hanzi}</b>${item.pinyin?" ("+item.pinyin+")":""}${artiInfoH}`;
      hEl.className = "hasil-box " + (benar?"benar":"salah");
    }
    if (inp) inp.disabled = true;
    this._prosesJawab(benar, item);
  },

  // ── JAWAB PINYIN ──────────────────────────────────────────────
  _jawabPinyin() {
    if (this._sedang) return;
    let input;
    if (this.pinyinStrict) {
      input = (typeof getKbTeks === 'function') ? getKbTeks() : "";
    } else {
      const inp = el("input-ai");
      input = inp ? inp.value.trim() : "";
    }
    if (!input) return;
    const item = this._currentItem();
    const benar = cekPinyin(input, item.pinyin, this.pinyinStrict);
    const hEl = el("hasil-ai");
    if (hEl) {
      const stepIdP = this.STEPS[this.stepIdx]?.id;
      const tampilArtiP = (this._tampilArtiDiKunci||{})[stepIdP];
      const artiInfoP = tampilArtiP && item.arti ? ` = ${item.arti}` : "";
      hEl.innerHTML = benar
        ? `✅ Benar! Pinyin: <b>${item.pinyin}</b>${artiInfoP}`
        : `❌ Salah. Pinyin benar: <b>${item.pinyin}</b>${artiInfoP}`;
      hEl.className = "hasil-box " + (benar?"benar":"salah");
    }
    this._prosesJawab(benar, item);
  },

  // ── SPEAKING (audio/hanzi → arti suara) ──────────────────────
  _mulaiRekam(mode) {
    // mode: 'arti' = jawab arti (bahasa Indonesia), 'hanzi' = shadowing (bahasa Mandarin)
    this._speakingMode = mode || 'arti';
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      el("speaking-status").textContent = "❌ Browser tidak mendukung speech recognition. Gunakan Chrome.";
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._sr = new SR();
    this._sr.lang = mode === 'hanzi' ? "zh-CN" : "id-ID";
    this._sr.interimResults = false;
    this._sr.maxAlternatives = 5;

    el("speaking-status").textContent = mode === 'hanzi' ? "🎙️ Ucapkan dalam Mandarin..." : "🎙️ Sedang mendengarkan...";
    const btnRekam = el("btn-rekam");
    if (btnRekam) { btnRekam.disabled = true; btnRekam.textContent = "⏳ Rekam..."; }

    this._sr.onresult = (e) => {
      const transkrip = Array.from(e.results[0]).map(r => r.transcript.trim());
      this._cekJawabanSpeaking(transkrip);
    };
    this._sr.onerror = (e) => {
      el("speaking-status").textContent = `❌ Error: ${e.error}. Coba lagi.`;
      if (btnRekam) { btnRekam.disabled = false; btnRekam.textContent = "🎙️ Rekam Jawaban"; }
    };
    this._sr.onend = () => {
      if (btnRekam) { btnRekam.disabled = false; btnRekam.textContent = "🎙️ Rekam Lagi"; }
    };
    this._sr.start();
  },

  _cekJawabanSpeaking(transkripArr) {
    const item = this._currentItem();
    const mode = this._speakingMode || 'arti';
    let benar;
    let pesanBenar, pesanSalah;

    if (mode === 'hanzi') {
      // Shadowing: cocokkan dengan hanzi atau pinyin
      benar = transkripArr.some(t => {
        const t2 = t.toLowerCase().replace(/\s/g,'');
        const hanzi = (item.hanzi||'').toLowerCase();
        const pinyin = (item.pinyin||'').toLowerCase().replace(/\s/g,'').replace(/[1-5]/g,'');
        return t2.includes(hanzi) || hanzi.includes(t2) || t2.includes(pinyin) || pinyin.includes(t2);
      });
      pesanBenar = `✅ Benar! <b>${item.hanzi}</b> (${item.pinyin})`;
      pesanSalah = `❌ Didengar: "${transkripArr[0]}" — Jawaban: <b>${item.hanzi}</b> (${item.pinyin})`;
    } else {
      benar = transkripArr.some(t => this._cocokArti(t, item.arti));
      pesanBenar = `✅ Benar! Arti: <b>${item.arti}</b>`;
      pesanSalah = `❌ Didengar: "${transkripArr[0]}" — Jawaban: <b>${item.arti}</b>`;
    }

    el("speaking-status").textContent = `Didengar: "${transkripArr[0]}"`;
    const hEl = el("hasil-ai");
    if (hEl) {
      hEl.innerHTML = benar ? pesanBenar : pesanSalah;
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
    }
    const btnL = el("btn-lanjut-speaking");
    if (btnL) btnL.style.display = "block";
    this._prosesJawab(benar, item);
  },

  // Helper: cocokkan jawaban ucapan dengan arti kata
  // Arti bisa: "arti1; arti2 || bersih dari (keterangan)"
  _cocokArti(ucapan, artiRaw) {
    // Ambil setelah || jika ada, atau seluruh string
    const bagian = artiRaw.includes("||") ? artiRaw.split("||")[1] : artiRaw;
    // Split per ";"
    const daftar = bagian.split(";").map(a => {
      // Hapus tanda kurung dan isinya, trim
      return a.replace(/\(.*?\)/g, "").trim().toLowerCase();
    }).filter(Boolean);
    const u = ucapan.toLowerCase().trim();
    return daftar.some(a => u.includes(a) || a.includes(u));
  },

  _lanjutDariSpeaking() {
    // Tombol manual lanjut setelah speaking (backup jika prosesJawab sudah jalan)
    const btnL = el("btn-lanjut-speaking");
    if (btnL) btnL.style.display = "none";
  },

  // ── SKIP ──────────────────────────────────────────────────────
  _skipAllIn() {
    if (this._sedang) return;
    const item = this._currentItem();
    const hEl = el("hasil-ai");
    if (hEl) {
      hEl.innerHTML = `⏭ Di-skip. Jawaban: <b>${item.hanzi}</b> = ${item.arti}`;
      hEl.className = "hasil-box benar";
    }
    this._sedang = true;
    setTimeout(() => this._lanjutKata(true, item, true), 1500);
  },

  // ── ITEM SAAT INI ─────────────────────────────────────────────
  _currentItem() {
    // Jika sedang mode ambil extra
    if (this._inAmbilExtra && this._ambilExtraList && this._ambilExtraIdx < this._ambilExtraList.length) {
      return this._ambilExtraList[this._ambilExtraIdx];
    }
    return this._buildStepList()[this.wordIdx];
  },

  // ── PROSES JAWABAN ────────────────────────────────────────────
  _prosesJawab(benar, item) {
    if (this._sedang) return;
    this._sedang = true;

    const si = this.stepIdx;
    const wi = this._origIdx(item);

    // Catat waktu
    const waktuMulai = this._stat[wi][si].waktuMulai || Date.now();
    this._stat[wi][si].waktuTotal += (Date.now() - waktuMulai);

    if (!benar) {
      this._errorCount[wi][si]++;
      this._stat[wi][si].salah++;
    }

    // Jika sedang dalam retry mode
    if (this._infinityRetry) {
      this._prosesJawabRetry(benar, item);
      return;
    }

    setTimeout(() => this._lanjutKata(benar, item, false), benar ? 1500 : 2200);
  },

  // ── LANJUT KATA ───────────────────────────────────────────────
  _lanjutKata(benar, item, isSkip) {
    this._sedang = false;
    const si = this.stepIdx;
    const wi = this._origIdx(item);

    // Jika sedang mode ambil extra
    if (this._inAmbilExtra && this._ambilExtraList && this._ambilExtraIdx < this._ambilExtraList.length) {
      if (benar || isSkip) {
        // Benar/skip → lanjut ke kata ekstra berikutnya
        this._ambilExtraIdx++;
        this._tampilSoalAmbilExtra();
      } else {
        // Salah di extra → geser kata ini ke belakang antrean, lanjut ke berikutnya
        const salahItem = this._ambilExtraList[this._ambilExtraIdx];
        this._ambilExtraList.splice(this._ambilExtraIdx, 1);
        this._ambilExtraList.push(salahItem);
        // Tidak increment idx, tapi karena item dihapus dari posisi ini,
        // idx sekarang sudah menunjuk ke kata berikutnya otomatis
        this._tampilSoalAmbilExtra();
      }
      return;
    }

    if (benar || isSkip) {
      this.wordIdx++;
      this._tampilSoalAllIn();
      return;
    }

    // Salah
    const errCount = this._errorCount[wi][si];

    if (this.difficulty === 'ambil') {
      if (errCount >= 1 && !this._ambilQueue[si].find(x=>x.hanzi===item.hanzi)) {
        this._ambilQueue[si].push(item);
      }
      // Lanjut soal berikutnya (tidak retry)
      this.wordIdx++;
      this._tampilSoalAllIn();
      return;
    }

    // easy/hard: retry soal ini dulu
    if (this.difficulty === 'easy') {
      const hEl = el("hasil-ai");
      if (hEl) hEl.innerHTML += `<br><small>🔄 Coba lagi soal ini, lalu mundur 2 soal...</small>`;
      this._infinityRetry = true;
      setTimeout(() => this._retryKata(), 2000);
    } else {
      // hard
      const hEl = el("hasil-ai");
      if (hEl) hEl.innerHTML += `<br><small>💀 Coba lagi, lalu kembali ke kata pertama step ini!</small>`;
      this._infinityRetry = true;
      setTimeout(() => this._retryKata(), 2000);
    }
  },

  _retryKata() {
    // tampil soal yang sama lagi
    this._sedang = false;
    this._tampilSoalAllIn();
    // Setelah jawab benar saat retry, _lanjutKataSetelahRetry dipanggil lewat _prosesJawabRetry
  },

  // Override proses jawab saat sedang infinityRetry
  _prosesJawabRetry(benar, item) {
    this._sedang = true;
    const si = this.stepIdx;
    const wi = this._origIdx(item);
    const waktuMulai = this._stat[wi][si].waktuMulai || Date.now();
    this._stat[wi][si].waktuTotal += (Date.now() - waktuMulai);
    if (!benar) { this._errorCount[wi][si]++; this._stat[wi][si].salah++; }

    if (!benar) {
      // Masih salah, retry lagi
      setTimeout(() => { this._sedang = false; this._tampilSoalAllIn(); }, 2200);
      return;
    }
    // Benar setelah retry
    this._infinityRetry = false;
    setTimeout(() => {
      const stepList = this._buildStepList();
      if (this.difficulty === 'easy') {
        this.wordIdx = Math.max(0, this.wordIdx - 2);
      } else {
        // hard: kembali ke kata 0
        this.wordIdx = 0;
      }
      this._sedang = false;
      this._tampilSoalAllIn();
    }, 1600);
  },

  // ── SELESAI STEP ─────────────────────────────────────────────
  _selesaiStep() {
    const step = this.STEPS[this.stepIdx];
    const stepIdx = this.stepIdx;
    const n = this.soalList.length;
    const salahStep = this.soalList.reduce((acc, _, wi) => acc + this._stat[wi][stepIdx].salah, 0);
    const benarStep = n - Math.min(salahStep, n);

    const progBar = this.STEPS.map((s, i) => `
      <div style="flex:1;height:8px;border-radius:99px;margin:0 1px;
        background:${i <= stepIdx ? 'var(--c-hijau)' : 'var(--c-border)'}"></div>
    `).join("");

    if (this.stepIdx < this.STEPS.length - 1) {
      el("konten-utama").innerHTML = `
        <div class="soal-wrap" style="text-align:center">
          <div style="display:flex;gap:3px;margin-bottom:16px">${progBar}</div>
          <div class="selesai-emoji">✅</div>
          <div class="label-mode">Tahap ${stepIdx+1} Selesai!</div>
          <div class="soal-hint" style="margin:12px 0">
            <b>${step.icon} ${step.label}</b><br>
            Benar: ${benarStep} / ${n}
          </div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="AllIn._nextStep()">▶ Tahap Berikutnya</button>
          </div>
        </div>`;
    } else {
      this._tampilHasilAkhir();
    }
  },

  _nextStep() {
    this.stepIdx++;
    this.wordIdx = 0;
    this._infinityRetry = false;
    this._tampilStepIntro();
  },

  // ── HASIL AKHIR ──────────────────────────────────────────────
  _tampilHasilAkhir() {
    const stat = this._stat;
    const steps = this.STEPS;
    const soal = this.soalList;
    const n = soal.length;

    // Hitung total salah per kata (across all steps)
    const totalSalahPerKata = soal.map((item, wi) =>
      steps.reduce((acc, _, si) => acc + stat[wi][si].salah, 0)
    );

    // Kata yang salah di semua step (totalSalah > 0)
    const kataSalah = soal
      .map((item, wi) => ({ item, wi, total: totalSalahPerKata[wi] }))
      .filter(x => x.total > 0)
      .sort((a,b) => b.total - a.total);

    // Kata yang sempurna (0 salah di semua step)
    const kataSempurna = soal
      .map((item, wi) => ({ item, wi, total: totalSalahPerKata[wi] }))
      .filter(x => x.total === 0);

    // Kata paling cepat (waktu rata-rata rendah, salah = 0)
    const kataCepat = soal
      .map((item, wi) => {
        const totalSalah = totalSalahPerKata[wi];
        const totalWaktu = steps.reduce((acc, _, si) => acc + (stat[wi][si].waktuTotal||0), 0);
        const rataWaktu = totalWaktu / steps.length;
        return { item, wi, totalSalah, rataWaktu };
      })
      .filter(x => x.totalSalah === 0 && x.rataWaktu > 0)
      .sort((a,b) => a.rataWaktu - b.rataWaktu)
      .slice(0, 5);

    // Detail salah per step
    const detailStep = steps.map((step, si) => {
      const salahDiStep = soal
        .map((item, wi) => ({ item, wi, salah: stat[wi][si].salah }))
        .filter(x => x.salah > 0)
        .sort((a,b) => b.salah - a.salah);
      return { step, si, salahDiStep };
    }).filter(x => x.salahDiStep.length > 0);

    const totalBenar = stat.flat().reduce((a,s)=>a+(s.salah===0?1:0),0);
    const totalSoalAll = n * steps.length;
    const pct = Math.round((totalBenar / totalSoalAll) * 100);
    const emoji = pct >= 85 ? "🏆" : pct >= 65 ? "👍" : "💪";

    // ── SEKSI PENYEMANGAT: kata yang betul semua ──
    let htmlSempurna = "";
    if (kataSempurna.length > 0) {
      const semua = kataSempurna.length === n;
      htmlSempurna = `
        <div class="review-section" style="margin:10px 0;border:2px solid var(--c-hijau)">
          <h3>🌟 ${semua ? "Luar Biasa! Semua Kata Dikuasai! 🎉" : `Kata yang Sudah Dikuasai (${kataSempurna.length}/${n})`}</h3>
          ${semua
            ? `<div style="font-size:14px;margin-bottom:6px">Kamu berhasil menjawab semua ${n} kata dengan benar di setiap tahap! Kerja keras kamu terbayar! 💪</div>`
            : `<div style="font-size:13px;margin-bottom:8px">Kata-kata ini tidak ada salah satu pun di semua tahap — pertahankan! ✨</div>
               <div style="display:flex;flex-wrap:wrap;gap:6px">
                 ${kataSempurna.map(({item})=>`<span style="background:var(--c-hijau);color:#fff;border-radius:20px;padding:3px 10px;font-size:13px;font-weight:700">${item.hanzi}</span>`).join("")}
               </div>`
          }
        </div>`;
    }

    // ── SEKSI KESIMPULAN: dari parah ke tidak parah ──
    let htmlKesimpulan = "";
    if (kataSalah.length > 0) {
      const tingkatPadam = (total) => {
        if (total >= 4) return { label: "🔴 Perlu banyak latihan", color: "#c62828" };
        if (total >= 2) return { label: "🟠 Cukup sulit", color: "#e65100" };
        return { label: "🟡 Sedikit perlu diulang", color: "#f57f17" };
      };
      htmlKesimpulan = `
        <div class="review-section" style="margin:10px 0">
          <h3>📋 Kesimpulan — Kata yang Perlu Diperbaiki</h3>
          <div style="font-size:12px;margin-bottom:10px;opacity:.8">Diurutkan dari yang paling perlu perhatian:</div>
          ${kataSalah.map(({item, wi, total}) => {
            const tk = tingkatPadam(total);
            const stepSalah = steps.map((s,si)=>stat[wi][si].salah>0?`${s.icon} ${s.label}: ${stat[wi][si].salah}×`:"").filter(Boolean).join(" · ");
            return `<div class="review-item" style="padding:8px 0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:18px;font-weight:900">${item.hanzi}</span>
                <span style="font-size:12px;color:var(--c-sub)">${item.pinyin}</span>
                <span style="font-size:13px">= ${item.arti}</span>
                <span style="font-size:11px;font-weight:700;color:${tk.color};margin-left:auto">${tk.label}</span>
              </div>
              <div style="font-size:11px;color:var(--c-sub);margin-top:3px">${stepSalah}</div>
            </div>`;
          }).join("")}
        </div>`;
    }

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>All In — Selesai! 🔥</h2>
        <div class="selesai-skor">
          <div>📚 Kata dipelajari: <b>${n}</b></div>
          <div>🎯 Skor keseluruhan: <b class="skor-pct">${pct}%</b></div>
        </div>
        ${htmlSempurna}
        ${htmlKesimpulan}
        <div class="btn-row" style="justify-content:center;margin-top:16px">
          <button class="btn btn-hijau" onclick="AllIn.init()">🔄 Ulangi All In</button>
          <button class="btn btn-biru" onclick="Vocab.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },
};
