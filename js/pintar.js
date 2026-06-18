// ================================================================
//  PINTAR.JS — Sesi Pintar: Review otomatis (mini-SRS) + Kata Baru
//  Modul BARU & berdiri sendiri. TIDAK menyentuh/mengubah vocab.js,
//  setsoal.js, atau datamanager.js — hanya membaca data dari sana.
//
//  Prinsip:
//   1. Tiap kata punya status "box" Leitner (0-5) + tanggal jatuh tempo.
//      Box naik kalau benar, turun kalau salah. Makin tinggi box,
//      makin jarang direview (interval makin panjang).
//   2. Sesi harian = semua kata yang "jatuh tempo" direview HARI INI
//      + kuota kata baru (tetap, default 175/hari, gak dikurangi
//      walau review numpuk — sesuai keputusan: target gak diubah).
//   3. Kalau salah jawab, soal itu TIDAK mereset ke soal pertama.
//      Soal hanya disisipkan ulang beberapa posisi ke depan, lalu
//      lanjut soal lain dulu.
//   4. Kata baru pertama kali selalu lewat mode pengenalan (pilihan
//      ganda) dulu — bukan langsung disuruh ngetik hanzi dari nol.
//   5. Tiap N soal (ukuranRonde), ada layar "istirahat" yang
//      menyarankan jeda — biar gak numpuk jadi satu sesi raksasa.
// ================================================================

var PINTAR_KEY_WORDS    = "mdr_pintar_words";
var PINTAR_KEY_SETTINGS = "mdr_pintar_settings";

// interval (hari) per box, index = box 0..5
var PINTAR_BOX_INTERVAL = [0, 1, 3, 7, 15, 30];

var PINTAR_DEFAULT_SETTINGS = {
  kuotaBaru:        175,
  ukuranRonde:      35,
  sheetBaru:        "Hsk4",
  sheetUrutanBaru:  ["Hsk4", "Hsk5"],
  onboardingSelesai: false,
};

var Pintar = {

  _words:    null,
  _settings: null,
  _poolSemua: null,
  _antrian:  [],
  _soalSekarang: null,
  _modeSekarang: null,
  _sedangTransisi: false,
  _totalAwal: 0,
  _selesaiSesi: 0,
  _sesiBaruCount: 0,
  _sesiReviewCount: 0,

  // ================================================================
  //  STORAGE
  // ================================================================
  _muatWords() {
    if (this._words) return this._words;
    try { this._words = JSON.parse(localStorage.getItem(PINTAR_KEY_WORDS) || "{}"); }
    catch (e) { this._words = {}; }
    return this._words;
  },
  _simpanWords() {
    try { localStorage.setItem(PINTAR_KEY_WORDS, JSON.stringify(this._words || {})); } catch (e) {}
  },
  _muatSettings() {
    if (this._settings) return this._settings;
    try {
      const saved = JSON.parse(localStorage.getItem(PINTAR_KEY_SETTINGS) || "{}");
      this._settings = Object.assign({}, PINTAR_DEFAULT_SETTINGS, saved);
    } catch (e) { this._settings = Object.assign({}, PINTAR_DEFAULT_SETTINGS); }
    return this._settings;
  },
  _simpanSettings() {
    try { localStorage.setItem(PINTAR_KEY_SETTINGS, JSON.stringify(this._settings)); } catch (e) {}
  },

  _hariIni() { return new Date().toISOString().slice(0, 10); },
  _tambahHari(tgl, n) {
    const d = new Date(tgl + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },

  // ================================================================
  //  AMBIL DATA SHEET (read-only — pakai DataMgr & SetSoal yang sudah ada)
  // ================================================================
  async _ambilSemuaPool() {
    if (this._poolSemua) return this._poolSemua;
    const hasil = {};
    for (const s of SHEET_VOCAB) {
      const raw  = await DataMgr.ambilSoal(s.id, "vocab");
      const konv = SetSoal._konversiVocab(raw || []);
      hasil[s.id] = konv
        .filter(v => v.hanzi)
        .map(v => ({ ...v, sheet: s.id, id: s.id + "::" + v.hanzi }));
    }
    this._poolSemua = hasil;
    return hasil;
  },

  _semuaKataFlat(pool) { return Object.values(pool).flat(); },

  // ================================================================
  //  RENDER MENU (dipanggil App.renderModul)
  // ================================================================
  renderMenu() {
    return `<div class="soal-wrap" style="text-align:center;padding:30px 20px">⏳ Memuat data Sesi Pintar...</div>`;
  },

  async _pasangEventMenu() {
    const settings = this._muatSettings();
    if (!settings.onboardingSelesai) { this._renderOnboarding(); return; }
    await this._ambilSemuaPool();
    this._renderMenuUtama();
  },

  kembaliMenu() { TTS.berhenti(); App.renderModul("pintar"); },

  // ================================================================
  //  ONBOARDING / SEED AWAL
  // ================================================================
  _renderOnboarding() {
    const settings = this._muatSettings();
    setHTML("konten-utama", `
      <div class="soal-wrap">
        <div class="label-mode">🧠 Sesi Pintar — Setup Awal</div>
        <div class="soal-hint" style="margin-bottom:16px;text-align:left">
          Modul ini otomatis nge-mix <b>review kata yang mulai lupa</b> + <b>kata baru</b> dalam satu sesi,
          pakai sistem spasi ulang (mirip Anki/Leitner) — biar gak manual gonta-ganti sheet sendiri.
          Kalau salah jawab, <b>gak perlu restart dari soal pertama</b>, cukup diulang sebentar lagi.
        </div>

        <div class="ss-section">
          <div class="ss-label">📚 Kata yang SUDAH pernah dipelajari (otomatis masuk siklus review)</div>
          <div class="sub-menu-grid" id="pintar-seed-opsi">
            <div class="sub-card sub-card-aktif" data-sheet="hsk1-2" onclick="Pintar._toggleSeedOpsi(this)">
              <div class="sub-label">HSK 1-2</div>
              <div class="sub-desc">Sudah lancar → direview jarang-jarang</div>
            </div>
            <div class="sub-card sub-card-aktif" data-sheet="Hsk3" onclick="Pintar._toggleSeedOpsi(this)">
              <div class="sub-label">HSK 3</div>
              <div class="sub-desc">Kenal tapi sering lupa → direview lebih sering</div>
            </div>
          </div>
        </div>

        <div class="ss-section">
          <div class="ss-label">🚀 Sumber kata baru sekarang</div>
          <div class="sub-menu-grid" id="pintar-sheetbaru-opsi">
            <div class="sub-card ${settings.sheetBaru === 'Hsk4' ? 'sub-card-aktif' : ''}" data-sheet="Hsk4" onclick="Pintar._pilihSheetBaru(this)">
              <div class="sub-label">HSK 4</div>
              <div class="sub-desc">600 kata, fokus sekarang</div>
            </div>
            <div class="sub-card ${settings.sheetBaru === 'Hsk5' ? 'sub-card-aktif' : ''}" data-sheet="Hsk5" onclick="Pintar._pilihSheetBaru(this)">
              <div class="sub-label">HSK 5</div>
              <div class="sub-desc">Lanjutan otomatis setelah HSK4 habis</div>
            </div>
          </div>
        </div>

        <div class="ss-section">
          <div class="ss-label">🎯 Kuota kata baru per hari</div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="pintar-kuota" min="50" max="300" step="25" value="${settings.kuotaBaru}"
              oninput="document.getElementById('pintar-kuota-val').innerText=this.value" style="flex:1">
            <span id="pintar-kuota-val" style="font-weight:700">${settings.kuotaBaru}</span>
          </div>
          <div class="soal-hint" style="text-align:left;margin-top:4px">Review yang jatuh tempo TETAP ditambahkan di atas kuota ini (sesuai targetmu — gak dikurangi).</div>
        </div>

        <div class="ss-section">
          <div class="ss-label">☕ Ukuran ronde sebelum saran istirahat</div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="pintar-ronde" min="15" max="60" step="5" value="${settings.ukuranRonde}"
              oninput="document.getElementById('pintar-ronde-val').innerText=this.value" style="flex:1">
            <span id="pintar-ronde-val" style="font-weight:700">${settings.ukuranRonde}</span>
          </div>
        </div>

        <div class="btn-row" style="margin-top:18px;justify-content:center">
          <button class="btn btn-hijau" onclick="Pintar._simpanOnboarding()">🚀 Mulai!</button>
          <button class="btn btn-abu" onclick="App.kembaliHome()">← Batal</button>
        </div>
        <p id="pintar-onb-msg" style="text-align:center;font-size:13px;margin-top:10px;color:green"></p>
      </div>
    `);
  },

  _toggleSeedOpsi(elm) { elm.classList.toggle("sub-card-aktif"); },
  _pilihSheetBaru(elm) {
    document.querySelectorAll("#pintar-sheetbaru-opsi .sub-card").forEach(c => c.classList.remove("sub-card-aktif"));
    elm.classList.add("sub-card-aktif");
  },

  _simpanOnboarding() {
    const settings = this._muatSettings();
    const seedSheets = Array.from(document.querySelectorAll("#pintar-seed-opsi .sub-card.sub-card-aktif")).map(c => c.dataset.sheet);
    const sheetBaruElm = document.querySelector("#pintar-sheetbaru-opsi .sub-card.sub-card-aktif");
    settings.sheetBaru       = sheetBaruElm ? sheetBaruElm.dataset.sheet : "Hsk4";
    settings.sheetUrutanBaru = settings.sheetBaru === "Hsk5" ? ["Hsk5"] : ["Hsk4", "Hsk5"];
    settings.kuotaBaru   = parseInt(el("pintar-kuota").value) || 175;
    settings.ukuranRonde = parseInt(el("pintar-ronde").value) || 35;

    const msg = el("pintar-onb-msg");
    if (msg) msg.textContent = "⏳ Menyiapkan data...";

    this._ambilSemuaPool().then(pool => {
      this._seedSheets(pool, seedSheets);
      settings.onboardingSelesai = true;
      this._settings = settings;
      this._simpanSettings();
      if (msg) msg.textContent = "✅ Siap! Membuka menu...";
      setTimeout(() => this._renderMenuUtama(), 500);
    });
  },

  // Seed kata yang "sudah pernah dipelajari" supaya masuk siklus review,
  // dengan tanggal jatuh tempo disebar acak (bukan numpuk semua di hari ini).
  _seedSheets(pool, seedSheets) {
    const words = this._muatWords();
    const hariIni = this._hariIni();
    const BOX_UNTUK_SHEET = { "hsk1-2": 4, "Hsk3": 1 };
    seedSheets.forEach(sid => {
      const box = BOX_UNTUK_SHEET[sid] != null ? BOX_UNTUK_SHEET[sid] : 1;
      const interval = PINTAR_BOX_INTERVAL[box] || 1;
      (pool[sid] || []).forEach(w => {
        if (words[w.id]) return; // sudah ada → jangan ditimpa (aman utk seed ulang)
        const offset = Math.floor(Math.random() * Math.max(1, interval));
        words[w.id] = {
          hanzi: w.hanzi, pinyin: w.pinyin, arti: w.arti, sheet: w.sheet,
          box, due: this._tambahHari(hariIni, offset),
          lastSeen: hariIni, benarTotal: 0, salahTotal: 0, diseed: true,
          // sengaja TANPA firstSeen — biar gak ikut terhitung kuota "kata baru hari ini"
        };
      });
    });
    this._simpanWords();
  },

  // ================================================================
  //  MENU UTAMA (setelah onboarding selesai)
  // ================================================================
  _renderMenuUtama() {
    const words    = this._muatWords();
    const settings = this._muatSettings();
    const hariIni  = this._hariIni();
    const semua    = Object.values(words);

    const due        = semua.filter(w => w.due <= hariIni).length;
    const baruHariIni = semua.filter(w => w.firstSeen === hariIni).length;
    const sisaBaru    = Math.max(0, settings.kuotaBaru - baruHariIni);
    const totalDilacak = semua.length;
    const mantap      = semua.filter(w => w.box >= 5).length;

    setHTML("konten-utama", `
      <div class="soal-wrap" style="margin-bottom:14px">
        <div class="label-mode">🧠 Sesi Pintar</div>
        <div class="soal-hint" style="margin-bottom:16px">Review kata yang mulai lupa + kata baru, otomatis dicampur dalam satu sesi.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="background:#e3f2fd;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--c-biru)">${due}</div>
            <div style="font-size:12px;color:var(--c-sub)">Review jatuh tempo</div>
          </div>
          <div style="background:#e8f5e9;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--c-hijau)">${baruHariIni}/${settings.kuotaBaru}</div>
            <div style="font-size:12px;color:var(--c-sub)">Kata baru hari ini</div>
          </div>
          <div style="background:#fff3e0;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--c-kuning)">${totalDilacak}</div>
            <div style="font-size:12px;color:var(--c-sub)">Total kata dilacak</div>
          </div>
          <div style="background:#f3e5f5;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--c-ungu)">${mantap}</div>
            <div style="font-size:12px;color:var(--c-sub)">Sudah mantap 🏆</div>
          </div>
        </div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="Pintar.mulaiSesi()">▶ Mulai Sesi (${due + sisaBaru} soal)</button>
        </div>
      </div>
      <div class="soal-wrap">
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-abu" onclick="Pintar.bukaPengaturan()">⚙️ Pengaturan</button>
          <button class="btn btn-abu" onclick="Pintar._renderOnboarding()">🌱 Seed Ulang Data</button>
          <button class="btn btn-merah" onclick="Pintar._resetData()">🗑️ Reset Sesi Pintar</button>
        </div>
      </div>
    `);
  },

  // ================================================================
  //  PENGATURAN
  // ================================================================
  bukaPengaturan() {
    const s = this._muatSettings();
    setHTML("konten-utama", `
      <div class="soal-wrap">
        <div class="label-mode">⚙️ Pengaturan Sesi Pintar</div>
        <div class="ss-section">
          <div class="ss-label">🎯 Kuota kata baru per hari</div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="pintar-set-kuota" min="50" max="300" step="25" value="${s.kuotaBaru}"
              oninput="document.getElementById('pintar-set-kuota-val').innerText=this.value" style="flex:1">
            <span id="pintar-set-kuota-val" style="font-weight:700">${s.kuotaBaru}</span>
          </div>
        </div>
        <div class="ss-section">
          <div class="ss-label">☕ Ukuran ronde sebelum saran istirahat</div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="range" id="pintar-set-ronde" min="15" max="60" step="5" value="${s.ukuranRonde}"
              oninput="document.getElementById('pintar-set-ronde-val').innerText=this.value" style="flex:1">
            <span id="pintar-set-ronde-val" style="font-weight:700">${s.ukuranRonde}</span>
          </div>
        </div>
        <div class="ss-section">
          <div class="ss-label">🚀 Sumber kata baru aktif</div>
          <div class="soal-hint" style="margin:0">Saat ini: <b>${s.sheetBaru}</b> (otomatis lanjut ke sheet berikutnya kalau sudah habis diperkenalkan)</div>
        </div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="Pintar._simpanPengaturan()">💾 Simpan</button>
          <button class="btn btn-abu" onclick="Pintar.kembaliMenu()">← Kembali</button>
        </div>
        <p id="pintar-set-msg" style="text-align:center;font-size:13px;margin-top:8px;color:green"></p>
      </div>
    `);
  },

  _simpanPengaturan() {
    const s = this._muatSettings();
    s.kuotaBaru   = parseInt(el("pintar-set-kuota").value) || s.kuotaBaru;
    s.ukuranRonde = parseInt(el("pintar-set-ronde").value) || s.ukuranRonde;
    this._simpanSettings();
    const msg = el("pintar-set-msg");
    if (msg) msg.textContent = "✅ Disimpan!";
    setTimeout(() => this.kembaliMenu(), 700);
  },

  _resetData() {
    if (!confirm("Reset semua data Sesi Pintar (riwayat review per kata + pengaturan)?\nVocab, XP, dan progress modul lain TIDAK akan terpengaruh.")) return;
    localStorage.removeItem(PINTAR_KEY_WORDS);
    localStorage.removeItem(PINTAR_KEY_SETTINGS);
    this._words = null;
    this._settings = null;
    tampilToast("✅ Data Sesi Pintar direset!");
    this._renderOnboarding();
  },

  // ================================================================
  //  MULAI SESI — bangun antrian (review due + kuota kata baru)
  // ================================================================
  async mulaiSesi() {
    resetSkor();
    this._sedangTransisi  = false;
    this._selesaiSesi     = 0;
    this._sesiBaruCount   = 0;
    this._sesiReviewCount = 0;

    const pool     = await this._ambilSemuaPool();
    const settings = this._muatSettings();
    const words    = this._muatWords();
    const hariIni  = this._hariIni();

    const reviewDue = Object.values(words)
      .filter(w => w.due <= hariIni)
      .sort((a, b) => a.box - b.box || (a.due < b.due ? -1 : 1))
      .map(w => ({ ...w, _statusSesi: "review" }));

    const baruHariIni = Object.values(words).filter(w => w.firstSeen === hariIni).length;
    const sisaKuota    = Math.max(0, settings.kuotaBaru - baruHariIni);
    const kataBaru     = this._ambilKataBaru(pool, words, sisaKuota, settings)
      .map(w => ({ ...w, _statusSesi: "baru", box: 0 }));

    this._antrian   = this._interleave(reviewDue, kataBaru);
    this._totalAwal = this._antrian.length;

    if (!this._antrian.length) {
      setHTML("konten-utama", `
        <div class="soal-wrap" style="text-align:center;padding:30px 20px">
          <div style="font-size:40px;margin-bottom:10px">🎉</div>
          <h3>Tidak ada review yang jatuh tempo & kuota kata baru hari ini sudah terisi.</h3>
          <p class="soal-hint">Coba lagi nanti, atau cek Pengaturan untuk naikkan kuota.</p>
          <button class="btn btn-biru" onclick="Pintar.kembaliMenu()">← Menu</button>
        </div>`);
      return;
    }
    this.tampilSoal();
  },

  // Ambil kata baru dari sheet aktif, auto-lanjut ke sheet berikutnya kalau habis
  _ambilKataBaru(pool, words, n, settings) {
    if (n <= 0) return [];
    let hasil = [];
    let idx = settings.sheetUrutanBaru.indexOf(settings.sheetBaru);
    if (idx < 0) idx = 0;
    while (hasil.length < n && idx < settings.sheetUrutanBaru.length) {
      const sid = settings.sheetUrutanBaru[idx];
      const daftar = (pool[sid] || []).filter(w => !words[w.id]);
      const ambil  = daftar.slice(0, n - hasil.length);
      hasil = hasil.concat(ambil);
      if (daftar.length <= ambil.length) {
        idx++;
        settings.sheetBaru = settings.sheetUrutanBaru[idx] || settings.sheetBaru;
      } else break;
    }
    this._simpanSettings();
    return hasil;
  },

  // Selang-seling proporsional dua daftar (review & baru) jadi satu antrian
  _interleave(arrA, arrB) {
    const hasil = [];
    let i = 0, j = 0;
    const totalA = arrA.length, totalB = arrB.length;
    while (i < totalA || j < totalB) {
      const rasioA = totalA ? i / totalA : 1;
      const rasioB = totalB ? j / totalB : 1;
      if (i < totalA && rasioA <= rasioB) { hasil.push(arrA[i++]); continue; }
      if (j < totalB) { hasil.push(arrB[j++]); continue; }
      if (i < totalA) { hasil.push(arrA[i++]); }
    }
    return hasil;
  },

  // ================================================================
  //  TAMPIL SOAL
  // ================================================================
  tampilSoal() {
    this._sedangTransisi = false;
    if (!this._antrian.length) { this.tampilSelesaiSesi(); return; }

    const item = this._antrian.shift();
    this._soalSekarang = item;

    const total = this._totalAwal;
    const pct   = total ? Math.round((this._selesaiSesi / total) * 100) : 0;
    const tag   = item._statusSesi === "baru"
      ? `<span class="pinyin-mode-tag longgar">🌱 Kata Baru</span>`
      : `<span class="pinyin-mode-tag ketat">🔁 Review (box ${item.box})</span>`;

    let bodyHTML;
    if (item._statusSesi === "baru") { this._modeSekarang = "mc"; bodyHTML = this._renderMC(item); }
    else { this._modeSekarang = "typed"; bodyHTML = this._renderTyped(item); }

    setHTML("konten-utama", `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Selesai ${this._selesaiSesi} / ${total} ${tag}</div>
          <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
        </div>
        <div class="progres-bar"><div class="progres-fill" style="width:${pct}%"></div></div>
        ${bodyHTML}
        <div class="btn-row">
          <button class="btn btn-abu" onclick="Pintar.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `);

    if (this._modeSekarang === "typed") {
      setTimeout(() => {
        const inp = el("pintar-input");
        if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === "Enter") Pintar._jawabTyped(); }; }
      }, 80);
    }
  },

  // Kata BARU → mode pengenalan (pilihan ganda hanzi → arti)
  _renderMC(item) {
    const sameSheet = (this._poolSemua[item.sheet] || []).filter(v => v.arti && v.arti !== item.arti);
    const flat       = this._semuaKataFlat(this._poolSemua || {});
    const fallback    = flat.filter(v => v.arti && v.arti !== item.arti);
    const sumber       = sameSheet.length >= 3 ? sameSheet : fallback;
    const acakPool      = acak(sumber).slice(0, 3);
    const semua = acak([item.arti, ...acakPool.map(v => v.arti)]);
    return `
      <div class="soal-hanzi">${item.hanzi}</div>
      <div class="soal-hint">Kata baru — apa artinya?</div>
      <div class="pilihan-grid" id="pintar-pilihan-cont">
        ${semua.map(p => `<button class="btn-pilihan" onclick="Pintar._jawabMC('${this._esc(p)}','${this._esc(item.arti)}')">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="pintar-hasil"></div>
    `;
  },

  // Kata REVIEW → ketik hanzi-nya (sesuai cara belajar yang sudah biasa dipakai)
  _renderTyped(item) {
    return `
      <div class="soal-arti">${item.arti}</div>
      <div class="soal-hint">Ketik Hanzi-nya:</div>
      <input type="text" id="pintar-input" class="input-jawab" placeholder="Ketik Hanzi..." autocomplete="off">
      <div class="hasil-box" id="pintar-hasil"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Pintar._jawabTyped()">✅ Submit</button>
      </div>
    `;
  },

  _jawabMC(dipilih, jawaban) {
    if (this._sedangTransisi) return;
    const benar = dipilih === jawaban;
    document.querySelectorAll("#pintar-pilihan-cont .btn-pilihan").forEach(b => {
      b.disabled = true;
      if (b.innerText === jawaban) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });
    this._tampilkanHasil(benar, this._soalSekarang);
    this._lanjutkanSetelahJawab(benar);
  },

  _jawabTyped() {
    if (this._sedangTransisi) return;
    const inp = el("pintar-input");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const item  = this._soalSekarang;
    const benar = cekHanzi(input, item.hanzi);
    if (inp) inp.disabled = true;
    this._tampilkanHasil(benar, item);
    this._lanjutkanSetelahJawab(benar);
  },

  _tampilkanHasil(benar, item) {
    const hEl = el("pintar-hasil");
    if (!hEl) return;
    hEl.innerHTML = benar
      ? `✅ Benar! <b>${item.hanzi}</b>${item.pinyin ? " (" + item.pinyin + ")" : ""} = ${item.arti}`
      : `❌ Salah. Jawaban: <b>${item.hanzi}</b>${item.pinyin ? " (" + item.pinyin + ")" : ""} = ${item.arti}<br><small>🔄 Lanjut, kata ini muncul lagi sebentar — gak perlu ulang dari awal.</small>`;
    hEl.className = "hasil-box " + (benar ? "benar" : "salah");
  },

  // ================================================================
  //  PROSES JAWABAN — update box/due, TANPA restart total kalau salah
  // ================================================================
  _prosesJawaban(item, benar) {
    tambahSkor(benar);
    const words   = this._muatWords();
    const hariIni = this._hariIni();

    if (item._statusSesi === "baru") {
      if (!benar) return false; // belum lulus pengenalan → coba lagi sebentar
      words[item.id] = {
        hanzi: item.hanzi, pinyin: item.pinyin, arti: item.arti, sheet: item.sheet,
        box: 1, due: this._tambahHari(hariIni, PINTAR_BOX_INTERVAL[1]),
        firstSeen: hariIni, lastSeen: hariIni, benarTotal: 1, salahTotal: 0,
      };
      this._simpanWords();
      return true;
    } else {
      const rec = words[item.id] || {
        hanzi: item.hanzi, pinyin: item.pinyin, arti: item.arti, sheet: item.sheet,
        box: item.box || 0, benarTotal: 0, salahTotal: 0, firstSeen: item.firstSeen,
      };
      if (benar) { rec.box = Math.min(5, (rec.box || 0) + 1); rec.benarTotal = (rec.benarTotal || 0) + 1; }
      else        { rec.box = Math.max(0, (rec.box || 0) - 1); rec.salahTotal = (rec.salahTotal || 0) + 1; }
      rec.lastSeen = hariIni;
      rec.due      = this._tambahHari(hariIni, PINTAR_BOX_INTERVAL[rec.box]);
      words[item.id] = rec;
      this._simpanWords();
      item.box = rec.box; // biar kalau di-requeue, mode/tag sesuai box terbaru
      return benar;
    }
  },

  _lanjutkanSetelahJawab(benar) {
    if (this._sedangTransisi) return;
    this._sedangTransisi = true;
    const item   = this._soalSekarang;
    const lanjut = this._prosesJawaban(item, benar);

    if (!lanjut) {
      const sisip = Math.min(3, this._antrian.length);
      this._antrian.splice(sisip, 0, item);
    } else {
      this._selesaiSesi++;
      if (item._statusSesi === "baru") this._sesiBaruCount++; else this._sesiReviewCount++;
    }

    setTimeout(() => { this._sedangTransisi = false; this._cekRonde(); }, benar ? 1300 : 1900);
  },

  _cekRonde() {
    const settings = this._muatSettings();
    if (this._antrian.length && this._selesaiSesi > 0 && settings.ukuranRonde > 0 &&
        this._selesaiSesi % settings.ukuranRonde === 0) {
      this.tampilIstirahat();
    } else {
      this.tampilSoal();
    }
  },

  tampilIstirahat() {
    setHTML("konten-utama", `
      <div class="soal-wrap" style="text-align:center;padding:30px 20px">
        <div style="font-size:46px;margin-bottom:8px">☕</div>
        <h3>Ronde selesai! ${this._selesaiSesi} kata kelar.</h3>
        <p class="soal-hint">Istirahat sebentar boleh banget — otak butuh waktu buat nyimpen ingatan baru.</p>
        <div class="btn-row" style="justify-content:center;margin-top:14px">
          <button class="btn btn-hijau" onclick="Pintar.tampilSoal()">▶ Lanjut Ronde Berikutnya (${this._antrian.length} sisa)</button>
          <button class="btn btn-biru" onclick="Pintar.tampilSelesaiSesi()">✅ Cukup, Selesai Hari Ini</button>
        </div>
      </div>
    `);
  },

  tampilSelesaiSesi() {
    App.catatSesiSelesai("pintar", sesiSkor.benar, sesiSkor.total);
    const pct   = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    setHTML("konten-utama", `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Sesi Selesai!</h2>
        <div class="selesai-skor">
          <div>🌱 Kata baru: <b>${this._sesiBaruCount || 0}</b></div>
          <div>🔁 Review selesai: <b>${this._sesiReviewCount || 0}</b></div>
          <div>✅ Benar: <b>${sesiSkor.benar}</b> &nbsp; ❌ Salah: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          ${this._antrian.length ? `<button class="btn btn-hijau" onclick="Pintar.tampilSoal()">▶ Lanjutkan Sisa (${this._antrian.length})</button>` : ""}
          <button class="btn btn-biru" onclick="Pintar.kembaliMenu()">← Menu Sesi Pintar</button>
        </div>
      </div>
    `);
  },

  _esc(s) { return (s || "").replace(/'/g, "\\'").replace(/"/g, "&quot;"); },
};
