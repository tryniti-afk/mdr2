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

  // Instruksi format perhitungan yang dipakai di semua prompt AI (trik, saran, tanya-lanjut)
  // supaya rumus tidak keluar berantakan/ala LaTeX (mis. "$20+10-(20\\times10/10)=30-2)=28\\%$").
  ATURAN_FORMAT_HITUNG: `Kalau perlu menulis perhitungan: JANGAN pakai notasi LaTeX atau simbol seperti $, \\times, \\frac, \\%. Tulis pakai angka & operator biasa saja (+, -, x, :, %), tanda kurung buka-tutup harus selalu seimbang, dan kalau langkahnya lebih dari satu, tulis tiap langkah di baris baru dengan format "Langkah 1: ...", "Langkah 2: ...", jangan digabung jadi satu baris rumus panjang.`,

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
          <div class="sub-card" onclick="Psikotes.GanjilGenap.bukaSetup()">
            <div class="sub-icon">➕</div>
            <div class="sub-label">Tes Cepat Ganjil-Genap</div>
            <div class="sub-desc">Jumlahkan 2 angka, tentukan genap (0) / ganjil (1)</div>
          </div>
          <div class="sub-card" onclick="Psikotes.AI.bukaSetup()">
            <div class="sub-icon">🤖</div>
            <div class="sub-label">Latihan Psikotes AI</div>
            <div class="sub-desc">Soal dibuat AI sesuai kategori pilihanmu</div>
          </div>
        </div>
      </div>
    `;
  },

  _pasangEventMenu() {},

  kembaliMenu() {
    this._hentikanTimerSesi();
    if (this.Kreplin) this.Kreplin._bersihkan();
    if (this.GanjilGenap) this.GanjilGenap._bersihkan();
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

        <div class="pk-card">
          ${renderKontrolLanjut("Psikotes._renderSetupLatihan")}
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
      tampilTombolLanjut("pk-hasil", () => { this.state.sedangTransisi = false; this._advance(); });
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
      tampilTombolLanjut("pk-hasil", () => {
        this.state.sedangTransisi = false;
        if (this.cfg.modeSalah === "ulangSampaiBenar") this._tampilSoalLatihan(true);
        else this._advance();
      });
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
      tampilTombolLanjut("pk-hasil", () => {
        this.state.sedangTransisi = false;
        this.state.queuePtr = Math.max(0, this.state.queuePtr - 2);
        this._simpanLanjut();
        this._tampilSoalLatihan();
      });
    } else {
      if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box salah"; hasilEl.innerText = "❌ Masih salah, coba lagi..."; }
      tampilTombolLanjut("pk-hasil", () => { this.state.sedangTransisi = false; this._tampilSoalLatihan(true); }, "🔁 Coba Lagi");
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
Berikan HANYA 1-2 kalimat singkat berbahasa Indonesia: trik cepat / cara berpikir praktis untuk soal jenis ini tanpa kalkulator, atau analogi sederhana. Jangan mengulang soal atau jawabannya, langsung ke triknya.
${Psikotes.ATURAN_FORMAT_HITUNG}`;
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
Berikan saran singkat (maksimal 4 kalimat, berbahasa Indonesia, dalam bentuk paragraf tanpa list) untuk membantu pengguna berlatih lebih baik, termasuk 1 trik berpikir cepat yang relevan.
${Psikotes.ATURAN_FORMAT_HITUNG}`;
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

  // ================================================================
  //  ============  SUB-MODUL: TES CEPAT GANJIL-GENAP  ==============
  //  Dua angka (satuan/puluhan/ratusan) dijumlahkan, jawab genap (0)
  //  atau ganjil (1). Ada timer & pilihan jumlah soal bebas / sampai
  //  klik "Selesai". Hasil akhir: 5 pasangan tersulit + saran & trik,
  //  plus validasi aturan genap/ganjil.
  // ================================================================
  GanjilGenap: {

    cfg: { waktuMode: "stopwatch", batasMenit: 3, jumlahMode: "selesai", jumlahSoal: 30 },
    state: {},
    _interval: null,
    _keyHandlerBound: null,

    bukaSetup() {
      el("konten-utama").innerHTML = `
        <div class="pk-setup-wrap">
          <div class="pk-card">
            <h3>➕ Tes Cepat Ganjil-Genap</h3>
            <p class="pk-hint">Dua angka acak dijumlahkan (bisa satuan, puluhan, ratusan, sampai ribuan, campur bebas —
            misalnya satuan + ribuan, atau ratusan + ratusan), kamu tentukan hasilnya <b>genap</b> (jawab 0) atau
            <b>ganjil</b> (jawab 1) — tanpa perlu menghitung penuh, cukup cek digit terakhir tiap angka!</p>
          </div>

          <div class="pk-card">
            <h3>⏱️ Pengaturan Waktu</h3>
            <div class="opsi-grup">
              <button class="opsi ${this.cfg.waktuMode === 'none' ? 'aktif' : ''}" onclick="Psikotes.GanjilGenap._pilihWaktu('none')">🚫 Tanpa Waktu</button>
              <button class="opsi ${this.cfg.waktuMode === 'stopwatch' ? 'aktif' : ''}" onclick="Psikotes.GanjilGenap._pilihWaktu('stopwatch')">⏱️ Stopwatch</button>
              <button class="opsi ${this.cfg.waktuMode === 'limit' ? 'aktif' : ''}" onclick="Psikotes.GanjilGenap._pilihWaktu('limit')">⏳ Batas Waktu</button>
            </div>
            <div id="gg-batas-wrap" style="display:${this.cfg.waktuMode === 'limit' ? 'block' : 'none'};margin-top:10px">
              <label style="font-size:13px;color:var(--c-sub)">Batas waktu (menit):</label><br>
              <input type="number" id="gg-batas-menit" class="quiz-select" style="max-width:120px;margin-top:6px" min="1" max="60"
                value="${this.cfg.batasMenit}" onchange="Psikotes.GanjilGenap.cfg.batasMenit = Math.max(1, parseInt(this.value)||3)">
            </div>
          </div>

          <div class="pk-card">
            <h3>🎯 Jumlah Soal</h3>
            <div class="opsi-grup">
              <button class="opsi ${this.cfg.jumlahMode === 'selesai' ? 'aktif' : ''}" onclick="Psikotes.GanjilGenap._pilihJumlahMode('selesai')">✅ Sampai Klik "Selesai"</button>
              <button class="opsi ${this.cfg.jumlahMode === 'tentu' ? 'aktif' : ''}" onclick="Psikotes.GanjilGenap._pilihJumlahMode('tentu')">🔢 Jumlah Tertentu</button>
            </div>
            <div id="gg-jumlah-wrap" style="display:${this.cfg.jumlahMode === 'tentu' ? 'block' : 'none'};margin-top:10px">
              <label style="font-size:13px;color:var(--c-sub)">Berapa soal:</label><br>
              <input type="number" id="gg-jumlah-soal" class="quiz-select" style="max-width:120px;margin-top:6px" min="5" max="500"
                value="${this.cfg.jumlahSoal}" onchange="Psikotes.GanjilGenap.cfg.jumlahSoal = Math.max(5, parseInt(this.value)||30)">
            </div>
          </div>

          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="Psikotes.GanjilGenap._mulai()">▶ Mulai</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
          </div>
        </div>
      `;
    },

    _pilihWaktu(m) { this.cfg.waktuMode = m; this.bukaSetup(); },
    _pilihJumlahMode(m) { this.cfg.jumlahMode = m; this.bukaSetup(); },

    // Angka acak dengan jumlah digit acak (1-4 = satuan/puluhan/ratusan/ribuan),
    // dipanggil terpisah utk tiap angka supaya kombinasinya bisa campur bebas
    // (mis. satuan + ribuan, puluhan + ratusan, ratusan + ratusan, dst).
    _angkaAcak() {
      const digit = 1 + Math.floor(Math.random() * 4); // 1..4
      const lo = digit === 1 ? 0 : Math.pow(10, digit - 1);
      const hi = Math.pow(10, digit) - 1;
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    },

    _mulai() {
      const bEl = el("gg-batas-menit"); if (bEl) this.cfg.batasMenit = Math.max(1, parseInt(bEl.value) || 3);
      const jEl = el("gg-jumlah-soal"); if (jEl) this.cfg.jumlahSoal = Math.max(5, parseInt(jEl.value) || 30);

      resetSkor();
      this.state = {
        soalKe: 0,
        totalBenar: 0, totalSalah: 0,
        mulaiTs: Date.now(),
        deadlineTs: this.cfg.waktuMode === 'limit' ? Date.now() + this.cfg.batasMenit * 60000 : 0,
        waktuHabis: false,
        soalMulaiTs: Date.now(),
        detail: {}, // key "a+b" -> {a,b,jumlah,salah,waktu:[]}
        _transisi: false,
        a: 0, b: 0,
      };
      this._soalBaru();
      this._tampilSoal();
      if (this.cfg.waktuMode !== 'none') this._mulaiTimer();
      this._keyHandlerBound = (e) => this._onKeydown(e);
      document.addEventListener('keydown', this._keyHandlerBound);
    },

    _soalBaru() {
      this.state.a = this._angkaAcak();
      this.state.b = this._angkaAcak();
      this.state.soalMulaiTs = Date.now();
    },

    _mulaiTimer() {
      this._hentikanTimer();
      this._interval = setInterval(() => {
        const t = el("gg-timer"); if (!t) return;
        if (this.cfg.waktuMode === 'stopwatch') {
          t.textContent = this._formatWaktu(Math.floor((Date.now() - this.state.mulaiTs) / 1000));
        } else if (this.cfg.waktuMode === 'limit') {
          const sisaMs = this.state.deadlineTs - Date.now();
          const sisaDetik = Math.max(0, Math.floor(sisaMs / 1000));
          t.textContent = this._formatWaktu(sisaDetik);
          if (sisaMs <= 0) { this.state.waktuHabis = true; this._hentikanTimer(); this._selesai(); }
        }
      }, 1000);
    },
    _hentikanTimer() { if (this._interval) clearInterval(this._interval); this._interval = null; },
    _formatWaktu(detik) { const m = Math.floor(detik / 60), s = detik % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); },

    _tampilSoal() {
      const { a, b, soalKe } = this.state;
      const totalLabel = this.cfg.jumlahMode === 'tentu' ? `Soal ${soalKe + 1}/${this.cfg.jumlahSoal}` : `Soal ke-${soalKe + 1}`;
      const timerAwal = this.cfg.waktuMode === 'limit'
        ? Math.max(0, Math.floor((this.state.deadlineTs - Date.now()) / 1000))
        : Math.floor((Date.now() - this.state.mulaiTs) / 1000);
      el("konten-utama").innerHTML = `
        <div class="soal-wrap">
          <div class="soal-header">
            <span class="progres-teks">${totalLabel}</span>
            <span id="gg-skor-mini">✅ ${this.state.totalBenar} &nbsp;❌ ${this.state.totalSalah}</span>
          </div>
          ${this.cfg.waktuMode !== 'none' ? `<div class="timer-box" id="gg-timer">${this._formatWaktu(timerAwal)}</div>` : ""}
          <div class="pk-gg-soal">
            <div class="pk-gg-num">${a}</div>
            <div class="pk-gg-plus">+</div>
            <div class="pk-gg-num">${b}</div>
          </div>
          <p class="pk-hint" style="text-align:center">Hasil penjumlahannya <b>genap</b> atau <b>ganjil</b>?</p>
          <div class="pk-gg-jawab">
            <button class="pk-gg-btn pk-gg-genap" onclick="Psikotes.GanjilGenap._jawab(0)">GENAP<br><span>(0)</span></button>
            <button class="pk-gg-btn pk-gg-ganjil" onclick="Psikotes.GanjilGenap._jawab(1)">GANJIL<br><span>(1)</span></button>
          </div>
          <div class="btn-row" style="justify-content:center;margin-top:12px">
            <button class="btn btn-abu" onclick="Psikotes.GanjilGenap.selesaiSekarang()">✅ Selesai</button>
          </div>
        </div>
      `;
    },

    _onKeydown(e) {
      if (e.key === '0') this._jawab(0);
      else if (e.key === '1') this._jawab(1);
    },

    _jawab(pilihan) {
      if (this.state._transisi) return;
      const { a, b } = this.state;
      const jumlah = a + b;
      const jawabanBenar = jumlah % 2; // 0 genap, 1 ganjil
      const benar = pilihan === jawabanBenar;
      const waktuMs = Date.now() - this.state.soalMulaiTs;

      const key = [a, b].sort((x, y) => x - y).join('+');
      if (!this.state.detail[key]) this.state.detail[key] = { a, b, jumlah, salah: 0, waktu: [] };
      this.state.detail[key].waktu.push(waktuMs);

      if (benar) { this.state.totalBenar++; tambahSkor(true); }
      else { this.state.totalSalah++; tambahSkor(false); this.state.detail[key].salah++; }

      const wrap = document.querySelector('.pk-gg-soal');
      if (wrap) wrap.style.borderColor = benar ? 'var(--c-hijau)' : 'var(--c-merah)';
      const mini = el("gg-skor-mini");
      if (mini) mini.textContent = `✅ ${this.state.totalBenar} ❌ ${this.state.totalSalah}`;

      this.state._transisi = true;
      setTimeout(() => {
        this.state._transisi = false;
        this.state.soalKe++;
        if (this.cfg.jumlahMode === 'tentu' && this.state.soalKe >= this.cfg.jumlahSoal) { this._selesai(); return; }
        this._soalBaru();
        this._tampilSoal();
      }, benar ? 150 : 350);
    },

    selesaiSekarang() { this._selesai(true); },

    _bersihkan() {
      this._hentikanTimer();
      if (this._keyHandlerBound) { document.removeEventListener('keydown', this._keyHandlerBound); this._keyHandlerBound = null; }
    },

    // ================================================================
    //  HASIL AKHIR GANJIL-GENAP
    // ================================================================
    _selesai(dipercepat) {
      this._bersihkan();
      const total = this.state.totalBenar + this.state.totalSalah;
      const pct = total ? Math.round(this.state.totalBenar / total * 100) : 0;
      const emoji = pct >= 85 ? '🏆' : pct >= 65 ? '👍' : '💪';
      const totalDetik = Math.floor((Date.now() - this.state.mulaiTs) / 1000);
      App.catatSesiSelesai('psikotes-ganjilgenap', this.state.totalBenar, total);

      const daftar = Object.values(this.state.detail).map(d => {
        const avgWaktu = d.waktu.reduce((s, v) => s + v, 0) / d.waktu.length;
        return { ...d, avgWaktu, dicoba: d.waktu.length };
      }).filter(d => d.dicoba > 0);
      // Rangking: yang paling sering salah didahulukan, lalu yang paling lama dikerjakan.
      const top5 = daftar.sort((x, y) => (y.salah - x.salah) || (y.avgWaktu - x.avgWaktu)).slice(0, 5);
      const rataWaktu = daftar.length ? daftar.reduce((s, d) => s + d.avgWaktu, 0) / daftar.length : 0;

      el("konten-utama").innerHTML = `
        <div class="selesai-wrap" style="text-align:left">
          <div style="text-align:center">
            <div class="selesai-emoji">${emoji}</div>
            <h2 style="text-align:center">Tes Ganjil-Genap Selesai!</h2>
            ${dipercepat ? '<div class="soal-hint">Diselesaikan lebih awal</div>' : ''}
            ${this.state.waktuHabis ? '<div class="soal-hint">⏰ Waktu habis</div>' : ''}
          </div>
          <div class="selesai-skor" style="text-align:center">
            <div>✅ Benar: <b>${this.state.totalBenar}</b> &nbsp; ❌ Salah: <b>${this.state.totalSalah}</b> &nbsp; (${total} soal)</div>
            <div class="skor-pct">${pct}%</div>
            <div class="soal-hint">⏱️ Waktu: ${this._formatWaktu(totalDetik)} · ⚡ Rata-rata ${(rataWaktu / 1000).toFixed(1)} dtk/soal</div>
          </div>

          ${top5.length ? `
          <div class="pk-card" style="margin-top:14px">
            <h3>🔁 5 Pasangan Angka Tersulit</h3>
            <ul style="margin:6px 0 0 18px;padding:0;font-size:13.5px">
              ${top5.map(t => `<li style="margin-bottom:8px">
                <b>${t.a} + ${t.b} = ${t.jumlah}</b> (${t.jumlah % 2 === 0 ? 'genap' : 'ganjil'})
                ${t.salah > 0 ? ` — ❌ salah ${t.salah}×` : ''} · ⏱️ rata-rata ${(t.avgWaktu / 1000).toFixed(1)} dtk
                <br><span style="color:var(--c-sub)">💡 ${pkEsc(this._trik(t.a, t.b))}</span>
              </li>`).join('')}
            </ul>
          </div>` : ''}

          <div class="pk-card" style="margin-top:14px">
            <h3>💡 Saran &amp; Validasi Aturan Ganjil-Genap</h3>
            <div class="pk-saran-teks">${this._buatSaran(pct)}</div>
          </div>

          <div class="btn-row" style="justify-content:center;margin-top:16px">
            <button class="btn btn-hijau" onclick="Psikotes.GanjilGenap._mulai()">🔄 Ulangi</button>
            <button class="btn btn-biru" onclick="Psikotes.GanjilGenap.bukaSetup()">⚙️ Ganti Pengaturan</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Menu Psikotes</button>
          </div>
        </div>
      `;
    },

    _trik(a, b) {
      const pa = a % 2 === 0 ? 'genap' : 'ganjil';
      const pb = b % 2 === 0 ? 'genap' : 'ganjil';
      const hasil = (a + b) % 2 === 0 ? 'genap' : 'ganjil';
      return `${a} digit terakhirnya ${a % 10} (${pa}), ${b} digit terakhirnya ${b % 10} (${pb}) → ${pa}+${pb} = ${hasil}. Tidak perlu menjumlahkan seluruh angka, cukup lihat digit paling belakang saja.`;
    },

    // Validasi matematis: paritas jumlah 2 bilangan hanya ditentukan oleh
    // paritas digit terakhirnya, jadi aturan di bawah ini SELALU benar.
    _buatSaran(pct) {
      let html = `<p>Aturan ganjil-genap berikut <b>selalu berlaku pasti</b> dan sudah tervalidasi secara matematis (paritas jumlah dua bilangan hanya bergantung pada paritas digit terakhirnya):</p>
        <ul>
          <li>Genap + Genap = <b>Genap</b></li>
          <li>Genap + Ganjil = <b>Ganjil</b></li>
          <li>Ganjil + Ganjil = <b>Genap</b></li>
          <li>Ganjil + Genap = <b>Ganjil</b></li>
        </ul>
        <p>Karena itu, kamu tidak perlu menjumlahkan angka puluhan/ratusan secara penuh — cukup lihat <b>digit satuan</b> (paling belakang) dari kedua angka, tentukan genap/ganjilnya masing-masing, lalu cocokkan ke tabel di atas. Jauh lebih cepat, terutama untuk angka ratusan.</p>`;
      if (pct < 70) html += `<p>🎯 Akurasi masih ${pct}% — perlambat sedikit dan biasakan pola: <i>lihat digit terakhir → tentukan genap/ganjil masing-masing → gunakan tabel aturan</i>, tanpa menjumlahkan penuh.</p>`;
      else if (pct < 90) html += `<p>👍 Akurasi ${pct}% sudah cukup baik. Tingkatkan kecepatan dengan sering berlatih level puluhan/ratusan agar makin reflek mengenali digit terakhir.</p>`;
      else html += `<p>🏆 Akurasi ${pct}% sangat baik! Coba naikkan level ke Ratusan atau kurangi batas waktu untuk tantangan lebih tinggi.</p>`;
      return html;
    },
  },

  // ================================================================
  //  ================  SUB-MODUL: LATIHAN PSIKOTES AI  ==============
  //  Soal dibuat AI (mirip soal psikotes yang umum beredar) lengkap
  //  dengan pilihan jawaban, berdasarkan kategori yang dipilih/dicari
  //  atau ditulis sendiri. Jumlah soal bebas atau sampai klik Selesai.
  //  Mode jika salah: Lanjut Terus / Muncul Lagi di Akhir Sesi /
  //  Ulang Sampai Benar (lalu mundur 2 soal, replay soal sebelumnya).
  //  Saat salah tampil trik cepat (AI, fallback lokal). Hasil akhir:
  //  5 soal tersering salah + saran & trik dari AI.
  // ================================================================
  AI: {

    KATEGORI_PRESET: [
      "Deret Angka", "Deret Huruf", "Aritmatika Dasar", "Analogi Verbal (Padanan Kata)",
      "Sinonim (Persamaan Kata)", "Antonim (Lawan Kata)", "Logika Penalaran (Silogisme)",
      "Logika Matematika", "Pemahaman Bacaan Singkat", "Perbandingan Kuantitatif",
      "Kemampuan Numerik Cepat", "Klasifikasi / Pengelompokan Kata",
    ],

    cfg: {
      kategori: [],        // kategori terpilih
      kategoriCustom: [],  // kategori tambahan buatan sendiri
      jumlahMode: "tentu", // "tentu" | "selesai"
      jumlahSoal: 10,
      modeSalah: "lanjut", // "lanjut" | "review" | "ulangSampaiBenar"
    },

    state: {},
    _cariTeks: "",

    bukaSetup() {
      if (!this.cfg.kategori.length && !this.cfg.kategoriCustom.length) {
        this.cfg.kategori = [this.KATEGORI_PRESET[0]];
      }
      this._cariTeks = "";
      this._render();
    },

    _daftarKategori() { return [...this.KATEGORI_PRESET, ...this.cfg.kategoriCustom]; },

    _render() {
      const filterTeks = (this._cariTeks || "").toLowerCase();
      const list = this._daftarKategori().filter(k => !filterTeks || k.toLowerCase().includes(filterTeks));
      const kategoriHtml = list.map(k => {
        const aktif = this.cfg.kategori.includes(k) ? 'aktif' : '';
        return `<button class="opsi aktif-ungu ${aktif}" onclick="Psikotes.AI._toggleKategori('${k.replace(/'/g, "\\'")}')">${pkEsc(k)}</button>`;
      }).join("") || `<p class="pk-hint">Tidak ada kategori cocok pencarian "${pkEsc(this._cariTeks)}".</p>`;

      el("konten-utama").innerHTML = `
        <div class="pk-setup-wrap">
          <div class="pk-card">
            <h3>🤖 Latihan Psikotes dari AI</h3>
            <p class="pk-hint">Soal dibuat otomatis oleh AI, mengikuti gaya soal psikotes yang umum beredar (seleksi kerja/CPNS/TPA), lengkap dengan pilihan jawabannya.</p>
          </div>

          <div class="pk-card">
            <h3>📂 Kategori Soal</h3>
            <input type="text" class="input-teks" placeholder="🔍 Cari kategori..." value="${pkEsc(this._cariTeks)}"
              oninput="Psikotes.AI._cariTeks=this.value; Psikotes.AI._render();" style="margin-bottom:10px;width:100%">
            <div class="opsi-grup">${kategoriHtml}</div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <input type="text" id="ai-kategori-baru" class="input-teks" placeholder="Tulis kategori sendiri..." style="flex:1">
              <button class="btn btn-biru" style="white-space:nowrap" onclick="Psikotes.AI._tambahKategoriCustom()">➕ Tambah</button>
            </div>
            <p class="pk-hint">📊 ${this.cfg.kategori.length} kategori dipilih.</p>
          </div>

          <div class="pk-card">
            <h3>🎯 Jumlah Soal</h3>
            <div class="opsi-grup">
              <button class="opsi ${this.cfg.jumlahMode === 'tentu' ? 'aktif' : ''}" onclick="Psikotes.AI._pilihJumlahMode('tentu')">🔢 Jumlah Tertentu</button>
              <button class="opsi ${this.cfg.jumlahMode === 'selesai' ? 'aktif' : ''}" onclick="Psikotes.AI._pilihJumlahMode('selesai')">✅ Sampai Klik "Selesai"</button>
            </div>
            <div id="ai-jumlah-wrap" style="display:${this.cfg.jumlahMode === 'tentu' ? 'block' : 'none'};margin-top:10px">
              <label style="font-size:13px;color:var(--c-sub)">Berapa soal:</label><br>
              <input type="number" id="ai-jumlah-soal" class="quiz-select" style="max-width:120px;margin-top:6px" min="3" max="100"
                value="${this.cfg.jumlahSoal}" onchange="Psikotes.AI.cfg.jumlahSoal = Math.max(3, parseInt(this.value)||10)">
            </div>
          </div>

          <div class="pk-card">
            <h3>🎮 Mode Jika Salah</h3>
            <div class="opsi-grup" style="flex-direction:column;align-items:stretch">
              <button class="opsi aktif-hijau ${this.cfg.modeSalah === 'lanjut' ? 'aktif' : ''}" onclick="Psikotes.AI._pilihModeSalah('lanjut')">➡️ Lanjut Terus — tampil jawaban benar + trik, lalu lanjut ke soal berikutnya</button>
              <button class="opsi aktif-kuning ${this.cfg.modeSalah === 'review' ? 'aktif' : ''}" onclick="Psikotes.AI._pilihModeSalah('review')">🔁 Muncul Lagi di Akhir Sesi — soal yang salah diulang setelah sesi utama selesai</button>
              <button class="opsi aktif-merah ${this.cfg.modeSalah === 'ulangSampaiBenar' ? 'aktif' : ''}" onclick="Psikotes.AI._pilihModeSalah('ulangSampaiBenar')">🔂 Ulang Sampai Benar — jawab ulang soal yang sama sampai benar, lalu mundur 2 soal</button>
            </div>
            ${renderKontrolLanjut("Psikotes.AI._render")}
          </div>

          <p class="pk-hint" style="text-align:center">⚠️ Fitur ini butuh Gemini API key (sama seperti fitur AI lain di aplikasi ini).</p>

          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="Psikotes.AI._mulai()">▶ Mulai Latihan AI</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Kembali</button>
          </div>
        </div>
      `;
    },

    _toggleKategori(k) {
      const pos = this.cfg.kategori.indexOf(k);
      if (pos === -1) this.cfg.kategori.push(k); else this.cfg.kategori.splice(pos, 1);
      this._render();
    },
    _tambahKategoriCustom() {
      const inp = el("ai-kategori-baru");
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) return;
      if (!this._daftarKategori().some(k => k.toLowerCase() === v.toLowerCase())) this.cfg.kategoriCustom.push(v);
      if (!this.cfg.kategori.includes(v)) this.cfg.kategori.push(v);
      this._cariTeks = "";
      this._render();
    },
    _pilihJumlahMode(m) { this.cfg.jumlahMode = m; this._render(); },
    _pilihModeSalah(m) { this.cfg.modeSalah = m; this._render(); },

    // ================================================================
    //  MULAI SESI
    // ================================================================
    async _mulai() {
      const jEl = el("ai-jumlah-soal"); if (jEl) this.cfg.jumlahSoal = Math.max(3, parseInt(jEl.value) || 10);
      if (!this.cfg.kategori.length) { tampilToast('⚠️ Pilih atau tambahkan minimal 1 kategori dulu!'); return; }
      if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) {
        const k = prompt("Masukkan Gemini API key (dipakai juga oleh fitur AI lain):");
        if (k) GeminiAPI.setKey(k); else { tampilToast("⚠️ Perlu API key Gemini untuk fitur ini."); return; }
      }

      resetSkor();
      this.state = {
        soalKe: 0,
        totalBenar: 0, totalSalah: 0,
        mulaiTs: Date.now(),
        history: [],       // soal "normal" yang sudah selesai dijawab, urut
        replayQueue: [],   // antrean soal utk ditampilkan lagi (mundur-2 / tinjauan akhir)
        wrongLog: {},       // key kategori|pertanyaan -> {soal, count}
        reviewDone: false,
        soalMode: "normal", // "normal" | "retry" | "review"
        soalSaatIni: null,
      };
      this._nextSoal();
    },

    _kunciSoal(soal) { return (soal.kategori || '') + '|' + (soal.pertanyaan || ''); },

    async _nextSoal() {
      // 1) layani antrean replay dulu (tinjauan akhir / mundur-2)
      if (this.state.replayQueue.length) {
        this.state.soalMode = "review";
        this.state.soalSaatIni = this.state.replayQueue.shift();
        this._tampilSoal();
        return;
      }
      // 2) cek target tercapai
      const target = this.cfg.jumlahMode === 'tentu' ? this.cfg.jumlahSoal : Infinity;
      if (this.state.soalKe >= target) {
        if (this.cfg.modeSalah === 'review' && !this.state.reviewDone && Object.keys(this.state.wrongLog).length) {
          this.state.reviewDone = true;
          this.state.replayQueue = Object.values(this.state.wrongLog).map(w => w.soal);
          tampilToast(`🔁 Meninjau ${this.state.replayQueue.length} soal yang tadi salah...`);
          this._nextSoal();
          return;
        }
        this._selesai();
        return;
      }
      // 3) generate soal baru via AI
      this.state.soalMode = "normal";
      setHTML("konten-utama", `<div class="soal-wrap"><div class="soal-header"><span class="progres-teks">Menyiapkan soal...</span></div><div class="pk-card" style="text-align:center;padding:24px">⏳ AI sedang membuat soal psikotes...</div></div>`);
      const kategoriPilih = this.cfg.kategori[Math.floor(Math.random() * this.cfg.kategori.length)];
      try {
        const soal = await this._generateSoal(kategoriPilih);
        this.state.soalSaatIni = soal;
        this._tampilSoal();
      } catch (e) {
        tampilToast('❌ Gagal membuat soal: ' + e.message);
        this._selesai();
      }
    },

    async _generateSoal(kategori) {
      const prompt = `Kamu pembuat soal tes psikotes/tes potensi akademik yang umum beredar di Indonesia (mirip soal seleksi kerja/CPNS/TPA).
Buatkan 1 soal psikotes ORIGINAL dengan kategori: "${kategori}".
Soal harus pilihan ganda, 4-5 pilihan jawaban, hanya 1 jawaban benar, berbahasa Indonesia, jelas & tidak ambigu, tanpa perlu gambar (hanya teks/angka).
Balas HANYA JSON valid tanpa markdown, format:
{
  "kategori": "${kategori.replace(/"/g, '\\"')}",
  "pertanyaan": "...",
  "pilihan": ["...","...","...","..."],
  "jawabanIdx": 0
}`;
      const data = await GeminiAPI.callJSON(prompt, 600);
      if (!data || !data.pertanyaan || !Array.isArray(data.pilihan) || data.pilihan.length < 2) throw new Error('Format soal dari AI tidak valid');
      if (typeof data.jawabanIdx !== 'number' || data.jawabanIdx < 0 || data.jawabanIdx >= data.pilihan.length) data.jawabanIdx = 0;
      data.kategori = data.kategori || kategori;
      return data;
    },

    _tampilSoal() {
      const soal = this.state.soalSaatIni;
      const target = this.cfg.jumlahMode === 'tentu' ? `Soal ${Math.min(this.state.soalKe + 1, this.cfg.jumlahSoal)}/${this.cfg.jumlahSoal}` : `Soal ke-${this.state.soalKe + 1}`;
      const labelMode = this.state.soalMode === 'review' ? '🔁 Tinjau Ulang · ' : this.state.soalMode === 'retry' ? '🔂 Ulangi Sampai Benar · ' : '';
      el("konten-utama").innerHTML = `
        <div class="soal-wrap">
          <div class="soal-header">
            <span class="progres-teks">${labelMode}${target}</span>
            <span id="ai-skor-mini">✅ ${this.state.totalBenar} &nbsp;❌ ${this.state.totalSalah}</span>
          </div>
          <div class="quiz-label-row"><span class="quiz-chip quiz-chip-ungu">${pkEsc(soal.kategori)}</span></div>
          <div class="quiz-soal-box">${pkEsc(soal.pertanyaan)}</div>
          <div id="ai-pilihan-wrap" class="sub-menu-grid" style="grid-template-columns:1fr"></div>
          <div id="ai-hasil" class="hasil-box" style="display:none"></div>
          <div class="btn-row" style="margin-top:14px;justify-content:center">
            <button class="btn btn-abu" onclick="Psikotes.AI.selesaiSekarang()">✅ Selesai</button>
          </div>
        </div>
      `;
      const wrap = el("ai-pilihan-wrap");
      soal.pilihan.forEach((p, i) => {
        const b = document.createElement('button');
        b.className = 'btn-pilihan'; b.style.textAlign = 'left'; b.innerText = p;
        b.onclick = () => this._pilihJawaban(wrap, soal, i);
        wrap.appendChild(b);
      });
    },

    _pilihJawaban(container, soal, idxPilihan) {
      if (this.state._transisi) return;
      const benar = idxPilihan === soal.jawabanIdx;
      highlightPilihan(container, soal.jawabanIdx, idxPilihan);
      const hasilEl = el('ai-hasil');
      this.state._transisi = true;
      const modeSaatIni = this.state.soalMode;

      if (benar) {
        tambahSkor(true); this.state.totalBenar++;
        if (hasilEl) { hasilEl.style.display = 'block'; hasilEl.className = 'hasil-box benar'; hasilEl.innerText = modeSaatIni === 'retry' ? '✅ Benar! Mundur 2 soal untuk pengulangan...' : '✅ Benar!'; }
        tampilTombolLanjut('ai-hasil', () => {
          this.state._transisi = false;
          if (modeSaatIni === 'retry') {
            const key = this._kunciSoal(soal);
            delete this.state.wrongLog[key];
            const dua = this.state.history.slice(-2);
            this.state.replayQueue = [...dua, ...this.state.replayQueue];
          }
          if (modeSaatIni !== 'review') { this.state.history.push(soal); this.state.soalKe++; }
          this._nextSoal();
        });
      } else {
        tambahSkor(false); this.state.totalSalah++;
        const key = this._kunciSoal(soal);
        if (!this.state.wrongLog[key]) this.state.wrongLog[key] = { soal, count: 0 };
        this.state.wrongLog[key].count++;
        if (hasilEl) {
          hasilEl.style.display = 'block'; hasilEl.className = 'hasil-box salah';
          hasilEl.innerHTML = `❌ Salah! Jawaban benar: <b>${pkEsc(soal.pilihan[soal.jawabanIdx])}</b><br><span id="ai-trik-loading">⏳ Mencari trik cepat...</span>`;
        }
        this._tampilkanTrik(soal);
        if (this.cfg.modeSalah === 'ulangSampaiBenar' && modeSaatIni !== 'review') {
          tampilTombolLanjut('ai-hasil', () => {
            this.state._transisi = false;
            this.state.soalMode = 'retry';
            this.state.soalSaatIni = soal;
            this._tampilSoal();
          }, '🔁 Coba Lagi');
        } else {
          tampilTombolLanjut('ai-hasil', () => {
            this.state._transisi = false;
            if (modeSaatIni !== 'review') { this.state.history.push(soal); this.state.soalKe++; }
            this._nextSoal();
          });
        }
      }
    },

    async _tampilkanTrik(soal) {
      const target = el('ai-trik-loading');
      if (!target) return;
      let teks;
      try {
        if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) throw new Error('no-key');
        const prompt = `Kamu tutor psikotes. Soal: "${soal.pertanyaan}" (kategori: "${soal.kategori}"). Pilihan: ${soal.pilihan.join(' | ')}. Jawaban benar: "${soal.pilihan[soal.jawabanIdx]}".
Berikan HANYA 1-2 kalimat trik cepat berbahasa Indonesia: cara berpikir sederhana tanpa kalkulator/hitungan rumit, langsung ke inti, atau analogi logis yang mudah dipahami. Jangan mengulang soal atau jawabannya.
${Psikotes.ATURAN_FORMAT_HITUNG}`;
        teks = await GeminiAPI.call(prompt, 220);
      } catch (e) {
        teks = Psikotes._localTrik({ kategori: soal.kategori, jawaban: soal.pilihan[soal.jawabanIdx] });
      }
      this.state.trikKonteks = { soal, teks };
      const el2 = el('ai-trik-loading');
      if (el2) el2.outerHTML = `<span>💡 <b>Trik:</b> ${typeof GeminiAPI !== 'undefined' ? GeminiAPI.esc2(teks) : pkEsc(teks)}</span>` + this._kotakTanya('trik');
    },

    // ================================================================
    //  TANYA AI LANJUTAN (dipakai utk kotak trik & kotak saran akhir)
    //  idPrefix: 'trik' | 'saran'
    // ================================================================
    _kotakTanya(idPrefix) {
      return `
        <div class="sv-tanya-box" style="margin-top:10px;padding:8px 10px;background:rgba(33,150,243,.08);border-radius:8px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:var(--c-biru)">❓ Masih bingung? Tanya AI</div>
          <div style="display:flex;gap:6px">
            <input type="text" id="ai-${idPrefix}-tanya-input" placeholder="Misal: maksud langkah keduanya gimana?"
              style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--c-border);border-radius:6px;font-size:13px;outline:none;background:var(--c-card);color:var(--c-text)"
              onkeydown="if(event.key==='Enter')Psikotes.AI._tanyaLanjut('${idPrefix}')">
            <button class="btn btn-biru" style="padding:7px 14px;white-space:nowrap" onclick="Psikotes.AI._tanyaLanjut('${idPrefix}')">Tanya</button>
          </div>
          <div id="ai-${idPrefix}-tanya-hasil" style="font-size:12.5px;margin-top:6px;color:var(--c-sub)"></div>
        </div>`;
    },

    async _tanyaLanjut(idPrefix) {
      const inp = el(`ai-${idPrefix}-tanya-input`);
      const teks = inp ? inp.value.trim() : "";
      if (!teks) return;
      const hasilEl = el(`ai-${idPrefix}-tanya-hasil`);
      if (hasilEl) hasilEl.innerHTML = "⏳ Mencari jawaban...";
      if (inp) inp.disabled = true;

      try {
        if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) throw new Error('Perlu API key Gemini dulu.');
        let konteks;
        if (idPrefix === 'trik' && this.state.trikKonteks) {
          const { soal, teks: trikTeks } = this.state.trikKonteks;
          konteks = `Soal psikotes: "${soal.pertanyaan}" (kategori: "${soal.kategori}"). Pilihan: ${soal.pilihan.join(' | ')}. Jawaban benar: "${soal.pilihan[soal.jawabanIdx]}".
Trik cepat yang sudah diberikan sebelumnya: "${trikTeks}"`;
        } else if (idPrefix === 'saran' && this.state.saranKonteks) {
          konteks = `Ringkasan hasil latihan psikotes pengguna (skor ${this.state.saranKonteks.pct}%). Saran yang sudah diberikan sebelumnya: "${this.state.saranKonteks.teks}"`;
        } else {
          konteks = "Konteks latihan psikotes sebelumnya.";
        }
        const prompt = `Kamu tutor psikotes yang ramah. ${konteks}
Siswa masih bingung dan bertanya lebih lanjut: "${teks}"
Jawab dengan jelas, singkat (maksimal 3-4 kalimat), berbahasa Indonesia, dengan cara berpikir sederhana/analogi yang mudah dipahami tanpa kalkulator.
${Psikotes.ATURAN_FORMAT_HITUNG}`;
        const jawaban = await GeminiAPI.call(prompt, 300);
        if (hasilEl) hasilEl.innerHTML = `<div style="margin-bottom:3px"><b>❓ ${pkEsc(teks)}</b></div><div>💡 ${GeminiAPI.esc2(jawaban.trim())}</div>`;
      } catch (e) {
        if (hasilEl) hasilEl.innerHTML = "❌ " + e.message;
      }
      if (inp) { inp.disabled = false; inp.value = ""; inp.focus(); }
    },

    selesaiSekarang() { this._selesai(true); },

    // ================================================================
    //  HASIL AKHIR PSIKOTES AI
    // ================================================================
    _selesai(dipercepat) {
      const total = this.state.totalBenar + this.state.totalSalah;
      const pct = total ? Math.round(this.state.totalBenar / total * 100) : 0;
      const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪';
      const elapsedDetik = Math.floor((Date.now() - this.state.mulaiTs) / 1000);
      App.catatSesiSelesai('psikotes-ai', this.state.totalBenar, total);

      const top5 = Object.values(this.state.wrongLog).sort((a, b) => b.count - a.count).slice(0, 5);

      el("konten-utama").innerHTML = `
        <div class="selesai-wrap" style="text-align:left">
          <div style="text-align:center">
            <div class="selesai-emoji">${emoji}</div>
            <h2 style="text-align:center">Latihan Psikotes AI Selesai!</h2>
            ${dipercepat ? '<div class="soal-hint">Diselesaikan lebih awal</div>' : ''}
          </div>
          <div class="selesai-skor" style="text-align:center">
            <div>✅ Benar: <b>${this.state.totalBenar}</b> &nbsp; ❌ Salah: <b>${this.state.totalSalah}</b></div>
            <div class="skor-pct">${pct}%</div>
            <div class="soal-hint">⏱️ Waktu: ${Psikotes._formatWaktu(elapsedDetik)}</div>
          </div>

          ${top5.length ? `
          <div class="pk-card" style="margin-top:14px">
            <h3>🔁 5 Soal yang Sering Salah</h3>
            <ul style="margin:6px 0 0 18px;padding:0;font-size:13.5px">
              ${top5.map(d => `<li style="margin-bottom:8px">
                <span class="quiz-chip quiz-chip-ungu" style="font-size:10.5px">${pkEsc(d.soal.kategori)}</span><br>
                <b>${pkEsc(d.soal.pertanyaan)}</b><br>
                Jawaban benar: <span style="color:var(--c-hijau-d);font-weight:700">${pkEsc(d.soal.pilihan[d.soal.jawabanIdx])}</span>
                ${d.count > 1 ? ` (salah ${d.count}×)` : ''}
              </li>`).join('')}
            </ul>
          </div>` : ''}

          <div class="pk-card" style="margin-top:14px">
            <h3>💡 Saran &amp; Trik Cepat</h3>
            <div id="ai-saran-akhir" class="pk-saran-teks">⏳ Menyiapkan saran...</div>
          </div>

          <div class="btn-row" style="justify-content:center;margin-top:16px">
            <button class="btn btn-hijau" onclick="Psikotes.AI.bukaSetup()">🔄 Latihan Lagi</button>
            <button class="btn btn-abu" onclick="Psikotes.kembaliMenu()">← Menu Psikotes</button>
          </div>
        </div>
      `;
      this._isiSaranAkhir(pct, top5);
    },

    async _isiSaranAkhir(pct, top5) {
      const target = el('ai-saran-akhir');
      if (!target) return;
      let teks;
      try {
        if (typeof GeminiAPI === "undefined" || !GeminiAPI.getKey()) throw new Error('no-key');
        const daftarTeks = top5.slice(0, 3).map(d => `- [${d.soal.kategori}] ${d.soal.pertanyaan}`).join('\n');
        const prompt = `Pengguna baru saja latihan soal psikotes buatan AI dan mendapat skor ${pct}%.
${daftarTeks ? 'Beberapa soal yang sering salah:\n' + daftarTeks : 'Tidak ada catatan soal yang salah.'}
Berikan saran singkat (maksimal 4 kalimat, berbahasa Indonesia, dalam bentuk paragraf tanpa list) untuk membantu berlatih kategori-kategori tersebut lebih baik, sertakan 1 trik berpikir cepat & analogi sederhana yang relevan agar bisa menjawab tanpa perhitungan rumit.
${Psikotes.ATURAN_FORMAT_HITUNG}`;
        teks = await GeminiAPI.call(prompt, 350);
      } catch (e) {
        teks = pct >= 80
          ? 'Hasil kamu sudah bagus! Coba tantang diri dengan kategori yang belum dicoba, atau kurangi waktu berpikir per soal supaya makin reflek.'
          : 'Fokus pelajari pola soal dari kategori yang paling sering salah dulu — kenali polanya lewat beberapa contoh, baru coba jawab cepat tanpa mikir rumus panjang. Baca soal sekali dengan teliti, garis bawahi kata kunci, lalu eliminasi dulu pilihan yang jelas salah sebelum memutuskan.';
      }
      this.state.saranKonteks = { pct, teks };
      target.innerHTML = (typeof GeminiAPI !== 'undefined' ? GeminiAPI.esc2(teks) : pkEsc(teks).replace(/\n/g, '<br>')) + this._kotakTanya('saran');
    },
  },
};
