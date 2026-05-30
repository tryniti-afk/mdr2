// ================================================================
//  SETSOAL.JS — UI Pemilih Set Soal & Mode Permainan
//  Komponen reusable untuk semua modul
//  Cara pakai:
//    SetSoal.render(tipe, onMulai)  → kembalikan HTML string
//    SetSoal.pasangEvent(tipe, onMulai)  → pasang event setelah render
// ================================================================

var SetSoal = {

  // state saat ini
  _cfg: {},   // key: tipe → { sheet, mode, jumlah }

  get(tipe) {
    if (!this._cfg[tipe]) {
      this._cfg[tipe] = { sheet: DataMgr.sheetsUntuk(tipe)[0]?.id || "lokal", mode: "sekali", jumlah: 10 };
    }
    return this._cfg[tipe];
  },

  // ── RENDER HTML widget ───────────────────────────────────────
  renderWidget(tipe, idPrefix) {
    const cfg   = this.get(tipe);
    const sheets = DataMgr.sheetsUntuk(tipe);
    const pfx   = idPrefix || ("ss-" + tipe);

    return `
      <div class="ss-widget" id="${pfx}-widget">

        <!-- PILIH SET SOAL -->
        <div class="ss-section">
          <div class="ss-label">📋 Set Soal</div>
          <div class="ss-opsi-row">
            ${sheets.map(s => `
              <button class="ss-btn ${cfg.sheet === s.id ? 'aktif' : ''}"
                id="${pfx}-sheet-${s.id}"
                onclick="SetSoal._pilihSheet('${tipe}','${s.id}','${pfx}')">
                ${s.label}
              </button>
            `).join("")}
            <button class="ss-btn ${cfg.sheet === 'lokal' ? 'aktif' : ''}"
              id="${pfx}-sheet-lokal"
              onclick="SetSoal._pilihSheet('${tipe}','lokal','${pfx}')">
              📝 Lokal
            </button>
          </div>
          <div class="ss-status" id="${pfx}-status"></div>
        </div>

        <!-- MODE PERMAINAN -->
        <div class="ss-section">
          <div class="ss-label">🎮 Mode</div>
          <div class="ss-opsi-row">
            <button class="ss-btn ${cfg.mode === 'sekali' ? 'aktif' : ''}"
              id="${pfx}-mode-sekali"
              onclick="SetSoal._pilihMode('${tipe}','sekali','${pfx}')">
              1× Sekali
            </button>
            <button class="ss-btn ${cfg.mode === 'jumlah' ? 'aktif' : ''}"
              id="${pfx}-mode-jumlah"
              onclick="SetSoal._pilihMode('${tipe}','jumlah','${pfx}')">
              🔢 N Soal
            </button>
            <button class="ss-btn ${cfg.mode === 'infinity' ? 'aktif' : ''}"
              id="${pfx}-mode-infinity"
              onclick="SetSoal._pilihMode('${tipe}','infinity','${pfx}')">
              ♾ Infinity
            </button>
          </div>
          <div id="${pfx}-mode-extra" style="margin-top:8px;display:${cfg.mode === 'jumlah' ? 'flex' : 'none'};align-items:center;gap:8px">
            <label style="font-size:13px;color:#555">Jumlah soal:</label>
            <input type="number" id="${pfx}-jumlah" min="1" max="999" value="${cfg.jumlah}"
              class="ss-input-num"
              onchange="SetSoal._pilihJumlah('${tipe}','${pfx}')">
          </div>
          <div id="${pfx}-info-infinity" class="ss-info-box"
            style="display:${cfg.mode === 'infinity' ? 'block' : 'none'}">
            Jika salah, ulangi soal itu dulu — lalu kembali ke soal pertama.
          </div>
        </div>

        <!-- EDIT SOAL LOKAL -->
        <div id="${pfx}-editor-wrap" style="display:${cfg.sheet === 'lokal' ? 'block' : 'none'}">
          <div class="ss-section">
            <div class="ss-label">✏️ Soal Lokal
              <button class="ss-btn-sm" onclick="SetSoal._toggleEditor('${tipe}','${pfx}')">Edit</button>
            </div>
            <div id="${pfx}-editor-area" style="display:none">
              ${tipe === 'vocab' ? `
              <p class="ss-fmt-hint">Format: <code>Pertanyaan | kunci/jawaban || terjemahan</code><br>
              Misal: <code>高兴 | 高兴/gāoxìng || senang</code><br>
              <code>/</code>=OR, <code>+</code>=AND, <code>(a/b)+c</code>=OR dalam AND</p>
              ` : `
              <p class="ss-fmt-hint">Format: <code>Kalimat Hanzi | terjemahan/kunci || catatan</code><br>
              Misal: <code>她在看书。 | Dia sedang membaca/tā zài kàn shū</code></p>
              `}
              <textarea id="${pfx}-textarea" rows="8" class="input-jawab"
                style="font-family:monospace;font-size:12px;width:100%;box-sizing:border-box"
                placeholder="Masukkan soal...">${DataMgr.toEditTeks(tipe)}</textarea>
              <div class="btn-row" style="margin-top:8px">
                <button class="btn btn-hijau" onclick="SetSoal._simpanLokal('${tipe}','${pfx}')">💾 Simpan</button>
                <button class="btn btn-abu" onclick="SetSoal._tutupEditor('${pfx}')">Tutup</button>
              </div>
              <p id="${pfx}-simpan-msg" style="font-size:13px;margin-top:6px"></p>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  // ── PILIH SHEET ──────────────────────────────────────────────
  _pilihSheet(tipe, sheetId, pfx) {
    this.get(tipe).sheet = sheetId;
    const widget = document.getElementById(pfx + "-widget");
    if (widget) {
      widget.querySelectorAll("[id^='" + pfx + "-sheet-']").forEach(b => b.classList.remove("aktif"));
      const btn = document.getElementById(pfx + "-sheet-" + sheetId);
      if (btn) btn.classList.add("aktif");
    }
    const edWrap = document.getElementById(pfx + "-editor-wrap");
    if (edWrap) edWrap.style.display = (sheetId === "lokal") ? "block" : "none";

    // Cek status sheet
    if (sheetId !== "lokal") {
      const statusEl = document.getElementById(pfx + "-status");
      if (statusEl) statusEl.textContent = "⏳ Mengambil data...";
      DataMgr.fetchSheet(sheetId).then(data => {
        if (statusEl) {
          statusEl.innerHTML = data && data.length
            ? `✅ ${data.length} soal ditemukan`
            : `⚠️ Gagal ambil data, akan pakai soal lokal`;
        }
      });
    } else {
      const statusEl = document.getElementById(pfx + "-status");
      if (statusEl) statusEl.textContent = `📝 ${(DataMgr._lokal[tipe] || []).length} soal lokal`;
    }
  },

  // ── PILIH MODE ───────────────────────────────────────────────
  _pilihMode(tipe, mode, pfx) {
    this.get(tipe).mode = mode;
    const widget = document.getElementById(pfx + "-widget");
    if (widget) {
      widget.querySelectorAll("[id^='" + pfx + "-mode-']").forEach(b => b.classList.remove("aktif"));
      const btn = document.getElementById(pfx + "-mode-" + mode);
      if (btn) btn.classList.add("aktif");
    }
    const extraEl = document.getElementById(pfx + "-mode-extra");
    const infEl   = document.getElementById(pfx + "-info-infinity");
    if (extraEl) extraEl.style.display = mode === "jumlah" ? "flex" : "none";
    if (infEl)   infEl.style.display   = mode === "infinity" ? "block" : "none";
  },

  _pilihJumlah(tipe, pfx) {
    const inp = document.getElementById(pfx + "-jumlah");
    if (inp) this.get(tipe).jumlah = Math.max(1, parseInt(inp.value) || 10);
  },

  // ── EDITOR ──────────────────────────────────────────────────
  _toggleEditor(tipe, pfx) {
    const area = document.getElementById(pfx + "-editor-area");
    if (!area) return;
    area.style.display = area.style.display === "none" ? "block" : "none";
    if (area.style.display === "block") {
      const ta = document.getElementById(pfx + "-textarea");
      if (ta) ta.value = DataMgr.toEditTeks(tipe);
    }
  },
  _tutupEditor(pfx) {
    const area = document.getElementById(pfx + "-editor-area");
    if (area) area.style.display = "none";
  },
  _simpanLokal(tipe, pfx) {
    const ta  = document.getElementById(pfx + "-textarea");
    const msg = document.getElementById(pfx + "-simpan-msg");
    if (!ta) return;
    const n = DataMgr.simpanLokal(tipe, ta.value);
    if (n > 0) {
      if (msg) { msg.style.color = "green"; msg.textContent = `✅ ${n} soal disimpan!`; }
      setTimeout(() => this._tutupEditor(pfx), 1200);
      const statusEl = document.getElementById(pfx + "-status");
      if (statusEl && this.get(tipe).sheet === "lokal") statusEl.textContent = `📝 ${n} soal lokal`;
    } else {
      if (msg) { msg.style.color = "red"; msg.textContent = "⚠️ Format salah. Gunakan: Pertanyaan | jawaban"; }
    }
  },

  // ── AMBIL SOAL SIAP PAKAI (async) ────────────────────────────
  async getSoalSiap(tipe, subMode) {
    const cfg  = this.get(tipe);
    const raw  = await DataMgr.ambilSoal(cfg.sheet, tipe);
    if (!raw || !raw.length) return [];

    // Konversi ke format internal sesuai tipe
    if (tipe === "vocab") {
      return this._konversiVocab(raw);
    } else {
      return this._konversiSentence(raw, subMode);
    }
  },

  // ── KONVERSI DATA VOCAB ──────────────────────────────────────
  _konversiVocab(raw) {
    return raw.map(r => {
      // Format spreadsheet: pertanyaan=Hanzi, kunci="hanzi/pinyin || arti"
      const fullKunci = r.kunci || "";
      const parts     = fullKunci.split("||");
      const kunciAlt  = (parts[0] || "").trim();   // hanzi/pinyin
      const arti      = (parts[1] || r.translate || "").trim();

      // Cari hanzi dan pinyin dari kunci
      const slashIdx = kunciAlt.indexOf("/");
      let hanzi  = r.pertanyaan;
      let pinyin = "";
      if (slashIdx > -1) {
        const kalt = kunciAlt.split("/");
        // Cek mana yang hanzi (ada karakter CJK) dan mana pinyin
        if (/[\u4e00-\u9fff]/.test(kalt[0])) {
          hanzi  = kalt[0].trim();
          pinyin = kalt[1] ? kalt[1].trim() : "";
        } else {
          pinyin = kalt[0].trim();
          hanzi  = r.pertanyaan;
        }
      }

      return {
        hanzi,
        pinyin,
        arti:   arti || r.translate || "",
        kunci:  fullKunci,
        level:  1,
        tag:    "spreadsheet",
        _raw:   r,
      };
    });
  },

  // ── KONVERSI DATA SENTENCE ───────────────────────────────────
  _konversiSentence(raw, subMode) {
    return raw.map(r => ({
      hanzi:    r.hanzi    || r.pertanyaan || "",
      pinyin:   r.pinyin   || "",
      arti:     r.arti     || r.translate  || r.kunci || "",
      struktur: r.struktur || "",
      explain:  r.explain  || "",
      note:     r.note     || "",
      kunci:    r.kunci    || r.arti || "",
      _raw:     r,
    }));
  },

  // ── POTONG SOAL sesuai mode ─────────────────────────────────
  potongSoal(arr, tipe) {
    const cfg = this.get(tipe);
    const acakArr = acak(arr);
    if (cfg.mode === "infinity") return acakArr;     // semua, akan loop
    if (cfg.mode === "jumlah")  return acakArr.slice(0, cfg.jumlah);
    return acakArr;   // sekali = semua soal 1x (bisa dibatasi modul)
  },
};
