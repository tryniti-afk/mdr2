// ================================================================
//  QUIZ.JS — Modul Kuis Universal (Gabungan fitur mdr-lama)
//  Fitur:
//    • Pilih set soal: Spreadsheet (multi-sheet) atau Lokal
//    • Cara soal: Dibacakan (TTS) atau Teks saja
//    • Cara jawab: Suara (STT) | Ketik | Pinyin Keyboard
//    • Mode: 1× Sekali | 🔢 Putaran | ♾ Infinity (ulangi jika salah)
//    • Tombol: Jawab, Ulangi (soal dibacakan), Skip, Selesai
//    • Edit Soal Lokal (format Pertanyaan | kunci || info)
// ================================================================

var Quiz = {

  // ── STATE ──────────────────────────────────────────────────
  cfg: { soal: "suara", jawab: "suara", mode: "jumlah", jumlah: 10, offset: 0 },
  state: { nomor: 0, skor: 0, salah: 0, streak: 0, ulangiSoal: -1, putaran: 1, maxPutaran: 1 },
  daftarSoal: [],
  ulangiCb: null,

  // ── SOAL LOKAL DEFAULT ─────────────────────────────────────
  soalLokal: [
    { pertanyaan: "Warna darah?", kunci: "merah/darah || warna merah" },
    { pertanyaan: "Cara mematikan api kompor?", kunci: "(mati/matikan)+kompor || sampai api tidak ada" },
    { pertanyaan: "爱情 artinya apa?", kunci: "cinta || àiqíng" },
  ],

  // ── SHEET CONFIG ────────────────────────────────────────────
  SHEET_ID: "1QozIKvWjISQmFK15mvjk9maH3FfDENGhmrIRS5BoHiE",
  SHEETS: ["Uji", "Uji2"],  // nama sheet yang tersedia di spreadsheet

  // ================================================================
  //  RENDER MENU UTAMA QUIZ
  // ================================================================
  renderMenu() {
    return `
      <div class="quiz-setup-wrap">

        <!-- PILIH SET SOAL -->
        <div class="card">
          <h3>📋 Pilih Set Soal</h3>
          <select id="quiz-pilih-sheet" onchange="Quiz._onGantiSheet()" class="quiz-select">
            ${this.SHEETS.map(s => `<option value="${s}">${s} (Spreadsheet)</option>`).join("")}
            <option value="lokal">Soal Lokal (Edit Manual)</option>
          </select>
          <p id="quiz-status-sheet" class="quiz-status"></p>
        </div>

        <!-- CARA SOAL DITAMPILKAN -->
        <div class="card">
          <h3>🔊 Cara Soal Ditampilkan</h3>
          <div class="opsi-grup">
            <button class="opsi ${this.cfg.soal==='suara'?'aktif':''}" id="qopsi-soal-suara"
              onclick="Quiz._pilihOpsi('soal','suara')">🔊 Dibacakan</button>
            <button class="opsi ${this.cfg.soal==='teks'?'aktif':''}" id="qopsi-soal-teks"
              onclick="Quiz._pilihOpsi('soal','teks')">📄 Teks Saja</button>
          </div>
        </div>

        <!-- MODE PERMAINAN -->
        <div class="card">
          <h3>🎮 Mode Permainan</h3>
          <div class="opsi-grup">
            <button class="opsi aktif-ungu ${this.cfg.mode==='jumlah'?'aktif':''}" id="qopsi-mode-jumlah"
              onclick="Quiz._pilihOpsi('mode','jumlah')">🔢 N Soal</button>
            <button class="opsi aktif-ungu ${this.cfg.mode==='infinity'?'aktif':''}" id="qopsi-mode-infinity"
              onclick="Quiz._pilihOpsi('mode','infinity')">♾ Semua Soal</button>
          </div>
          <div id="quiz-input-jumlah" style="display:${this.cfg.mode==='jumlah'?'block':'none'};margin-top:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <label style="font-size:13px;color:#555">Jumlah soal:</label>
              <input type="number" id="quiz-jml-soal" min="1" value="${this.cfg.jumlah||10}"
                class="input-jawab" style="max-width:100px"
                onchange="Quiz._onGantiJumlah()">
            </div>
            <div id="quiz-range-wrap" style="display:none">
              <div style="font-size:13px;color:#555;margin-bottom:6px">📌 Pilih soal ke:</div>
              <div class="opsi-grup" id="quiz-range-btns" style="flex-wrap:wrap"></div>
            </div>
          </div>
          <div id="quiz-info-infinity" class="quiz-info-box"
            style="display:${this.cfg.mode==='infinity'?'block':'none'}">
            <b>Semua Soal:</b> Semua soal dimainkan berurutan. Jika salah harus mengulang sampai benar, lalu soal kembali ke awal.
          </div>
        </div>

        <!-- CARA MENJAWAB -->
        <div class="card">
          <h3>🎙️ Cara Menjawab</h3>
          <div class="opsi-grup">
            <button class="opsi aktif-hijau ${this.cfg.jawab==='suara'?'aktif':''}" id="qopsi-jawab-suara"
              onclick="Quiz._pilihOpsi('jawab','suara')">🎙️ Suara</button>
            <button class="opsi aktif-hijau ${this.cfg.jawab==='ketik'?'aktif':''}" id="qopsi-jawab-ketik"
              onclick="Quiz._pilihOpsi('jawab','ketik')">⌨️ Ketik</button>
            <button class="opsi aktif-hijau ${this.cfg.jawab==='pinyin'?'aktif':''}" id="qopsi-jawab-pinyin"
              onclick="Quiz._pilihOpsi('jawab','pinyin')">🀄 Pinyin</button>
          </div>
          <div id="quiz-info-pinyin" class="quiz-info-box quiz-info-oren"
            style="display:${this.cfg.jawab==='pinyin'?'block':'none'}">
            <b>Mode Pinyin:</b> Keyboard khusus dengan vokal bernada untuk menjawab dalam Pinyin.
          </div>
        </div>

        <!-- TOMBOL AKSI -->
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Quiz._mulai()">▶ Mulai Kuis</button>
          <button class="btn btn-abu" onclick="Quiz._showEditor()">✏️ Edit Soal Lokal</button>
        </div>

      </div>
    `;
  },

  // ── PASANG EVENT setelah render menu ────────────────────────
  _pasangEventMenu() {
    setTimeout(() => this._onGantiSheet(), 100);
  },

  // ================================================================
  //  GANTI SHEET
  // ================================================================
  async _onGantiSheet() {
    const sel = el("quiz-pilih-sheet");
    if (!sel) return;
    const sheet = sel.value;
    const statusEl = el("quiz-status-sheet");
    if (!statusEl) return;
    if (sheet === "lokal") {
      statusEl.textContent = `📝 Menggunakan ${this.soalLokal.length} soal lokal.`;
      this._totalSoal = this.soalLokal.length;
      this._renderRangeBtns();
      return;
    }
    statusEl.textContent = "⏳ Mencoba mengambil data dari spreadsheet...";
    const data = await this._fetchSheet(sheet);
    if (data && data.length > 0) {
      statusEl.innerHTML = `✅ Berhasil memuat <b>${data.length}</b> soal dari sheet <b>${sheet}</b>.`;
      this._totalSoal = data.length;
    } else {
      statusEl.innerHTML = `⚠️ Gagal ambil spreadsheet. Akan pakai data fallback.`;
      this._totalSoal = this.soalLokal.length;
    }
    this._renderRangeBtns();
  },

  _onGantiJumlah() {
    const inp = el("quiz-jml-soal");
    if (inp) {
      this.cfg.jumlah = Math.max(1, parseInt(inp.value) || 10);
      this.cfg.offset = 0;
      this._renderRangeBtns();
    }
  },

  _renderRangeBtns() {
    if (this.cfg.mode !== "jumlah") return;
    const total    = this._totalSoal || 0;
    const jumlah   = this.cfg.jumlah || 10;
    const wrapEl   = el("quiz-range-wrap");
    const btnsEl   = el("quiz-range-btns");
    if (!wrapEl || !btnsEl) return;
    if (!total || jumlah >= total) {
      wrapEl.style.display = "none";
      this.cfg.offset = 0;
      return;
    }
    wrapEl.style.display = "block";
    let html = "";
    for (let start = 0; start < total; start += jumlah) {
      const end   = Math.min(start + jumlah, total);
      const aktif = this.cfg.offset === start ? "aktif" : "";
      html += `<button class="opsi aktif-ungu ${aktif}" id="quiz-range-${start}"
        onclick="Quiz._pilihRange(${start})">${start+1}–${end}</button>`;
    }
    btnsEl.innerHTML = html;
    if (this.cfg.offset >= total) this.cfg.offset = 0;
  },

  _pilihRange(offset) {
    this.cfg.offset = offset;
    document.querySelectorAll("[id^='quiz-range-']").forEach(b => b.classList.remove("aktif"));
    const btn = el("quiz-range-" + offset);
    if (btn) btn.classList.add("aktif");
  },

  async _fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return this._parseCSV(await res.text());
    } catch(e) { return null; }
  },

  _parseCSV(teks) {
    return teks.trim().split("\n").slice(1).map(b => {
      const col = b.split(",").map(s => s.replace(/^"|"$/g, "").trim());
      return (col.length >= 2 && col[0]) ? { pertanyaan: col[0], kunci: col[1] } : null;
    }).filter(Boolean);
  },

  // ================================================================
  //  PILIH OPSI (soal / jawab / mode)
  // ================================================================
  _pilihOpsi(grup, nilai) {
    this.cfg[grup] = nilai;
    // Reset semua tombol dalam grup
    document.querySelectorAll(`[id^="qopsi-${grup}-"]`).forEach(b => {
      b.classList.remove("aktif");
    });
    const target = el(`qopsi-${grup}-${nilai}`);
    if (target) target.classList.add("aktif");

    if (grup === "mode") {
      const inp = el("quiz-input-jumlah");
      const inf = el("quiz-info-infinity");
      if (inp) inp.style.display = nilai === "jumlah" ? "block" : "none";
      if (inf) inf.style.display = nilai === "infinity" ? "block" : "none";
      if (nilai === "jumlah") Quiz._renderRangeBtns();
    }
    if (grup === "jawab") {
      const pinInfo = el("quiz-info-pinyin");
      if (pinInfo) pinInfo.style.display = nilai === "pinyin" ? "block" : "none";
    }
  },

  // ================================================================
  //  MULAI KUIS
  // ================================================================
  async _mulai() {
    const sel = el("quiz-pilih-sheet");
    const sheet = sel ? sel.value : "lokal";

    let rawSoal;
    if (sheet === "lokal") {
      rawSoal = [...this.soalLokal];
    } else {
      const data = await this._fetchSheet(sheet);
      rawSoal = (data && data.length > 0) ? data : this.soalLokal;
    }

    // Potong soal sesuai mode
    if (this.cfg.mode === "jumlah") {
      const offset = this.cfg.offset || 0;
      const jumlah = this.cfg.jumlah || 10;
      this.daftarSoal = rawSoal.slice(offset, offset + jumlah);
    } else {
      // infinity: semua soal, urutan asli
      this.daftarSoal = rawSoal.slice();
    }

    if (!this.daftarSoal.length) {
      tampilToast("Tidak ada soal!");
      return;
    }

    this.state = {
      nomor: 0, skor: 0, salah: 0, streak: 0, ulangiSoal: -1, putaran: 1,
      maxPutaran: 1, sheet: sheet
    };
    this._infinityRetry  = false;
    this.ulangiCb = null;
    this._sedangTransisi = false;
    resetSkor();

    // Render halaman kuis
    el("konten-utama").innerHTML = this._htmlKuis();
    this._tampilSoal();
  },

  // ================================================================
  //  HTML TEMPLATE KUIS
  // ================================================================
  _htmlKuis() {
    return `
      <div class="soal-wrap" id="quiz-area">

        <!-- PROGRESS -->
        <div class="soal-header">
          <div class="progres-teks" id="quiz-nomor">Soal 1 / ?</div>
          <div class="skor-mini" id="quiz-skor-mini">✅ 0  ❌ 0</div>
        </div>
        <div class="progres-bar">
          <div class="progres-fill" id="quiz-progress" style="width:0%"></div>
        </div>

        <!-- INFO SHEET & MODE -->
        <div class="quiz-label-row">
          <span class="quiz-chip" id="quiz-label-sheet"></span>
          <span class="quiz-chip quiz-chip-ungu" id="quiz-label-mode"></span>
        </div>

        <!-- SOAL -->
        <div class="quiz-soal-box" id="quiz-soal"></div>

        <!-- HASIL -->
        <div class="hasil-box" id="quiz-hasil" style="display:none"></div>

        <!-- STREAK -->
        <div class="quiz-streak" id="quiz-streak"></div>

        <!-- INPUT KETIK -->
        <input type="text" class="input-jawab" id="quiz-input" style="display:none"
          placeholder="Ketik jawaban...">

        <!-- KEYBOARD PINYIN -->
        <div id="quiz-kb-cont" style="display:none">
          <div id="kb-pinyin-cont"></div>
        </div>

        <!-- TOMBOL -->
        <div class="btn-row" id="quiz-btn-row">
          <button class="btn btn-biru"   id="quiz-btn-jawab"  onclick="Quiz._aksiJawab()">🎤 Jawab</button>
          <button class="btn btn-abu"    id="quiz-btn-ulangi" onclick="Quiz._ulangiSoal()" style="display:none">🔄 Ulangi</button>
          <button class="btn btn-kuning" id="quiz-btn-skip"   onclick="Quiz._skipSoal()">⏭ Skip</button>
          <button class="btn btn-merah"  id="quiz-btn-selesai" onclick="Quiz._selesai()">⏹ Selesai</button>
        </div>

      </div>
    `;
  },

  // ================================================================
  //  TAMPIL SOAL
  // ================================================================
  _tampilSoal() {
    this.ulangiCb = null;
    this._sedangTransisi = false;
    const soalObj = this.daftarSoal[this.state.nomor];
    const total   = this.daftarSoal.length;

    // Header
    const nomorTeks = `Soal ${this.state.nomor + 1} dari ${total}` +
      (this.cfg.mode === "bebas" ? ` | Putaran ${this.state.putaran}/${this.state.maxPutaran}` : "");
    setTeks("quiz-nomor", nomorTeks);
    setTeks("quiz-label-sheet", "📋 " + (this.state.sheet || "lokal"));
    setTeks("quiz-label-mode",
      this.cfg.mode === "jumlah" ? `🔢 ${this.daftarSoal.length} Soal` : "♾ Semua Soal");
    const progress = el("quiz-progress");
    if (progress) progress.style.width = ((this.state.nomor / total) * 100) + "%";

    // Soal
    setTeks("quiz-soal", (this.state.ulangiSoal >= 0 ? "🔄 Ulangi: " : "") + soalObj.pertanyaan);

    // Reset hasil & streak
    const hasilEl = el("quiz-hasil");
    if (hasilEl) { hasilEl.style.display = "none"; hasilEl.className = "hasil-box"; hasilEl.innerText = ""; }
    setTeks("quiz-streak", this.state.streak > 1 ? `🔥 Streak: ${this.state.streak}` : "");
    this._updateSkorMini();

    // Kontrol input
    const inputEl  = el("quiz-input");
    const kbEl     = el("quiz-kb-cont");
    const btnJawab = el("quiz-btn-jawab");
    const btnUlangi= el("quiz-btn-ulangi");
    const btnSkip  = el("quiz-btn-skip");

    if (inputEl)  inputEl.style.display  = "none";
    if (kbEl)     kbEl.style.display     = "none";
    if (btnJawab) {
      btnJawab.style.display = "inline-block";
      btnJawab.disabled      = true;
      btnJawab.innerText     = "🎤 Jawab";
      btnJawab.onclick       = () => this._aksiJawab();
    }
    if (btnSkip) btnSkip.style.display = "inline-block";
    if (btnUlangi) btnUlangi.style.display = this.cfg.soal === "suara" ? "inline-block" : "none";

    if (this.cfg.jawab === "ketik") {
      if (inputEl) {
        inputEl.style.display = "block";
        inputEl.value = "";
        inputEl.focus();
        inputEl.onkeydown = (e) => { if (e.key === "Enter") this._submitJawaban(); };
      }
      if (btnJawab) { btnJawab.innerText = "✅ Submit"; btnJawab.disabled = false; btnJawab.onclick = () => this._submitJawaban(); }

    } else if (this.cfg.jawab === "pinyin") {
      if (kbEl) kbEl.style.display = "block";
      if (btnJawab) btnJawab.style.display = "none";
      setTimeout(() => {
        buildKbPinyin("kb-display", null);
        // Pasang tombol submit ke keyboard
        const kbPinCont = el("kb-pinyin-cont");
        if (kbPinCont) {
          const actSec = kbPinCont.querySelector(".kb-section:last-child");
          if (actSec) {
            const submitBtn = document.createElement("button");
            submitBtn.className = "kb-btn spesial";
            submitBtn.style.background = "var(--c-hijau)";
            submitBtn.style.color = "#fff";
            submitBtn.innerText = "✅ Submit";
            submitBtn.onclick = () => this._submitJawaban();
            actSec.appendChild(submitBtn);
          }
        }
      }, 50);

    } else {
      // Suara: tombol jawab aktif setelah TTS selesai (atau langsung jika teks)
      if (this.cfg.soal === "teks" && btnJawab) btnJawab.disabled = false;
    }

    // Bacakan / teks
    if (this.cfg.soal === "suara") {
      this._bacakanSoal(soalObj.pertanyaan);
    } else {
      const hint =
        this.cfg.jawab === "suara"  ? "Tekan 🎤 Jawab lalu bicara." :
        this.cfg.jawab === "pinyin" ? "Ketik jawaban dengan keyboard Pinyin lalu Submit." :
        "Ketik jawaban dan tekan Enter atau Submit.";
      if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box info"; hasilEl.innerText = hint; }
    }
  },

  // ================================================================
  //  BACAKAN SOAL
  // ================================================================
  _bacakanSoal(teks) {
    const btnJawab = el("quiz-btn-jawab");
    if (this.cfg.jawab === "suara" && btnJawab) btnJawab.disabled = true;
    const hasilEl = el("quiz-hasil");
    if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box info"; hasilEl.innerText = "⏳ Membacakan soal..."; }

    TTS.bicara(teks, null, 0.9, () => {
      const hint =
        this.cfg.jawab === "suara"  ? "Tekan 🎤 Jawab lalu bicara." :
        this.cfg.jawab === "pinyin" ? "Ketik jawaban dengan keyboard Pinyin lalu Submit." :
        "Ketik jawaban dan tekan Enter atau Submit.";
      if (hasilEl) { hasilEl.innerText = hint; }
      if (this.cfg.jawab === "suara" && btnJawab) btnJawab.disabled = false;
    });
  },

  _ulangiSoal() {
    if (this.cfg.soal === "suara") {
      const soalObj = this.daftarSoal[this.state.nomor];
      this._bacakanSoal(soalObj.pertanyaan);
    }
  },

  // ================================================================
  //  AKSI JAWAB (dispatcher)
  // ================================================================
  _aksiJawab() {
    if (this.cfg.jawab === "suara") this._dengarJawaban();
    else this._submitJawaban();
  },

  // ================================================================
  //  JAWAB SUARA
  // ================================================================
  _dengarJawaban() {
    const btnJawab = el("quiz-btn-jawab");
    if (btnJawab) btnJawab.disabled = true;
    TTS.berhenti();
    const hasilEl = el("quiz-hasil");
    if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box info"; hasilEl.innerText = "🎙️ Silakan bicara..."; }

    const soalObj = this.daftarSoal[this.state.nomor];
    STT.mulai(
      deteksiBahasa(soalObj.pertanyaan),
      (hasil) => {
        if (this.ulangiCb) this.ulangiCb(hasil);
        else this._prosesJawaban(hasil);
      },
      (err) => {
        if (hasilEl) hasilEl.innerText = "❌ Error mic: " + err + ". Gunakan Chrome.";
        if (btnJawab) btnJawab.disabled = false;
      },
      (dapat) => {
        if (btnJawab) btnJawab.disabled = false;
        if (!dapat && hasilEl) hasilEl.innerText = "⚠️ Tidak ada suara terdeteksi. Coba bicara lebih dekat.";
      }
    );
  },

  // ================================================================
  //  SUBMIT KETIK / PINYIN
  // ================================================================
  _submitJawaban() {
    let jawaban = "";
    if (this.cfg.jawab === "pinyin") {
      jawaban = getKbTeks().toLowerCase();
    } else {
      const inp = el("quiz-input");
      jawaban = inp ? inp.value.trim().toLowerCase() : "";
    }
    if (!jawaban) return;
    if (this.ulangiCb) this.ulangiCb(jawaban);
    else this._prosesJawaban(jawaban);
  },

  // ================================================================
  //  PROSES JAWABAN
  // ================================================================
  _prosesJawaban(jawaban) {
    if (this._sedangTransisi) return;   // ← abaikan input saat transisi
    const soalObj = this.daftarSoal[this.state.nomor];
    const full    = soalObj.kunci || "";
    const parts   = full.split("||");
    const aturan  = (parts[0] || "").trim();
    const tambahan= (parts[1] || "").trim();

    const benar = cekJawaban(jawaban, aturan);
    tambahSkor(benar);

    const hasilEl = el("quiz-hasil");
    if (hasilEl) {
      hasilEl.style.display = "block";
      hasilEl.className = "hasil-box " + (benar ? "benar" : "salah");
      hasilEl.innerText =
        (benar ? `✅ Benar! "${jawaban}"` : `❌ Salah! Kamu: "${jawaban}"\nJawaban: ${aturan}`) +
        (tambahan ? `\n📌 Info: ${tambahan}` : "");
    }

    if (benar) {
      this.state.skor++;
      this.state.streak++;
      this.state.ulangiSoal = -1;
      setTeks("quiz-streak", this.state.streak > 1 ? `🔥 Streak: ${this.state.streak}` : "");
      this._updateSkorMini();
      setTimeout(() => this._lanjut(), 1800);

    } else {
      this.state.salah++;
      this.state.streak = 0;
      setTeks("quiz-streak", "");
      this._updateSkorMini();

      if (this.cfg.mode === "infinity" || this.cfg.mode === "jumlah") {
        this.state.ulangiSoal = this.state.nomor;
        setTimeout(() => {
          if (hasilEl) hasilEl.innerText += "\n\n🔄 Jawab ulang soal ini dulu...";
          setTimeout(() => this._tampilUlangi(), 1500);
        }, 1500);
      } else {
        setTimeout(() => this._lanjut(), 2200);
      }
    }
  },

  // ================================================================
  //  MODE INFINITY — ULANGI SOAL
  // ================================================================
  _tampilUlangi() {
    const soalObj = this.daftarSoal[this.state.nomor];
    const full    = soalObj.kunci || "";
    const parts   = full.split("||");
    const aturan  = (parts[0] || "").trim();
    const tambahan= (parts[1] || "").trim();

    const hasilEl = el("quiz-hasil");
    if (hasilEl) { hasilEl.style.display = "block"; hasilEl.className = "hasil-box info"; hasilEl.innerText = "Jawab lagi dengan benar."; }

    if (this.cfg.jawab === "pinyin") resetKb();
    if (this.cfg.jawab === "ketik") {
      const inp = el("quiz-input");
      if (inp) { inp.value = ""; inp.focus(); }
    }
    const btnJawab = el("quiz-btn-jawab");
    if (btnJawab) btnJawab.disabled = false;

    this.ulangiCb = (jawaban) => {
      const benar = cekJawaban(jawaban, aturan);
      if (hasilEl) {
        hasilEl.className = "hasil-box " + (benar ? "benar" : "salah");
        hasilEl.innerText = benar
          ? `✅ Benar! Kembali ke soal 1...${tambahan ? "\n📌 Info: " + tambahan : ""}`
          : `❌ Masih salah!\nJawaban: ${aturan}${tambahan ? "\n📌 Info: " + tambahan : ""}\nCoba lagi...`;
      }
      if (benar) {
        this.state.ulangiSoal = -1;
        this.ulangiCb = null;
        this._sedangTransisi = true;          // ← blokir input baru
        TTS.berhenti();
        STT.berhenti();
        setTimeout(() => {
          this._sedangTransisi = false;
          this.state.nomor = 0;
          this.state.streak = 0;
          this._tampilSoal();
        }, 1800);
      } else {
        setTimeout(() => this._tampilUlangi(), 2000);
      }
    };
  },

  // ================================================================
  //  SKIP SOAL (dihitung benar)
  // ================================================================
  _skipSoal() {
    TTS.berhenti();
    STT.berhenti();
    const soalObj = this.daftarSoal[this.state.nomor];
    const full    = soalObj.kunci || "";
    const parts   = full.split("||");
    const aturan  = (parts[0] || "").trim();
    const tambahan= (parts[1] || "").trim();

    this.state.skor++;
    this.state.streak++;
    this.state.ulangiSoal = -1;
    this.ulangiCb = null;
    tambahSkor(true);

    const hasilEl = el("quiz-hasil");
    if (hasilEl) {
      hasilEl.style.display = "block";
      hasilEl.className = "hasil-box benar";
      hasilEl.innerText = `⏭ Di-skip! (dihitung benar)\nJawaban: ${aturan}` +
        (tambahan ? `\n📌 Info: ${tambahan}` : "");
    }
    setTeks("quiz-streak", this.state.streak > 1 ? `🔥 Streak: ${this.state.streak}` : "");
    const btnSkip = el("quiz-btn-skip");
    if (btnSkip) btnSkip.style.display = "none";
    const btnJawab = el("quiz-btn-jawab");
    if (btnJawab) btnJawab.disabled = true;
    this._updateSkorMini();
    setTimeout(() => this._lanjut(), 1800);
  },

  // ================================================================
  //  LANJUT / SELESAI
  // ================================================================
  _lanjut() {
    this.state.nomor++;
    const total = this.daftarSoal.length;

    if (this.state.nomor >= total) {
      // Semua soal sudah selesai → tampil selesai (untuk kedua mode)
      this._tampilSelesai();
    } else {
      this._tampilSoal();
    }
  },

  _tampilSelesai() {
    TTS.berhenti();
    const total = this.state.skor + this.state.salah;
    const pct   = total ? Math.round((this.state.skor / total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";

    App.catatSesiSelesai("quiz", this.state.skor, total);

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Kuis Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${this.state.skor}</b></div>
          <div>❌ Salah: <b>${this.state.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="Quiz._ulangSesi()">🔄 Main Lagi</button>
          <button class="btn btn-biru"  onclick="Quiz.kembaliMenu()">← Menu Kuis</button>
        </div>
      </div>
    `;
  },

  _ulangSesi() {
    el("konten-utama").innerHTML = this._htmlKuis();
    this.state.nomor = 0;
    this.state.skor = 0;
    this.state.salah = 0;
    this.state.streak = 0;
    this.state.putaran = 1;
    this.state.ulangiSoal = -1;
    this.ulangiCb = null;
    this._infinityRetry  = false;
    this._sedangTransisi = false;
    resetSkor();
    this._tampilSoal();
  },

  _selesai() {
    TTS.berhenti();
    STT.berhenti();
    this.ulangiCb = null;
    this.kembaliMenu();
  },

  _updateSkorMini() {
    setHTML("quiz-skor-mini", `✅ ${sesiSkor.benar} &nbsp;❌ ${sesiSkor.salah}`);
  },

  // ================================================================
  //  EDITOR SOAL LOKAL
  // ================================================================
  _showEditor() {
    el("konten-utama").innerHTML = `
      <div class="card">
        <h3>✏️ Edit Soal Lokal</h3>
        <p style="font-size:13px;color:#666;margin-bottom:10px">
          Format tiap baris: <code>Pertanyaan | kata kunci jawaban</code><br>
          <span style="color:#999">Soal bisa dalam bahasa apapun, akan dibaca otomatis.</span><br><br>
          <b>Format Kunci Jawaban:</b><br>
          <code>merah/darah</code> = OR (cukup salah satu)<br>
          <code>mati+kompor</code> = AND (wajib semua)<br>
          <code>(mati/matikan)+kompor</code> = OR dalam AND<br>
          <code>... || info tambahan</code> = info tidak wajib dijawab
        </p>
        <textarea id="quiz-editor-input" rows="12" class="input-jawab"
          style="font-family:monospace;font-size:13px"
          placeholder="Contoh:&#10;Warna darah? | merah/darah || warna merah&#10;Cara mematikan api? | (mati/matikan)+kompor&#10;爱情 | àiqíng || cinta">${this.soalLokal.map(s => `${s.pertanyaan} | ${s.kunci}`).join("\n")}</textarea>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn-hijau" onclick="Quiz._simpanSoalLokal()">💾 Simpan</button>
          <button class="btn btn-abu"   onclick="Quiz.kembaliMenu()">← Kembali</button>
        </div>
        <p id="quiz-pesan-simpan" style="margin-top:10px;font-size:14px"></p>
      </div>
    `;
  },

  _simpanSoalLokal() {
    const val = el("quiz-editor-input");
    if (!val) return;
    const baru = val.value.trim().split("\n").map(b => {
      const bg = b.split("|");
      return (bg.length >= 2 && bg[0].trim())
        ? { pertanyaan: bg[0].trim(), kunci: bg.slice(1).join("|").trim() }
        : null;
    }).filter(Boolean);

    const pesanEl = el("quiz-pesan-simpan");
    if (!baru.length) {
      if (pesanEl) { pesanEl.style.color = "red"; pesanEl.innerText = "⚠️ Format salah. Gunakan: Pertanyaan | jawaban"; }
      return;
    }
    this.soalLokal = baru;
    if (pesanEl) { pesanEl.style.color = "green"; pesanEl.innerText = `✅ ${baru.length} soal disimpan!`; }
    setTimeout(() => this.kembaliMenu(), 1200);
  },

  // ================================================================
  //  KEMBALI KE MENU KUIS
  // ================================================================
  kembaliMenu() {
    TTS.berhenti();
    STT.berhenti();
    App.renderModul("quiz");
    setTimeout(() => this._pasangEventMenu(), 50);
  },
};
 
