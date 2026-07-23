// ================================================================
//  PSIKOTES.JS — Modul Latihan Psikotes + Tes Kreplin (Pauli)
//  Fitur:
//    • Soal diambil dari spreadsheet sheet "psikotes"
//      Kolom: Soal | Jawab | Kategori | Pilihan (opsional, pisah ";")
//    • Pilih kategori (bebas berapa saja / All In)
//    • Pengaturan waktu: Tanpa waktu / Stopwatch / Batas waktu
//    • Mode jika salah: Lanjut terus | Ulang di akhir kategori |
//      Ulang sampai benar (lalu mundur 2 soal)
//    • Saat salah: tampil jawaban benar + trik cepat (AI, fallback lokal)
//    • Hasil akhir: skor, waktu, soal sering salah, saran
//    • Tombol "Selesai" + bisa dilanjutkan lagi nanti (mirip Vocab/Sentence)
//    • Sub-modul: Tes Kreplin (penjumlahan digit ala tes Pauli/Kraepelin)
// ================================================================

function pkEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

var Psikotes = {

  SHEET_NAME: "psikotes",

  allSoal: [],
  kategoriList: [],

  cfg: {
    kategori: [],            // kategori terpilih (kosong = belum dipilih)
    waktuMode: "stopwatch",  // "none" | "stopwatch" | "limit"
    batasMenit: 5,
    modeSalah: "lanjut",     // "lanjut" | "akhirKategori" | "ulangSampaiBenar"
  },

  state: {},
  _pkInterval: null,

  // ================================================================
  //  MENU UTAMA
  // ================================================================
  renderMenu() {
    const lanjut = ambilSesiLanjut("psikotes");
    const bannerLanjut = lanjut ? `
      <div class="sub-card sub-card-aktif" style="margin-bottom:12px" onclick="Psikotes.lanjutkanSesi()">
        <div class="sub-icon">▶</div>
        <div class="sub-label">Lanjutkan Latihan Psikotes</div>
        <div class="sub-desc">Soal ${Math.min(lanjut.state.queuePtr + 1, lanjut.state.currentQueue.length)}/${lanjut.state.currentQueue.length} — ✅ ${lanjut.state.skor.benar} ❌ ${lanjut.state.skor.salah}</div>
      </div>` : "";

    return `
      <div style="padding-bottom:12px">
        ${bannerLanjut}
        <div class="sub-menu-grid">
          <div class="sub-card" onclick="Psikotes.bukaSetupLatihan()">
            <div class="sub-icon">🧩</div>
            <div class="sub-label">Latihan Soal Psikotes</div>
            <div class="sub-desc">Pilih kategori, atur waktu &amp; mode jika salah</div>
          </div>
          <div class="sub-card" onclick="Psikotes.Kreplin.bukaSetup()">
            <div class="sub-icon">🔢</div>
            <div class="sub-label">Tes Kreplin</div>
            <div class="sub-desc">Hitung cepat ala tes Pauli/Kraepelin</div>
          </div>
        </div>
      </div>
    `;
  },

  _pasangEventMenu() {},

  kembaliMenu() {
    this._hentikanTimerSesi();
    if (this.Kreplin) this.Kreplin._bersihkan();
    App.renderModul("psikotes");
  },

  // ================================================================
  //  AMBIL & PARSE DATA SPREADSHEET
  // ================================================================
  async _fetchSheet() {
    const sheetId = (typeof SHEET_ID !== "undefined") ? SHEET_ID : "1QozIKvWjISQmFK15mvjk9maH3FfDENGhmrIRS5BoHiE";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.SHEET_NAME)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const teks = await res.text();
    return this._parseCSV(teks);
  },

  _parseCSV(teks) {
    const baris = teks.trim().split("\n").slice(1); // skip header
    return baris.map((b, i) => {
      const col = this._splitCSVRow(b);
      if (!col[0]) return null;
      return {
        id: i,
        soal: col[0] || "",
        jawaban: (col[1] || "").trim(),
        kategori: (col[2] || "").trim() || "Umum",
        pilihanRaw: (col[3] || "").trim(),
      };
    }).filter(Boolean).filter(s => s.soal && s.jawaban);
  },

  _splitCSVRow(row) {
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    result.push(cur.trim());
    return result;
  },

  // Bangun 4-6 pilihan ganda dari 1 soal. Kalau kolom Pilihan kosong,
  // otomatis bikin pengecoh: angka acak (kalau jawaban angka) atau
  // jawaban soal lain di kategori yang sama (kalau bukan angka).
  _buatPilihan(soal) {
    const jawabanBenar = String(soal.jawaban).trim();
    let pilihan = [];
    if (soal.pilihanRaw) pilihan = soal.pilihanRaw.split(";").map(s => s.trim()).filter(Boolean);
    if (!pilihan.some(p => p.toLowerCase() === jawabanBenar.toLowerCase())) pilihan.push(jawabanBenar);

    const isNumeric = /^-?\d+(\.\d+)?$/.test(jawabanBenar.replace(",", "."));
    let guard = 0;
    while (pilihan.length < 4 && guard < 30) {
      guard++;
      let kandidat;
      if (isNumeric) {
        const base = parseFloat(jawabanBenar.replace(",", "."));
        const delta = (Math.floor(Math.random() * 10) + 1) * (Math.random() < 0.5 ? -1 : 1);
        let v = base + delta;
        if (Number.isInteger(base)) v = Math.round(v);
        kandidat = String(v);
      } else {
        const sameKat = this.allSoal.filter(s => s.kategori === soal.kategori && s.jawaban && s.jawaban.toLowerCase() !== jawabanBenar.toLowerCase());
        const pool = sameKat.length ? sameKat : this.allSoal.filter(s => s.jawaban && s.jawaban.toLowerCase() !== jawabanBenar.toLowerCase());
        kandidat = pool.length ? pool[Math.floor(Math.random() * pool.length)].jawaban : jawabanBenar + " ";
      }
      if (!pilihan.some(p => p.toLowerCase() === String(kandidat).toLowerCase())) pilihan.push(String(kandidat));
    }
    return acak(pilihan.slice(0, 6));
  },

  // ================================================================
  //  SETUP LATIHAN
  // ================================================================
  async bukaSetupLatihan() {
    el("konten-utama").innerHTML = `<div class="pk-card" style="text-align:center;padding:30px 16px">⏳ Memuat soal psikotes dari spreadsheet...</div>`;
    if (!this.allSoal.length) {
      try {
        this.allSoal = await this._fetchSheet();
      } catch (e) {
        el("konten-utama").innerHTML = `
          <div class="pk-card">
            <p>⚠️ Gagal memuat data dari spreadsheet. Pastikan sheet <b>"psikotes"</b> tersedia &amp; bisa diakses publik.</p>
            <div class="btn-row" style="margin-top:12px">
              <button class="btn btn-biru" onclick="Psikotes.bukaSetupLatihan()">🔄 Coba Lagi</button>
              <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
            </div>
          </div>`;
        return;
      }
    }
    if (!this.allSoal.length) {
      el("konten-utama").innerHTML = `
        <div class="pk-card">
          <p>⚠️ Tidak ada soal ditemukan di sheet "psikotes".</p>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
          </div>
        </div>`;
      return;
    }
    this.kategoriList = [...new Set(this.allSoal.map(s => s.kategori))];
    if (!this.cfg.kategori.length) this.cfg.kategori = [...this.kategoriList];
    else this.cfg.kategori = this.cfg.kategori.filter(k => this.kategoriList.includes(k));
    this._renderSetupLatihan();
  },

  _muatUlang() {
    this.allSoal = [];
    this.bukaSetupLatihan();
  },

  _renderSetupLatihan() {
    const kategoriHtml = this.kategoriList.map((k, idx) => {
      const jumlah = this.allSoal.filter(s => s.kategori === k).length;
      const aktif = this.cfg.kategori.includes(k) ? "aktif" : "";
      return `<button class="opsi aktif-ungu ${aktif}" onclick="Psikotes._toggleKategoriIdx(${idx})">${pkEsc(k)} (${jumlah})</button>`;
    }).join("");

    const jumlahTerpilih = this.allSoal.filter(s => this.cfg.kategori.includes(s.kategori)).length;

    el("konten-utama").innerHTML = `
      <div class="pk-setup-wrap">

        <div class="pk-card">
          <h3>📂 Pilih Kategori</h3>
          <div class="btn-row" style="margin-bottom:4px">
            <button class="btn btn-abu" style="font-size:12px" onclick="Psikotes._pilihSemuaKategori()">✅ Pilih Semua (All In)</button>
            <button class="btn btn-abu" style="font-size:12px" onclick="Psikotes._kosongkanKategori()">⬜ Kosongkan</button>
            <button class="btn btn-abu" style="font-size:12px" onclick="Psikotes._muatUlang()">🔄 Muat Ulang Data</button>
          </div>
          <div class="opsi-grup">${kategoriHtml}</div>
          <p class="pk-hint">📊 ${jumlahTerpilih} soal terpilih dari ${this.allSoal.length} total soal.</p>
        </div>

        <div class="pk-card">
          <h3>⏱️ Pengaturan Waktu</h3>
          <div class="opsi-grup">
            <button class="opsi ${this.cfg.waktuMode === 'none' ? 'aktif' : ''}" onclick="Psikotes._pilihWaktu('none')">🚫 Tanpa Waktu</button>
            <button class="opsi ${this.cfg.waktuMode === 'stopwatch' ? 'aktif' : ''}" onclick="Psikotes._pilihWaktu('stopwatch')">⏱️ Stopwatch (Hitung Naik)</button>
            <button class="opsi ${this.cfg.waktuMode === 'limit' ? 'aktif' : ''}" onclick="Psikotes._pilihWaktu('limit')">⏳ Batas Waktu</button>
          </div>
          <div id="pk-batas-waktu-wrap" style="display:${this.cfg.waktuMode === 'limit' ? 'block' : 'none'};margin-top:10px">
            <label style="font-size:13px;color:var(--c-sub)">Batas waktu (menit):</label><br>
            <input type="number" id="pk-batas-menit" class="quiz-select" style="max-width:120px;margin-top:6px" min="1" max="180"
              value="${this.cfg.batasMenit}" onchange="Psikotes.cfg.batasMenit = Math.max(1, parseInt(this.value)||5)">
          </div>
          <p class="pk-hint">
            ${this.cfg.waktuMode === 'none' ? 'Waktu tidak ditampilkan/dibatasi sama sekali.'
              : this.cfg.waktuMode === 'stopwatch' ? 'Waktu berjalan naik supaya kamu tahu berapa lama mengerjakan, tanpa batas.'
              : 'Sesi otomatis selesai kalau waktu habis.'}
          </p>
        </div>

        <div class="pk-card">
          <h3>🎮 Mode Jika Salah</h3>
          <div class="opsi-grup" style="flex-direction:column;align-items:stretch">
            <button class="opsi aktif-hijau ${this.cfg.modeSalah === 'lanjut' ? 'aktif' : ''}" onclick="Psikotes._pilihModeSalah('lanjut')">➡️ Lanjut Terus — jawaban benar ditampilkan, lalu lanjut ke soal berikutnya</button>
            <button class="opsi aktif-kuning ${this.cfg.modeSalah === 'akhirKategori' ? 'aktif' : ''}" onclick="Psikotes._pilihModeSalah('akhirKategori')">🔁 Muncul Lagi di Akhir Kategori — soal salah diulang setelah kategori itu selesai</button>
            <button class="opsi aktif-merah ${this.cfg.modeSalah === 'ulangSampaiBenar' ? 'aktif' : ''}" onclick="Psikotes._pilihModeSalah('ulangSampaiBenar')">🔂 Ulang Sampai Benar — jawab ulang soal yang sama sampai benar, lalu mundur 2 soal</button>
          </div>
        </div>

        <p class="pk-hint" style="text-align:center">💡 Trik cepat &amp; saran otomatis pakai AI (Gemini) kalau API key sudah diisi di fitur AI lain — kalau belum, tetap ada saran umum.</p>

        <div class="btn-row" style="justify-content:center">
          <button class="btn btn-hijau" onclick="Psikotes._mulaiLatihan()">▶ Mulai Latihan</button>
          <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
        </div>
      </div>
    `;
  },

  _toggleKategoriIdx(idx) {
    const k = this.kategoriList[idx];
    const pos = this.cfg.kategori.indexOf(k);
    if (pos === -1) this.cfg.kategori.push(k); else this.cfg.kategori.splice(pos, 1);
    this._renderSetupLatihan();
  },
  _pilihSemuaKategori() { this.cfg.kategori = [...this.kategoriList]; this._renderSetupLatihan(); },
  _kosongkanKategori() { this.cfg.kategori = []; this._renderSetupLatihan(); },
  _pilihWaktu(mode) { this.cfg.waktuMode = mode; this._renderSetupLatihan(); },
  _pilihModeSalah(mode) { this.cfg.modeSalah = mode; this._renderSetupLatihan(); },

  // ================================================================
  //  MULAI SESI LATIHAN
  // ================================================================
  _mulaiLatihan() {
    const menitInput = el("pk-batas-menit");
    if (menitInput) this.cfg.batasMenit = Math.max(1, parseInt(menitInput.value) || 5);

    if (!this.cfg.kategori.length) { tampilToast("⚠️ Pilih minimal 1 kategori dulu!"); return; }
    const soalTerpilih = this.allSoal.filter(s => this.cfg.kategori.includes(s.kategori));
    if (!soalTerpilih.length) { tampilToast("⚠️ Tidak ada soal untuk kategori ini."); return; }

    resetSkor();
    this.state = {
      skor: { benar: 0, salah: 0 },
      mulaiTs: Date.now(),
      deadlineTs: 0,
      waktuHabis: false,
      riwayatSalah: {},
      queuePtr: 0,
      currentQueue: [],
      retryQueue: [],
      blockIdx: 0,
      kategoriUrut: [],
      sedangTransisi: false,
    };

    if (this.cfg.modeSalah === "akhirKategori") {
      this.state.kategoriUrut = this.kategoriList.filter(k => this.cfg.kategori.includes(k));
      const kat0 = this.state.kategoriUrut[0];
      this.state.currentQueue = acak(this.allSoal.filter(s => s.kategori === kat0));
    } else {
      this.state.currentQueue = acak(soalTerpilih);
    }

    this._mulaiTimerSesi();
    this._tampilSoalLatihan();
  },

  // ================================================================
  //  TIMER SESI (stopwatch / batas waktu)
  // ================================================================
  _mulaiTimerSesi() {
    this._hentikanTimerSesi();
    if (this.cfg.waktuMode === "none") return;
    if (this.cfg.waktuMode === "limit" && !this.state.deadlineTs) {
      this.state.deadlineTs = Date.now() + this.cfg.batasMenit * 60000;
    }
    this._pkInterval = setInterval(() => {
      const tEl = el("pk-timer");
      if (this.cfg.waktuMode === "stopwatch") {
        const detik = Math.floor((Date.now() - this.state.mulaiTs) / 1000);
        if (tEl) tEl.textContent = this._formatWaktu(detik);
      } else if (this.cfg.waktuMode === "limit") {
        const sisaMs = this.state.deadlineTs - Date.now();
        const sisaDetik = Math.max(0, Math.floor(sisaMs / 1000));
        if (tEl) tEl.textContent = this._formatWaktu(sisaDetik);
        if (sisaMs <= 0) {
          this.state.waktuHabis = true;
          this._hentikanTimerSesi();
          tampilToast("⏰ Waktu habis!");
          this._tampilSelesai();
        }
      }
    }, 1000);
  },
  _hentikanTimerSesi() { if (this._pkInterval) clearInterval(this._pkInterval); this._pkInterval = null; },
  _formatWaktu(detik) {
    const m = Math.floor(detik / 60), s = detik % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  },

  // ================================================================
  //  TAMPIL SOAL
  // ================================================================
  _tampilSoalLatihan(isRetry) {
    const soal = this.state.currentQueue[this.state.queuePtr];
    if (!soal) { this._tampilSelesai(); return; }
    const pilihan = this._buatPilihan(soal);
    const totalDiBlok = this.state.currentQueue.length;
    const noSekarang = this.state.queuePtr + 1;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <span class="progres-teks">${isRetry ? "🔂 Ulangi · " : ""}Soal ${noSekarang}/${totalDiBlok}</span>
          <span id="pk-skor-mini"></span>
        </div>
        ${this.cfg.waktuMode !== "none" ? `<div class="timer-box" id="pk-timer">--:--</div>` : ""}
        <div class="quiz-label-row"><span class="quiz-chip quiz-chip-ungu">${pkEsc(soal.kategori)}</span></div>
        <div class="quiz-soal-box">${pkEsc(soal.soal)}</div>
        <div id="pk-pilihan-wrap" class="sub-menu-grid" style="grid-template-columns:1fr"></div>
        <div id="pk-hasil" class="hasil-box" style="display:none"></div>
        <div class="btn-row" style="margin-top:14px;justify-content:center">
          <button class="btn btn-abu" onclick="Psikotes.selesaiSekarang()">✅ Selesai</button>
        </div>
      </div>
    `;
    const wrap = el("pk-pilihan-wrap");
    pilihan.forEach((p, i) => {
      const b = document.createElement("button");
      b.className = "btn-pilihan";
      b.style.textAlign = "left";
      b.innerText = p;
      b.onclick = () => isRetry ? this._pilihJawabanRetry(wrap, pilihan, soal, i) : this._pilihJawaban(wrap, pilihan, soal, i);
      wrap.appendChild(b);
    });
    this._updateSkorMiniLatihan();
    if (this.cfg.waktuMode === "stopwatch") { const t = el("pk-timer"); if (t) t.textContent = this._formatWaktu(Math.floor((Date.now() - this.state.mulaiTs) / 1000)); }
  },

  _updateSkorMiniLatihan() {
    setHTML("pk-skor-mini", `✅ ${this.state.skor.benar} &nbsp;❌ ${this.state.skor.salah}`);
  },

  _catatSalah(soal) {
    const key = soal.id + "|" + soal.kategori;
    if (!this.state.riwayatSalah[key]) this.state.riwayatSalah[key] = { soal, count: 0 };
    this.state.riwayatSalah[key].count++;
  },

  // ================================================================
  //  JAWAB SOAL (normal)
  // ================================================================
  _pilihJawaban(container, pilihanArr, soal, idxPilihan) {
    if (this.state.sedangTransisi) return;
    const idxBenar = pilihanArr.findIndex(p => String(p).trim().toLowerCase() === String(soal.jawaban).trim().toLowerCase());
    const benar = idxPilihan === idxBenar;
    highlightPilihan(container, idxBenar, idxPilihan);
    const hasilEl = el("pk-hasil");
    this.state.sedangTransisi = true;

    if (benar) {
      tambahSkor(true);
      this.state.skor.benar++;
      if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box benar"; hasilEl.innerText = "✅ Benar!"; }
      this._updateSkorMiniLatihan();
      setTimeout(() => { this.state.sedangTransisi = false; this._advance(); }, 1200);
    } else {
      tambahSkor(false);
      this.state.skor.salah++;
      this._catatSalah(soal);
      if (hasilEl) {
        hasilEl.style.display = "block"; hasilEl.className = "hasil-box salah";
        hasilEl.innerHTML = `❌ Salah! Jawaban benar: <b>${pkEsc(soal.jawaban)}</b><br><span id="pk-trik-loading">⏳ Mencari trik cepat...</span>`;
      }
      this._tampilkanTrik(soal);
      this._updateSkorMiniLatihan();
      if (this.cfg.modeSalah === "akhirKategori") this.state.retryQueue.push(soal);
      const jeda = this.cfg.modeSalah === "ulangSampaiBenar" ? 2200 : 2600;
      setTimeout(() => {
        this.state.sedangTransisi = false;
        if (this.cfg.modeSalah === "ulangSampaiBenar") this._tampilSoalLatihan(true);
        else this._advance();
      }, jeda);
    }
  },

  // ── Jawab ulang (mode "Ulang Sampai Benar") ─────────────────────
  _pilihJawabanRetry(container, pilihanArr, soal, idxPilihan) {
    if (this.state.sedangTransisi) return;
    const idxBenar = pilihanArr.findIndex(p => String(p).trim().toLowerCase() === String(soal.jawaban).trim().toLowerCase());
    const benar = idxPilihan === idxBenar;
    highlightPilihan(container, idxBenar, idxPilihan);
    const hasilEl = el("pk-hasil");
    this.state.sedangTransisi = true;

    if (benar) {
      if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box benar"; hasilEl.innerText = "✅ Benar! Mundur 2 soal untuk pengulangan..."; }
      setTimeout(() => {
        this.state.sedangTransisi = false;
        this.state.queuePtr = Math.max(0, this.state.queuePtr - 2);
        this._simpanLanjut();
        this._tampilSoalLatihan();
      }, 1400);
    } else {
      if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box salah"; hasilEl.innerText = "❌ Masih salah, coba lagi..."; }
      setTimeout(() => { this.state.sedangTransisi = false; this._tampilSoalLatihan(true); }, 1400);
    }
  },

  // ================================================================
  //  LANJUT KE SOAL BERIKUTNYA (mengurus blok kategori & retry queue)
  // ================================================================
  _advance() {
    this.state.queuePtr++;
    this._simpanLanjut();
    if (this.state.queuePtr < this.state.currentQueue.length) {
      this._tampilSoalLatihan();
      return;
    }
    if (this.cfg.modeSalah === "akhirKategori") {
      if (this.state.retryQueue.length) {
        tampilToast(`🔁 Mengulang ${this.state.retryQueue.length} soal yang salah di kategori ini...`);
        this.state.currentQueue = this.state.retryQueue;
        this.state.retryQueue = [];
        this.state.queuePtr = 0;
        this._simpanLanjut();
        this._tampilSoalLatihan();
        return;
      }
      this.state.blockIdx++;
      if (this.state.blockIdx < this.state.kategoriUrut.length) {
        const kat = this.state.kategoriUrut[this.state.blockIdx];
        this.state.currentQueue = acak(this.allSoal.filter(s => s.kategori === kat));
        this.state.queuePtr = 0;
        tampilToast(`📂 Kategori: ${kat}`);
        this._simpanLanjut();
        this._tampilSoalLatihan();
        return;
      }
    }
    this._tampilSelesai();
  },

  // ================================================================
  //  TRIK CEPAT (AI, fallback lokal)
  // ================================================================
  async _tampilkanTrik(soal) {
    const target = el("pk-trik-loading");
    if (!target) return;
    let teks;
    try {
      if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) throw new Error("no-key");
      const prompt = `Kamu tutor psikotes. Soal: "${soal.soal}" (kategori: "${soal.kategori}"). Jawaban benar: "${soal.jawaban}".
Berikan HANYA 1-2 kalimat singkat berbahasa Indonesia: trik cepat / cara berpikir praktis untuk soal jenis ini tanpa kalkulator, atau analogi sederhana. Jangan mengulang soal atau jawabannya, langsung ke triknya.`;
      teks = await GeminiAPI.call(prompt, 200);
    } catch (e) {
      teks = this._localTrik(soal);
    }
    const el2 = el("pk-trik-loading");
    if (el2) el2.outerHTML = `<span>💡 <b>Trik:</b> ${typeof GeminiAPI !== "undefined" ? GeminiAPI.esc2(teks) : pkEsc(teks)}</span>`;
  },

  _localTrik(soal) {
    const kat = (soal.kategori || "").toLowerCase();
    const jawabanNumerik = /^-?\d+(\.\d+)?$/.test((soal.jawaban || "").trim());
    if (kat.includes("deret") || kat.includes("numerik") || kat.includes("angka")) {
      return "Cari polanya: apakah selisih antar angka tetap (deret aritmatika), atau rasionya tetap (deret geometri, misalnya dikali 2 tiap langkah)?";
    }
    if (kat.includes("analog") || kat.includes("padanan") || kat.includes("verbal")) {
      return "Tentukan dulu hubungan kata pertama & kedua (sebab-akibat, bagian-keseluruhan, dsb), lalu cari pasangan ketiga dengan hubungan yang sama.";
    }
    if (kat.includes("logika") || kat.includes("penalaran")) {
      return "Uraikan jadi premis-premis sederhana, lalu cek pilihan mana yang PASTI benar berdasarkan semua premis, bukan sekadar mungkin benar.";
    }
    if (kat.includes("spasial") || kat.includes("gambar") || kat.includes("bangun")) {
      return "Perhatikan perubahan bentuk/posisi/jumlah dari satu gambar ke gambar berikutnya — biasanya ada satu aturan konsisten yang berulang.";
    }
    if (jawabanNumerik) {
      return "Coba cocokkan tiap pilihan jawaban ke pola soal (hitung mundur), kadang lebih cepat daripada menghitung maju dari awal.";
    }
    return "Baca ulang soal perlahan, garis bawahi kata kunci, lalu eliminasi dulu pilihan yang jelas salah sebelum memutuskan.";
  },

  // ================================================================
  //  SELESAI / HASIL AKHIR
  // ================================================================
  selesaiSekarang() {
    this._hentikanTimerSesi();
    this._tampilSelesai(true);
  },

  _tampilSelesai(dipercepat) {
    this._hentikanTimerSesi();
    hapusSesiLanjut("psikotes");
    const total = this.state.skor.benar + this.state.skor.salah;
    const pct = total ? Math.round((this.state.skor.benar / total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    const elapsedDetik = Math.floor((Date.now() - this.state.mulaiTs) / 1000);

    App.catatSesiSelesai("psikotes", this.state.skor.benar, total);

    const daftarSalah = Object.values(this.state.riwayatSalah).sort((a, b) => b.count - a.count).slice(0, 5);

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap" style="text-align:left">
        <div style="text-align:center">
          <div class="selesai-emoji">${emoji}</div>
          <h2 style="text-align:center">Latihan Psikotes Selesai!</h2>
          ${dipercepat ? `<div class="soal-hint" style="text-align:center">Diselesaikan lebih awal</div>` : ""}
          ${this.state.waktuHabis ? `<div class="soal-hint" style="text-align:center">⏰ Waktu habis</div>` : ""}
        </div>
        <div class="selesai-skor" style="text-align:center">
          <div>✅ Benar: <b>${this.state.skor.benar}</b> &nbsp; ❌ Salah: <b>${this.state.skor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
          <div class="soal-hint">⏱️ Waktu: ${this._formatWaktu(elapsedDetik)}</div>
        </div>

        ${daftarSalah.length ? `
        <div class="pk-card" style="margin-top:14px">
          <h3>🔁 Soal yang Sering Salah</h3>
          <ul style="margin:6px 0 0 18px;padding:0;font-size:13.5px">
            ${daftarSalah.map(d => `<li style="margin-bottom:6px"><b>${pkEsc(d.soal.soal)}</b><br>Jawaban benar: <span style="color:var(--c-hijau-d);font-weight:700">${pkEsc(d.soal.jawaban)}</span>${d.count > 1 ? ` (salah ${d.count}×)` : ""}</li>`).join("")}
          </ul>
        </div>` : ""}

        <div class="pk-card" style="margin-top:14px">
          <h3>💡 Saran</h3>
          <div id="pk-saran-akhir" class="pk-saran-teks">⏳ Menyiapkan saran...</div>
        </div>

        <div class="btn-row" style="justify-content:center;margin-top:16px">
          <button class="btn btn-hijau" onclick="Psikotes.bukaSetupLatihan()">🔄 Latihan Lagi</button>
          <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Menu Psikotes</button>
        </div>
      </div>
    `;
    this._isiSaranAkhir(pct, daftarSalah);
  },

  async _isiSaranAkhir(pct, daftarSalah) {
    const target = el("pk-saran-akhir");
    if (!target) return;
    let teks;
    try {
      if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) throw new Error("no-key");
      const daftarTeks = daftarSalah.slice(0, 3).map(d => `- ${d.soal.soal} (kategori: ${d.soal.kategori})`).join("\n");
      const prompt = `Pengguna baru saja latihan soal psikotes dan mendapat skor ${pct}%.
${daftarTeks ? "Beberapa soal yang sering salah:\n" + daftarTeks : "Tidak ada catatan soal yang salah."}
Berikan saran singkat (maksimal 4 kalimat, berbahasa Indonesia, dalam bentuk paragraf tanpa list) untuk membantu pengguna berlatih lebih baik, termasuk 1 trik berpikir cepat yang relevan.`;
      teks = await GeminiAPI.call(prompt, 300);
    } catch (e) {
      teks = pct >= 80
        ? "Hasil kamu sudah bagus! Coba tingkatkan lagi dengan mencoba kategori yang belum dikuasai, atau kurangi waktu pengerjaan untuk melatih kecepatan berpikir."
        : "Fokus dulu pada kategori dengan jawaban salah terbanyak, pelajari pola soalnya, lalu ulangi latihan khusus kategori itu sampai terbiasa. Jangan terburu-buru — pahami dulu logika di balik tiap soal sebelum menjawab cepat.";
    }
    target.innerHTML = typeof GeminiAPI !== "undefined" ? GeminiAPI.esc2(teks) : pkEsc(teks).replace(/\n/g, "<br>");
  },

  // ================================================================
  //  LANJUTKAN SESI TERTUNDA
  // ================================================================
  _simpanLanjut() {
    if (!this.state.currentQueue || !this.state.currentQueue.length) return;
    this.state.elapsedMsSaatSimpan = Date.now() - this.state.mulaiTs;
    if (this.cfg.waktuMode === "limit") {
      this.state.sisaDetikSaatSimpan = Math.max(0, Math.round((this.state.deadlineTs - Date.now()) / 1000));
    }
    simpanSesiLanjut("psikotes", { cfg: this.cfg, state: this.state });
  },

  lanjutkanSesi() {
    const data = ambilSesiLanjut("psikotes");
    if (!data) { tampilToast("⚠️ Tidak ada sesi tersimpan."); return; }
    hapusSesiLanjut("psikotes");
    this.cfg = data.cfg;
    this.state = data.state;
    this.state.mulaiTs = Date.now() - (this.state.elapsedMsSaatSimpan || 0);
    if (this.cfg.waktuMode === "limit") {
      this.state.deadlineTs = Date.now() + (this.state.sisaDetikSaatSimpan != null ? this.state.sisaDetikSaatSimpan : this.cfg.batasMenit * 60) * 1000;
    }
    this.state.sedangTransisi = false;
    setSkor(this.state.skor.benar, this.state.skor.salah, this.state.skor.benar + this.state.skor.salah);

    const lanjutkanTampil = () => { this._mulaiTimerSesi(); this._tampilSoalLatihan(); };
    if (this.allSoal && this.allSoal.length) { lanjutkanTampil(); return; }
    this._fetchSheet().then(d => {
      this.allSoal = d || [];
      this.kategoriList = [...new Set(this.allSoal.map(s => s.kategori))];
      lanjutkanTampil();
    }).catch(() => { tampilToast("⚠️ Gagal memuat ulang data soal."); this.kembaliMenu(); });
  },

  // ================================================================
  //  ================  SUB-MODUL: TES KREPLIN  =====================
  // ================================================================
  Kreplin: {

    cfg: { baris: 10, kolom: 4 },
    state: {},
    _pkInterval: null,
    _keyHandlerBound: null,

    bukaSetup() {
      el("konten-utama").innerHTML = `
        <div class="pk-setup-wrap">
          <div class="pk-card">
            <h3>🔢 Tes Kreplin (Pauli)</h3>
            <p class="pk-hint">Jumlahkan dua angka yang berurutan, lalu masukkan <b>angka satuan</b> (digit terakhir) dari hasilnya.
            Contoh: 7 + 6 = 13 → jawab <b>3</b>. Setiap kolom selesai, otomatis pindah ke kolom berikutnya (sisi kanan).</p>
          </div>
          <div class="pk-card">
            <h3>📐 Ukuran Tes</h3>
            <p class="pk-hint">Format <b>Baris × Kolom</b> — Baris = jumlah soal penjumlahan per kolom, Kolom = jumlah kolom.</p>
            <div class="opsi-grup">
              ${[[10, 2], [10, 4], [15, 4], [10, 6], [20, 4], [4, 2]].map(([b, k]) =>
                `<button class="opsi ${this.cfg.baris === b && this.cfg.kolom === k ? 'aktif' : ''}" onclick="Psikotes.Kreplin._pilihPreset(${b},${k})">${b}×${k}</button>`
              ).join("")}
            </div>
            <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
              <div>
                <label style="font-size:13px;color:var(--c-sub)">Baris (soal/kolom)</label><br>
                <input type="number" id="pk-kr-baris" class="quiz-select" style="max-width:110px" min="2" max="60"
                  value="${this.cfg.baris}" onchange="Psikotes.Kreplin._setBaris(this.value)">
              </div>
              <div>
                <label style="font-size:13px;color:var(--c-sub)">Kolom</label><br>
                <input type="number" id="pk-kr-kolom" class="quiz-select" style="max-width:110px" min="1" max="20"
                  value="${this.cfg.kolom}" onchange="Psikotes.Kreplin._setKolom(this.value)">
              </div>
            </div>
            <p class="pk-hint">Total soal: <b id="pk-kr-total">${this.cfg.baris * this.cfg.kolom}</b></p>
          </div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="Psikotes.Kreplin._mulai()">▶ Mulai Kreplin</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
          </div>
        </div>
      `;
    },

    _pilihPreset(b, k) { this.cfg.baris = b; this.cfg.kolom = k; this.bukaSetup(); },
    _setBaris(v) { this.cfg.baris = Math.max(2, parseInt(v) || 10); this._updateTotal(); },
    _setKolom(v) { this.cfg.kolom = Math.max(1, parseInt(v) || 4); this._updateTotal(); },
    _updateTotal() { const t = el("pk-kr-total"); if (t) t.textContent = this.cfg.baris * this.cfg.kolom; },

    _mulai() {
      const bEl = el("pk-kr-baris"), kEl = el("pk-kr-kolom");
      if (bEl) this.cfg.baris = Math.max(2, parseInt(bEl.value) || 10);
      if (kEl) this.cfg.kolom = Math.max(1, parseInt(kEl.value) || 4);

      this.state = {
        kolomKe: 0, soalKe: 0, angka: [],
        kolomData: [],
        mulaiTs: Date.now(),
        kolomMulaiTs: 0,
        soalMulaiTs: 0,
        salahDetail: {},
        totalBenar: 0, totalSalah: 0,
        _transisi: false,
      };
      this._bangunKolomBaru();
      this._tampilSoal();
      this._mulaiStopwatch();
      this._keyHandlerBound = (e) => this._onKeydown(e);
      document.addEventListener("keydown", this._keyHandlerBound);
    },

    _bangunKolomBaru() {
      const n = this.cfg.baris + 1;
      this.state.angka = Array.from({ length: n }, () => Math.floor(Math.random() * 10));
      this.state.soalKe = 0;
      this.state.kolomMulaiTs = Date.now();
      this.state.soalMulaiTs = Date.now();
      this.state.kolomData.push({ benar: 0, salah: 0, mulai: Date.now(), selesai: null, waktuSoal: [] });
    },

    _tampilSoal() {
      const { angka, soalKe, kolomKe } = this.state;
      const atas = angka[soalKe], bawah = angka[soalKe + 1];
      const stripHtml = angka.map((d, i) => {
        let cls = "pk-kr-digit";
        if (i === soalKe || i === soalKe + 1) cls += " aktif";
        else if (i < soalKe) cls += " selesai";
        return `<div class="${cls}">${d}</div>`;
      }).join("");

      el("konten-utama").innerHTML = `
        <div class="soal-wrap">
          <div class="soal-header">
            <span class="progres-teks">Kolom ${kolomKe + 1}/${this.cfg.kolom} · Soal ${soalKe + 1}/${this.cfg.baris}</span>
            <span id="pk-skor-mini">✅ ${this.state.totalBenar} &nbsp;❌ ${this.state.totalSalah}</span>
          </div>
          <div class="timer-box" id="pk-timer" style="font-size:20px">${this._formatWaktu(Math.floor((Date.now() - this.state.mulaiTs) / 1000))}</div>
          <div class="pk-kr-wrap">
            <div class="pk-kr-strip">${stripHtml}</div>
            <div class="pk-kr-main">
              <div class="pk-kr-num">${atas}</div>
              <div class="pk-kr-num">${bawah}</div>
              <div class="pk-kr-garis"></div>
              <input type="tel" inputmode="numeric" maxlength="1" id="pk-kr-input" class="pk-kr-input" autocomplete="off">
            </div>
          </div>
          <div class="pk-kr-numpad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="pk-kr-key" onclick="Psikotes.Kreplin._jawab(${d})">${d}</button>`).join("")}
          </div>
          <div class="btn-row" style="justify-content:center;margin-top:10px">
            <button class="btn btn-abu" onclick="Psikotes.Kreplin.selesaiSekarang()">✅ Selesai</button>
          </div>
        </div>
      `;
      const inp = el("pk-kr-input");
      if (inp) {
        inp.value = "";
        inp.focus();
        inp.oninput = () => {
          const v = inp.value.replace(/[^0-9]/g, "").slice(-1);
          inp.value = v;
          if (v !== "") this._jawab(parseInt(v));
        };
      }
    },

    _onKeydown(e) {
      if (e.key >= "0" && e.key <= "9") this._jawab(parseInt(e.key));
    },

    _jawab(digit) {
      if (this.state._transisi) return;
      const { angka, soalKe } = this.state;
      const atas = angka[soalKe], bawah = angka[soalKe + 1];
      const jawabanBenar = (atas + bawah) % 10;
      const benar = digit === jawabanBenar;
      const kolomData = this.state.kolomData[this.state.kolomKe];
      const waktuSoalMs = Date.now() - this.state.soalMulaiTs;
      kolomData.waktuSoal.push(waktuSoalMs);
      this.state.soalMulaiTs = Date.now();

      if (benar) { this.state.totalBenar++; kolomData.benar++; tambahSkor(true); }
      else {
        this.state.totalSalah++; kolomData.salah++; tambahSkor(false);
        const key = [atas, bawah].sort().join("+");
        if (!this.state.salahDetail[key]) this.state.salahDetail[key] = { a: atas, b: bawah, count: 0 };
        this.state.salahDetail[key].count++;
      }

      const inp = el("pk-kr-input");
      if (inp) inp.style.borderColor = benar ? "var(--c-hijau)" : "var(--c-merah)";
      const mini = el("pk-skor-mini");
      if (mini) mini.textContent = `✅ ${this.state.totalBenar} ❌ ${this.state.totalSalah}`;

      this.state._transisi = true;
      setTimeout(() => { this.state._transisi = false; this._lanjutSoal(); }, benar ? 120 : 280);
    },

    _lanjutSoal() {
      this.state.soalKe++;
      if (this.state.soalKe < this.cfg.baris) { this._tampilSoal(); return; }
      const kolomData = this.state.kolomData[this.state.kolomKe];
      kolomData.selesai = Date.now();
      this.state.kolomKe++;
      if (this.state.kolomKe < this.cfg.kolom) {
        tampilToast(`➡️ Kolom ${this.state.kolomKe + 1}/${this.cfg.kolom}`);
        this._bangunKolomBaru();
        this._tampilSoal();
        return;
      }
      this._tampilSelesai();
    },

    selesaiSekarang() { this._tampilSelesai(true); },

    _mulaiStopwatch() {
      this._hentikanStopwatch();
      this._pkInterval = setInterval(() => {
        const tEl = el("pk-timer");
        if (tEl) tEl.textContent = this._formatWaktu(Math.floor((Date.now() - this.state.mulaiTs) / 1000));
      }, 1000);
    },
    _hentikanStopwatch() { if (this._pkInterval) clearInterval(this._pkInterval); this._pkInterval = null; },
    _formatWaktu(detik) { const m = Math.floor(detik / 60), s = detik % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); },

    _bersihkan() {
      this._hentikanStopwatch();
      if (this._keyHandlerBound) { document.removeEventListener("keydown", this._keyHandlerBound); this._keyHandlerBound = null; }
    },

    // ================================================================
    //  HASIL AKHIR KREPLIN
    // ================================================================
    _tampilSelesai(dipercepat) {
      this._bersihkan();
      const kdSaatIni = this.state.kolomData[this.state.kolomKe];
      if (kdSaatIni && !kdSaatIni.selesai) kdSaatIni.selesai = Date.now();

      const metrik = this._hitungMetrik();
      const saran = this._buatSaran(metrik);
      const totalDikerjakan = this.state.totalBenar + this.state.totalSalah;

      App.catatSesiSelesai("psikotes-kreplin", this.state.totalBenar, totalDikerjakan);

      const waktuAkhirMs = (kdSaatIni && kdSaatIni.selesai) ? kdSaatIni.selesai : Date.now();
      const totalDetik = Math.floor((waktuAkhirMs - this.state.mulaiTs) / 1000);

      el("konten-utama").innerHTML = `
        <div class="selesai-wrap" style="text-align:left">
          <div style="text-align:center">
            <div class="selesai-emoji">${metrik.emoji}</div>
            <h2 style="text-align:center">Tes Kreplin Selesai!</h2>
            ${dipercepat ? `<div class="soal-hint">Diselesaikan lebih awal</div>` : ""}
          </div>
          <div class="selesai-skor" style="text-align:center">
            <div>✅ Benar: <b>${this.state.totalBenar}</b> &nbsp; ❌ Salah: <b>${this.state.totalSalah}</b> &nbsp; (${totalDikerjakan} soal)</div>
            <div class="skor-pct">${metrik.akurasi.toFixed(0)}%</div>
            <div class="soal-hint">⏱️ Total waktu: ${this._formatWaktu(totalDetik)}</div>
          </div>

          <div class="pk-metrik-grid">
            ${this._metrikCard("⚡", "Kecepatan", metrik.kecepatanLabel, metrik.kecepatanPerMenit.toFixed(1) + " soal/menit")}
            ${this._metrikCard("🎯", "Ketelitian", metrik.ketelitianLabel, metrik.ketelitian.toFixed(0) + "%")}
            ${this._metrikCard("📏", "Akurasi", metrik.akurasiLabel, metrik.akurasi.toFixed(0) + "%")}
            ${this._metrikCard("🌊", "Kestabilan", metrik.kestabilanLabel, "variasi " + metrik.cv.toFixed(0) + "%")}
            ${this._metrikCard("🔋", "Ketahanan", metrik.ketahananLabel, metrik.ketahananDelta)}
            ${this._metrikCard("🏆", "Agregat", metrik.agregatLabel, metrik.agregat.toFixed(0) + "/100")}
          </div>

          <div class="pk-card" style="margin-top:14px">
            <h3>💡 Saran &amp; Trik</h3>
            <div class="pk-saran-teks">${saran}</div>
          </div>

          <div class="btn-row" style="justify-content:center;margin-top:16px">
            <button class="btn btn-hijau" onclick="Psikotes.Kreplin._mulai()">🔄 Ulangi</button>
            <button class="btn btn-biru" onclick="Psikotes.Kreplin.bukaSetup()">⚙️ Ganti Ukuran</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Menu Psikotes</button>
          </div>
        </div>
      `;
    },

    _metrikCard(icon, label, ket, val) {
      return `<div class="pk-metrik-card">
        <div class="pk-metrik-icon">${icon}</div>
        <div class="pk-metrik-label">${label}</div>
        <div class="pk-metrik-val">${val}</div>
        <div class="pk-metrik-ket">${ket}</div>
      </div>`;
    },

    _hitungMetrik() {
      const kolomList = this.state.kolomData.filter(k => k.selesai);
      const total = this.state.totalBenar + this.state.totalSalah;
      const akurasi = total ? (this.state.totalBenar / total * 100) : 0;

      const akurasiPerKolom = kolomList.map(k => { const t = k.benar + k.salah; return t ? (k.benar / t * 100) : 0; });
      const ketelitian = akurasiPerKolom.length ? akurasiPerKolom.reduce((a, b) => a + b, 0) / akurasiPerKolom.length : 0;

      const kecepatanPerKolom = kolomList.map(k => {
        const durasiMin = Math.max(0.001, (k.selesai - k.mulai) / 60000);
        return (k.benar + k.salah) / durasiMin;
      });
      const kecepatanPerMenit = kecepatanPerKolom.length ? kecepatanPerKolom.reduce((a, b) => a + b, 0) / kecepatanPerKolom.length : 0;
      const kecepatanLabel = kecepatanPerMenit >= 35 ? "Tinggi" : kecepatanPerMenit >= 20 ? "Sedang" : "Rendah";
      const ketelitianLabel = ketelitian >= 90 ? "Tinggi" : ketelitian >= 75 ? "Sedang" : "Rendah";
      const akurasiLabel = akurasi >= 90 ? "Tinggi" : akurasi >= 75 ? "Sedang" : "Rendah";

      let cv = 0;
      if (kecepatanPerKolom.length > 1) {
        const mean = kecepatanPerMenit;
        const variance = kecepatanPerKolom.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / kecepatanPerKolom.length;
        const sd = Math.sqrt(variance);
        cv = mean ? (sd / mean * 100) : 0;
      }
      const kestabilanLabel = cv <= 15 ? "Tinggi (Stabil)" : cv <= 30 ? "Sedang" : "Rendah (Fluktuatif)";

      let ketahananLabel = "Sedang", ketahananDelta = "-";
      if (kecepatanPerKolom.length >= 2) {
        const mid = Math.ceil(kecepatanPerKolom.length / 2);
        const awal = kecepatanPerKolom.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
        const akhirArr = kecepatanPerKolom.slice(mid);
        const akhir = akhirArr.length ? akhirArr.reduce((a, b) => a + b, 0) / akhirArr.length : awal;
        const rasio = awal ? (akhir / awal) : 1;
        ketahananDelta = (rasio >= 1 ? "+" : "") + Math.round((rasio - 1) * 100) + "% di paruh akhir";
        ketahananLabel = rasio >= 0.95 ? "Tinggi" : rasio >= 0.8 ? "Sedang" : "Rendah";
      }

      const kecepatanScore = Math.min(100, kecepatanPerMenit / 60 * 100);
      const kestabilanScore = Math.max(0, 100 - cv * 2);
      const ketahananScore = ketahananLabel === "Tinggi" ? 100 : ketahananLabel === "Sedang" ? 65 : 30;
      const agregat = kecepatanScore * 0.3 + akurasi * 0.3 + kestabilanScore * 0.2 + ketahananScore * 0.2;
      const agregatLabel = agregat >= 75 ? "Tinggi" : agregat >= 50 ? "Sedang" : "Rendah";
      const emoji = agregat >= 75 ? "🏆" : agregat >= 50 ? "👍" : "💪";

      return { akurasi, ketelitian, kecepatanPerMenit, cv, kecepatanLabel, ketelitianLabel, akurasiLabel, kestabilanLabel, ketahananLabel, ketahananDelta, agregat, agregatLabel, emoji };
    },

    _buatSaran(metrik) {
      const top3 = Object.values(this.state.salahDetail).sort((a, b) => b.count - a.count).slice(0, 3);
      let html = "";
      if (top3.length) {
        html += `<p style="margin-bottom:8px"><b>🔁 Soal (pasangan angka) yang sering salah:</b></p><ul>`;
        top3.forEach(t => {
          html += `<li>${t.a} + ${t.b} = <b>${(t.a + t.b) % 10}</b> (satuan) — salah ${t.count}× — ${this._trikPasangan(t.a, t.b)}</li>`;
        });
        html += `</ul>`;
      }
      const catatan = [];
      if (metrik.kecepatanLabel === "Rendah") catatan.push("⚡ Kecepatan masih rendah — latih penjumlahan reflek 0-9 tiap hari 5-10 menit tanpa mencoret, langsung ketik hasilnya.");
      if (metrik.ketelitianLabel === "Rendah") catatan.push("🎯 Ketelitian perlu ditingkatkan — perlambat sedikit terutama saat kedua angka besar (jumlah ≥10), fokus hanya pada angka satuannya.");
      if (metrik.kestabilanLabel.startsWith("Rendah")) catatan.push("🌊 Ritme kerja naik-turun — coba jaga kecepatan tetap dari kolom awal sampai akhir, jangan ngebut di awal lalu melambat.");
      if (metrik.ketahananLabel === "Rendah") catatan.push("🔋 Performa menurun di kolom-kolom akhir — kemungkinan kelelahan konsentrasi, coba latihan durasi lebih pendek dulu lalu naikkan bertahap.");
      if (!catatan.length) catatan.push("👏 Semua indikator sudah baik! Coba naikkan jumlah kolom atau baris untuk tantangan lebih tinggi.");
      html += `<p><b>📌 Yang perlu ditingkatkan:</b></p><ul>${catatan.map(c => `<li>${c}</li>`).join("")}</ul>`;
      return html;
    },

    _trikPasangan(a, b) {
      if (a === 0 || b === 0) return "salah satu angka 0, jawabannya = angka satunya, tidak perlu dihitung.";
      if (a + b >= 10) return `karena ${a}+${b}≥10, cukup jumlahkan lalu buang angka puluhannya (${a}+${b}=${a + b} → ambil ${(a + b) % 10}).`;
      return `jumlah langsung ${a}+${b}=${a + b}, hafalkan pasangan ini agar makin reflek.`;
    },
  },
};
