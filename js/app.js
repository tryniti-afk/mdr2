// ================================================================
//  APP.JS — Router Utama + Progress Tracker
//  Menghubungkan semua modul ke index.html
// ================================================================

// ── KONFIGURASI MODUL ────────────────────────────────────────
const MODUL_CFG = {
  vocab:     { label: "📚 Vocabulary",  obj: "Vocab",    icon: "📚" },
  sentence:  { label: "📝 Sentence",    obj: "Sentence", icon: "📝" },
  grammar:   { label: "📖 Grammar",     obj: "Grammar",  icon: "📖" },
  dialogue:  { label: "💬 Dialogue",    obj: "Dialogue", icon: "💬" },
  listening: { label: "🎧 Listening",   obj: "Listening",icon: "🎧" },
  reading:   { label: "📰 Reading",     obj: "Reading",  icon: "📰" },
  writing:   { label: "✍️ Writing",     obj: "Writing",  icon: "✍️" },
  speaking:  { label: "🎤 Speaking",    obj: "Speaking", icon: "🎤" },
  exam:      { label: "🧪 Exam Mode",   obj: "Exam",     icon: "🧪" },
  quiz:      { label: "🎤 Kuis Suara",  obj: "Quiz",     icon: "🎤" },
};

// ── PROGRESS KEY ─────────────────────────────────────────────
const PROG_KEY   = "mdr_progress";
const SESI_KEY   = "mdr_sesi_harian";

// ── HELPER: ambil / simpan progress ──────────────────────────
function ambilProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); }
  catch(e) { return {}; }
}
function simpanProgress(data) {
  localStorage.setItem(PROG_KEY, JSON.stringify(data));
}

// ── SKOR SESI ─────────────────────────────────────────────────
// sesiSkor, resetSkor, tambahSkor, el, setHTML sudah didefinisikan di engine.js
// Kita patch tambahSkor agar juga menambah XP ke App
const _tambahSkorOri = tambahSkor;
// Override setelah App siap (lihat App.init)


// ── ACAK ARRAY ────────────────────────────────────────────────
function acak(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── TOAST ─────────────────────────────────────────────────────
function tampilToast(pesan, durasi = 2200) {
  const t = el("toast");
  if (!t) return;
  t.textContent = pesan;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), durasi);
}

// ── XP POPUP ──────────────────────────────────────────────────
function tampilXP(jml) {
  const d = document.createElement("div");
  d.className = "xp-popup";
  d.textContent = `+${jml} XP`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 850);
}

// ── TIMER GLOBAL — didefinisikan di engine.js ────────────────
// mulaiTimer, hentikanTimer sudah ada di engine.js


// ── APP ROUTER ────────────────────────────────────────────────
const App = {

  modulSaat: null,
  totalXP: 0,
  level: 1,
  streak: 0,

  // ── INIT ────────────────────────────────────────────────────
  init() {
    this._muatProgress();
    this._renderStatHome();
    this._cekStreak();
    this._renderBadge();
    // Patch tambahSkor agar XP masuk ke App
    const _ori = tambahSkor;
    window.tambahSkor = (benar) => {
      _ori(benar);
      if (benar) this.tambahXP(10);
    };
    // tampilkan home
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

  // ── RENDER SUB-MENU MODUL ───────────────────────────────────
  renderModul(modul) {
    const cfg = MODUL_CFG[modul];
    if (!cfg) return;
    // Ambil objek modul (Vocab, Sentence, dll)
    const obj = window[cfg.obj];
    if (!obj || !obj.renderMenu) {
      setHTML("konten-utama", `<p style="padding:20px;color:#888;">Modul <b>${cfg.label}</b> belum tersedia.</p>`);
      return;
    }
    setHTML("konten-utama", obj.renderMenu());
    // Pasang event menu jika ada (misal Quiz._pasangEventMenu)
    if (obj._pasangEventMenu) setTimeout(() => obj._pasangEventMenu(), 50);
  },

  // ── KEMBALI KE HOME ─────────────────────────────────────────
  kembaliHome() {
    TTS.berhenti();
    STT.berhenti();
    hentikanTimer();
    this.modulSaat = null;
    this._simpanProgress();
    this._renderStatHome();
    this._renderBadge();
    this._screen("home");
  },

  // ── TAMBAH XP ────────────────────────────────────────────────
  tambahXP(jml) {
    this.totalXP += jml;
    tampilXP(jml);
    // Hitung level: setiap 100 XP naik level
    this.level = Math.floor(this.totalXP / 100) + 1;
    setHTML("topbar-xp", this.totalXP + " XP");
    this._simpanProgress();
    this._updateGlobalBar();
  },

  // ── CEK STREAK HARIAN ────────────────────────────────────────
  _cekStreak() {
    const prog = ambilProgress();
    const hariIni = new Date().toDateString();
    const hariKemarin = new Date(Date.now() - 86400000).toDateString();
    if (prog.terakhirMain === hariIni) {
      this.streak = prog.streak || 0;
    } else if (prog.terakhirMain === hariKemarin) {
      this.streak = (prog.streak || 0) + 1;
      prog.streak = this.streak;
      prog.terakhirMain = hariIni;
      simpanProgress(prog);
    } else {
      this.streak = 1;
      prog.streak = 1;
      prog.terakhirMain = hariIni;
      simpanProgress(prog);
    }
  },

  // ── MUAT PROGRESS DARI LOCALSTORAGE ─────────────────────────
  _muatProgress() {
    const prog = ambilProgress();
    this.totalXP = prog.xp || 0;
    this.level   = Math.floor(this.totalXP / 100) + 1;
    this.streak  = prog.streak || 0;
  },

  // ── SIMPAN PROGRESS ─────────────────────────────────────────
  _simpanProgress() {
    const prog = ambilProgress();
    prog.xp = this.totalXP;
    prog.level = this.level;
    prog.streak = this.streak;
    prog.terakhirMain = new Date().toDateString();
    simpanProgress(prog);
  },

  // ── RENDER STATISTIK HOME ────────────────────────────────────
  _renderStatHome() {
    const prog = ambilProgress();
    setHTML("stat-total", prog.totalLatihan || 0);
    setHTML("stat-streak", (this.streak || prog.streak || 0) + "🔥");
    setHTML("stat-vocab",  prog.vocabDikuasai || 0);

    // Update global bar
    const xp = this.totalXP;
    const lvl = this.level;
    const xpDiLevel = xp % 100;
    setHTML("global-progress-label", `Level ${lvl} · ${xp} XP`);
    this._updateGlobalBar();
  },

  _updateGlobalBar() {
    const xpDiLevel = this.totalXP % 100;
    const bar = el("global-fill");
    if (bar) bar.style.width = xpDiLevel + "%";
  },

  // ── RENDER BADGE MENU ────────────────────────────────────────
  _renderBadge() {
    const prog = ambilProgress();
    const sesi = prog.sesiPerModul || {};
    Object.keys(MODUL_CFG).forEach(m => {
      const b = el("badge-" + m);
      if (b) {
        const jml = sesi[m] || 0;
        b.textContent = jml ? jml + "×" : "";
        b.style.display = jml ? "block" : "none";
      }
    });
  },

  // ── CATAT SESI SELESAI ───────────────────────────────────────
  catatSesiSelesai(modul, benar, total) {
    const prog = ambilProgress();
    prog.totalLatihan = (prog.totalLatihan || 0) + 1;
    prog.sesiPerModul = prog.sesiPerModul || {};
    prog.sesiPerModul[modul] = (prog.sesiPerModul[modul] || 0) + 1;
    if (modul === "vocab" && benar >= Math.floor(total * 0.8)) {
      prog.vocabDikuasai = (prog.vocabDikuasai || 0) + benar;
    }
    simpanProgress(prog);
    this._renderBadge();
  },

  // ── SWITCH SCREEN ────────────────────────────────────────────
  _screen(nama) {
    ["home","modul"].forEach(s => {
      const e = el("screen-" + s);
      if (e) e.style.display = (s === nama) ? "" : "none";
    });
  },
};

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => App.init());
