// ================================================================
//  APP.JS — Router Utama + Progress + Settings
// ================================================================

var MODUL_CFG = {
  pintar:    { label:"🧠 Sesi Pintar",  obj:"Pintar",   icon:"🧠" },
  vocab:     { label:"📚 Vocabulary",  obj:"Vocab",    icon:"📚" },
  sentence:  { label:"📝 Sentence",    obj:"Sentence", icon:"📝" },
  grammar:   { label:"📖 Grammar",     obj:"Grammar",  icon:"📖" },
  dialogue:  { label:"💬 Dialogue",    obj:"Dialogue", icon:"💬" },
  listening: { label:"🎧 Listening",   obj:"Listening",icon:"🎧" },
  reading:   { label:"📰 Reading",     obj:"Reading",  icon:"📰" },
  writing:   { label:"✍️ Writing",     obj:"Writing",  icon:"✍️" },
  speaking:  { label:"🎤 Speaking",    obj:"Speaking", icon:"🎤" },
  psikotes:  { label:"🧩 Psikotes",    obj:"Psikotes", icon:"🧩" },
  exam:      { label:"🧪 Exam Mode",   obj:"Exam",     icon:"🧪" },
  quiz:      { label:"🎯 Kuis Bebas",  obj:"Quiz",     icon:"🎯" },
};

var PROG_KEY = "mdr_progress";
var SET_KEY  = "mdr_settings";

function ambilProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); } catch(e) { return {}; }
}
function simpanProgress(data) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(data)); } catch(e) {}
}

// ── Acak ─────────────────────────────────────────────────────
function acak(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Toast ─────────────────────────────────────────────────────
function tampilToast(pesan, durasi = 2400) {
  const t = el("toast");
  if (!t) return;
  t.textContent = pesan;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), durasi);
}

function tampilXP(jml) {
  const d = document.createElement("div");
  d.className = "xp-popup";
  d.textContent = `+${jml} XP`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 900);
}

// ================================================================
//  APP ROUTER
// ================================================================
var App = {

  modulSaat: null,
  totalXP:   0,
  level:     1,
  streak:    0,

  // ── DEFAULT SETTINGS ────────────────────────────────────────
  _settings: {
    ttsRate:      0.85,   // kecepatan TTS 0.5 – 1.5
    jawabanDelay: 1600,   // ms sebelum lanjut soal (1000–3000)
    theme:        "light", // "light" | "dark"
  },

  // ── INIT ────────────────────────────────────────────────────
  init() {
    this._muatProgress();
    this._muatSettings();
    this._applyTheme();
    this._renderStatHome();
    this._cekStreak();
    this._renderBadge();

    // Patch tambahSkor → tambah XP
    const _ori = tambahSkor;
    window.tambahSkor = (benar) => {
      _ori(benar);
      if (benar) this.tambahXP(10);
    };

    this._screen("home");
  },

  // ── BUKA MODUL ──────────────────────────────────────────────
  buka(modul) {
    const cfg = MODUL_CFG[modul];
    if (!cfg) return;
    this.modulSaat = modul;
    setHTML("topbar-title", cfg.label);
    setHTML("topbar-xp", this.totalXP + " XP");
    this._screen("modul");
    this.renderModul(modul);
  },

  renderModul(modul) {
    const cfg = MODUL_CFG[modul];
    if (!cfg) return;
    const obj = window[cfg.obj];
    if (!obj || !obj.renderMenu) {
      setHTML("konten-utama", `<p style="padding:20px;color:#888">Modul <b>${cfg.label}</b> belum tersedia.</p>`);
      return;
    }
    setHTML("konten-utama", obj.renderMenu());
    if (obj._pasangEventMenu) setTimeout(() => obj._pasangEventMenu(), 60);
  },

  // ── KEMBALI HOME ────────────────────────────────────────────
  kembaliHome() {
    TTS.berhenti(); STT.berhenti(); hentikanTimer();
    this.modulSaat = null;
    this._simpanProgress();
    this._renderStatHome();
    this._renderBadge();
    this._screen("home");
  },

  // ── XP ──────────────────────────────────────────────────────
  tambahXP(jml) {
    this.totalXP += jml;
    tampilXP(jml);
    this.level = Math.floor(this.totalXP / 100) + 1;
    setHTML("topbar-xp", this.totalXP + " XP");
    this._simpanProgress();
    this._updateGlobalBar();
  },

  // ── STREAK ──────────────────────────────────────────────────
  _cekStreak() {
    const prog    = ambilProgress();
    const hariIni = new Date().toDateString();
    const kemarin = new Date(Date.now() - 86400000).toDateString();
    if (prog.terakhirMain === hariIni)      this.streak = prog.streak || 0;
    else if (prog.terakhirMain === kemarin) { this.streak = (prog.streak||0)+1; prog.streak=this.streak; prog.terakhirMain=hariIni; simpanProgress(prog); }
    else { this.streak=1; prog.streak=1; prog.terakhirMain=hariIni; simpanProgress(prog); }
  },

  _muatProgress() {
    const prog   = ambilProgress();
    this.totalXP = prog.xp || 0;
    this.level   = Math.floor(this.totalXP / 100) + 1;
    this.streak  = prog.streak || 0;
  },

  _simpanProgress() {
    const prog = ambilProgress();
    prog.xp = this.totalXP; prog.level = this.level;
    prog.streak = this.streak; prog.terakhirMain = new Date().toDateString();
    simpanProgress(prog);
  },

  _renderStatHome() {
    const prog = ambilProgress();
    setHTML("stat-total",  prog.totalLatihan  || 0);
    setHTML("stat-streak", (this.streak || prog.streak || 0) + "🔥");
    setHTML("stat-vocab",  prog.vocabDikuasai || 0);
    this._updateGlobalBar();
  },

  _updateGlobalBar() {
    const xpDiLevel = this.totalXP % 100;
    setHTML("global-progress-label", `Level ${this.level} · ${this.totalXP} XP`);
    const bar = el("global-fill");
    if (bar) bar.style.width = xpDiLevel + "%";
  },

  _renderBadge() {
    const prog = ambilProgress();
    const sesi = prog.sesiPerModul || {};
    Object.keys(MODUL_CFG).forEach(m => {
      const b = el("badge-" + m);
      if (b) { const j = sesi[m]||0; b.textContent = j ? j+"×" : ""; b.style.display = j ? "block" : "none"; }
    });
  },

  catatSesiSelesai(modul, benar, total) {
    const prog = ambilProgress();
    prog.totalLatihan = (prog.totalLatihan||0) + 1;
    prog.sesiPerModul = prog.sesiPerModul || {};
    prog.sesiPerModul[modul] = (prog.sesiPerModul[modul]||0) + 1;
    if (modul === "vocab" && benar >= Math.floor(total * 0.8)) {
      prog.vocabDikuasai = (prog.vocabDikuasai||0) + benar;
    }
    simpanProgress(prog);
    this._renderBadge();
  },

  _screen(nama) {
    ["home","modul","settings"].forEach(s => {
      const e = el("screen-" + s);
      if (e) e.style.display = (s === nama) ? "" : "none";
    });
  },

  // ================================================================
  //  SETTINGS
  // ================================================================
  _muatSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SET_KEY) || "{}");
      Object.assign(this._settings, saved);
    } catch(e) {}
  },

  _simpanSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(this._settings)); } catch(e) {}
  },

  bukaSettings() {
    const s = this._settings;
    const prog = ambilProgress();
    setHTML("screen-settings", `
      <div class="topbar">
        <button class="topbar-back" onclick="App.tutupSettings()">← Kembali</button>
        <div class="topbar-title">⚙️ Pengaturan</div>
        <div class="topbar-xp"></div>
      </div>
      <div style="padding:16px;max-width:500px;margin:0 auto">

        <!-- AUDIO -->
        <div class="card" style="margin-bottom:14px">
          <h3 style="margin:0 0 12px">🔊 Audio</h3>

          <div class="set-row">
            <label>Kecepatan TTS</label>
            <div class="set-ctrl">
              <input type="range" id="set-tts-rate" min="0.5" max="1.5" step="0.05"
                value="${s.ttsRate}" oninput="App._previewTTS(this.value)"
                style="width:140px">
              <span id="set-tts-val">${s.ttsRate.toFixed(2)}×</span>
            </div>
          </div>
          <div style="font-size:12px;color:#999;margin:4px 0 8px">
            Drag geser, lalu klik tombol ▶ untuk preview
          </div>
          <button class="btn btn-abu" style="font-size:13px" onclick="App._previewTTS()">▶ Preview suara</button>
        </div>

        <!-- TAMPILAN -->
        <div class="card" style="margin-bottom:14px">
          <h3 style="margin:0 0 12px">⏱️ Waktu Tampil Jawaban</h3>
          <div class="set-row">
            <label>Delay sebelum lanjut</label>
            <div class="set-ctrl">
              <input type="range" id="set-delay" min="800" max="4000" step="100"
                value="${s.jawabanDelay}" oninput="App._updateDelayLabel(this.value)"
                style="width:140px">
              <span id="set-delay-val">${(s.jawabanDelay/1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

        <!-- TEMA -->
        <div class="card" style="margin-bottom:14px">
          <h3 style="margin:0 0 12px">🌙 Tampilan</h3>
          <div style="font-size:13px;color:var(--c-sub);margin-bottom:10px">
            Pilih tema tampilan sesuai kondisi belajar kamu.
          </div>
          <div class="theme-toggle-wrap">
            <button class="theme-btn ${s.theme !== 'dark' ? 'aktif' : ''}" id="theme-btn-light"
              onclick="App._pilihTheme('light')">☀️ Siang (Terang)</button>
            <button class="theme-btn ${s.theme === 'dark' ? 'aktif' : ''}" id="theme-btn-dark"
              onclick="App._pilihTheme('dark')">🌙 Malam (Gelap)</button>
          </div>
        </div>

        <!-- RESET -->
        <div class="card" style="margin-bottom:14px">
          <h3 style="margin:0 0 12px">🗑️ Reset Data</h3>
          <div style="font-size:13px;color:#666;margin-bottom:12px">
            XP saat ini: <b>${this.totalXP}</b> XP &nbsp;|&nbsp;
            Kata dikuasai: <b>${prog.vocabDikuasai || 0}</b> &nbsp;|&nbsp;
            Total latihan: <b>${prog.totalLatihan || 0}</b>
          </div>
          <div class="btn-row">
            <button class="btn btn-kuning" onclick="App._resetVocab()">🔄 Reset Kata Dikuasai</button>
            <button class="btn btn-merah" onclick="App._resetXP()">⚠️ Reset XP</button>
            <button class="btn btn-merah" onclick="App._resetSemua()">🗑️ Reset Semua</button>
          </div>
        </div>

        <!-- SIMPAN -->
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="App._simpanDanTutup()">💾 Simpan & Tutup</button>
        </div>
        <p id="set-msg" style="text-align:center;font-size:13px;margin-top:8px;color:green"></p>

      </div>
    `);
    this._screen("settings");
  },

  tutupSettings() { this._screen("home"); },

  _applyTheme() {
    const theme = this._settings.theme || "light";
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "");
  },

  _pilihTheme(tema) {
    this._settings.theme = tema;
    this._simpanSettings();
    this._applyTheme();
    // Update tombol aktif
    const btnLight = el("theme-btn-light");
    const btnDark  = el("theme-btn-dark");
    if (btnLight) btnLight.classList.toggle("aktif", tema !== "dark");
    if (btnDark)  btnDark.classList.toggle("aktif", tema === "dark");
  },

  _previewTTS(val) {
    const rate = parseFloat(val || document.getElementById("set-tts-rate")?.value || this._settings.ttsRate);
    const disp = el("set-tts-val");
    if (disp) disp.textContent = rate.toFixed(2) + "×";
    TTS.bicara("你好，这是测试。", "zh-CN", rate);
  },

  _updateDelayLabel(val) {
    const v = parseInt(val);
    const disp = el("set-delay-val");
    if (disp) disp.textContent = (v/1000).toFixed(1) + "s";
  },

  _simpanDanTutup() {
    const rateEl  = el("set-tts-rate");
    const delayEl = el("set-delay");
    if (rateEl)  this._settings.ttsRate      = parseFloat(rateEl.value);
    if (delayEl) this._settings.jawabanDelay = parseInt(delayEl.value);
    this._simpanSettings();
    const msg = el("set-msg");
    if (msg) msg.textContent = "✅ Pengaturan disimpan!";
    setTimeout(() => this.tutupSettings(), 900);
  },

  _resetVocab() {
    if (!confirm("Reset jumlah kata dikuasai?")) return;
    const prog = ambilProgress();
    prog.vocabDikuasai = 0;
    simpanProgress(prog);
    tampilToast("✅ Kata dikuasai direset!");
    this.bukaSettings();
  },

  _resetXP() {
    if (!confirm("Reset semua XP?")) return;
    this.totalXP = 0; this.level = 1;
    this._simpanProgress();
    tampilToast("✅ XP direset!");
    this.bukaSettings();
  },

  _resetSemua() {
    if (!confirm("Reset SEMUA data (XP, streak, kata dikuasai, riwayat latihan)?")) return;
    localStorage.removeItem(PROG_KEY);
    this.totalXP = 0; this.level = 1; this.streak = 0;
    this._muatProgress();
    tampilToast("✅ Semua data direset!");
    setTimeout(() => this.bukaSettings(), 500);
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
