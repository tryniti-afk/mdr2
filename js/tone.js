// ================================================================
//  TONE.JS — Fitur "Fokus Nada" di modul Vocabulary
//    Mode A "pilihan" : pilihan ganda 2-4 hanzi mirip, beda nada
//    Mode B "urutan"  : ucapkan kata dari data vocab aktif,
//                        lihat grafik kontur nada (kamu vs standar)
// ================================================================

var ToneModule = {

  disp: { audio: true, hanzi: true, pinyin: true },  // tampilan soal
  soalList: [],
  idx: 0,
  modeSaat: null,     // "pilihan" | "urutan"
  _recording: false,
  cfg: { modeSalah: "lanjut" },  // "lanjut" | "ulangDariAwal" | "munculDiAkhir" | "ulang2Sebelumnya"
  retryQueue: [],
  _retryAktif: false,

  // ── MENU UTAMA ────────────────────────────────────────────────
  renderMenu() {
    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">🎵</div>
          <div>
            <div class="sv-title">Fokus Nada (Tone)</div>
            <div class="sv-subtitle">Latihan khusus membedakan nada 1-2-3-4</div>
          </div>
        </div>
        <div class="sub-menu-grid">
          <div class="sub-card" onclick="ToneModule.bukaSetup('pilihan')">
            <div class="sub-icon">🎯</div>
            <div class="sub-label">Pilihan Mirip Nada</div>
            <div class="sub-desc">4 hanzi pelafalan mirip, cuma beda nada — pilih yang benar</div>
          </div>
          <div class="sub-card" onclick="ToneModule.bukaSetup('urutan')">
            <div class="sub-icon">🗣️</div>
            <div class="sub-label">Ucapkan &amp; Lihat Kontur</div>
            <div class="sub-desc">Ucapkan kata dari data vocab kamu, bandingkan grafik nada</div>
          </div>
        </div>
        <button class="btn btn-abu" style="width:100%;margin-top:14px" onclick="Vocab.kembaliMenu()">← Kembali ke Vocabulary</button>
      </div>`;
  },

  // ── SETUP TAMPILAN SOAL ─────────────────────────────────────────
  bukaSetup(mode) {
    this.modeSaat = mode;
    const judul = mode === "pilihan" ? "🎯 Pilihan Mirip Nada" : "🗣️ Ucapkan & Lihat Kontur";
    const ket = mode === "pilihan"
      ? "Pilih apa yang muncul di soal sebelum menjawab (audio wajib salah satu nyala minimal)."
      : "Pilih apa yang muncul saat kamu diminta mengucapkan kata (data diambil dari set soal Vocabulary aktif).";
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">${judul}</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">${ket}</div>
        <div class="sub-menu-grid" id="tone-disp-grid">
          ${this._dispCard("audio", "🔊", "Audio")}
          ${this._dispCard("hanzi", "🈯", "Hanzi")}
          ${this._dispCard("pinyin", "🔤", "Pinyin")}
        </div>
        ${mode === "pilihan" ? `
        <div style="margin-top:14px">
          <label style="font-size:13px;color:var(--c-sub);font-weight:700">🎮 Kalau Salah</label>
          <div class="opsi-grup" style="margin-top:6px;flex-direction:column;align-items:stretch">
            <button class="opsi aktif-hijau ${this.cfg.modeSalah === 'lanjut' ? 'aktif' : ''}" onclick="ToneModule._pilihModeSalah('lanjut')">➡️ Lanjut Terus</button>
            <button class="opsi aktif-merah ${this.cfg.modeSalah === 'ulangDariAwal' ? 'aktif' : ''}" onclick="ToneModule._pilihModeSalah('ulangDariAwal')">🔄 Ulang Lagi dari Awal</button>
            <button class="opsi aktif-kuning ${this.cfg.modeSalah === 'munculDiAkhir' ? 'aktif' : ''}" onclick="ToneModule._pilihModeSalah('munculDiAkhir')">🔁 Muncul Lagi di Akhir</button>
            <button class="opsi aktif-ungu ${this.cfg.modeSalah === 'ulang2Sebelumnya' ? 'aktif' : ''}" onclick="ToneModule._pilihModeSalah('ulang2Sebelumnya')">🔂 Ulang Sampai Benar, lalu Mundur 2 Soal</button>
          </div>
        </div>` : ""}
        ${renderKontrolLanjut("ToneModule._renderKontrolUlang")}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="ToneModule.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="ToneModule.renderMenu(), el('konten-utama').innerHTML=ToneModule.renderMenu()">← Batal</button>
        </div>
      </div>`;
  },
  _renderKontrolUlang() { ToneModule.bukaSetup(ToneModule.modeSaat); },
  _pilihModeSalah(mode) { this.cfg.modeSalah = mode; this.bukaSetup(this.modeSaat); },
  _dispCard(key, icon, label) {
    const aktif = this.disp[key];
    return `
      <div class="sub-card ${aktif ? "sub-card-aktif" : ""}" onclick="ToneModule._toggleDisp('${key}')">
        <div class="sub-icon">${icon}</div>
        <div class="sub-label">${label}</div>
        <div class="sub-desc">${aktif ? "Ditampilkan" : "Disembunyikan"}</div>
      </div>`;
  },
  _toggleDisp(key) {
    const aktifCount = Object.values(this.disp).filter(Boolean).length;
    if (this.disp[key] && aktifCount === 1) { tampilToast("⚠️ Minimal 1 tampilan harus aktif."); return; }
    this.disp[key] = !this.disp[key];
    setHTML("tone-disp-grid", `${this._dispCard("audio","🔊","Audio")}${this._dispCard("hanzi","🈯","Hanzi")}${this._dispCard("pinyin","🔤","Pinyin")}`);
  },

  // ── MULAI SESI ───────────────────────────────────────────────
  async mulai() {
    resetSkor();
    this.idx = 0;
    this.retryQueue = [];
    this._retryAktif = false;
    if (this.modeSaat === "pilihan") {
      const sets = (DB.nadaSets || []).filter(s => s.list.length >= 2);
      this.soalList = acak(sets).slice(0, Math.min(10, sets.length));
      if (!this.soalList.length) { tampilToast("⚠️ Data nada belum tersedia."); this.renderMenu(); return; }
      this.tampilSoalPilihan();
    } else {
      setHTML("konten-utama", `<div class="soal-wrap"><div class="label-mode">🗣️ Menyiapkan data...</div></div>`);
      const kata = await VocabAIData.ambilKata(10);
      if (!kata.length || !kata.some(k => k.pinyin)) { tampilToast("⚠️ Data vocab dengan pinyin belum tersedia."); el("konten-utama").innerHTML = this.renderMenu(); return; }
      this.soalList = kata.filter(k => k.pinyin);
      this.tampilSoalUrutan();
    }
  },

  // ── MODE A: PILIHAN GANDA ────────────────────────────────────
  tampilSoalPilihan() {
    if (this.idx >= this.soalList.length) { this._tampilSelesai(); return; }
    const set = this.soalList[this.idx];
    const target = acak(set.list)[0];
    const opsi = acak(set.list).slice(0, Math.min(4, set.list.length));
    if (!opsi.some(o => o.hanzi === target.hanzi)) opsi[0] = target;
    const opsiAcak = acak(opsi);

    // Catatan: hanzi target TIDAK pernah ditampilkan di prompt (itu jawabannya).
    // Toggle "Hanzi" di sini hanya relevan untuk mode "Ucapkan & Lihat Kontur".
    let promptHTML = "";
    if (this.disp.pinyin) promptHTML += `<div class="soal-pinyin" style="font-size:26px">${target.pinyin}</div>`;
    if (this.disp.audio) promptHTML += `
      <div class="audio-btn-wrap">
        <button class="btn-audio" onclick="TTS.mandarin('${target.hanzi}')">🔊 Putar Audio</button>
      </div>`;
    if (!promptHTML) promptHTML = `<div class="soal-pinyin" style="font-size:26px">${target.pinyin}</div>`;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">${this._retryAktif ? "🔂 Ulangi · " : ""}Soal ${this.idx + 1}/${this.soalList.length}</div>
          <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
        </div>
        <div class="label-mode">🎯 Pilih hanzi yang sesuai nadanya</div>
        ${promptHTML}
        <div class="pilihan-grid" id="tone-pilihan-cont">
          ${opsiAcak.map(o => `<button class="btn-pilihan" onclick="ToneModule._jawabPilihan('${o.hanzi}','${target.hanzi}')">${o.hanzi}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-tone" style="display:none"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="ToneModule.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
    this._targetSet = set; this._target = target;
    if (this.disp.audio) setTimeout(() => TTS.mandarin(target.hanzi), 350);
  },

  _jawabPilihan(dipilih, benarHanzi) {
    if (this._sedangTransisi) return;
    this._sedangTransisi = true;
    const benar = dipilih === benarHanzi;
    tambahSkor(benar);
    const target = this._target;
    const dipilihObj = this._targetSet.list.find(x => x.hanzi === dipilih);

    el("tone-pilihan-cont")?.querySelectorAll(".btn-pilihan").forEach(b => {
      b.disabled = true;
      if (b.innerText === benarHanzi) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });

    const hEl = el("hasil-tone");
    hEl.style.display = "block";
    hEl.className = "hasil-box " + (benar ? "benar" : "salah");
    if (benar) {
      hEl.innerHTML = `✅ Benar! <b>${target.hanzi}</b> (${target.pinyin}) — ${ToneUtil.LABEL[target.tone]}`;
    } else {
      hEl.innerHTML = `
        ❌ Kamu pilih <b>${dipilih}</b> (${dipilihObj?.pinyin || "?"}) — ${ToneUtil.LABEL[dipilihObj?.tone] || ""}<br>
        Jawaban benar: <b>${target.hanzi}</b> (${target.pinyin}) — ${ToneUtil.LABEL[target.tone]}<br>
        <button class="btn-audio" style="margin-top:8px" onclick="TTS.mandarin('${target.hanzi}')">🔊 Dengar lagi</button>`;
    }
    tampilTombolLanjut("hasil-tone", () => this._lanjutSetelahPilihan(benar));
  },

  _lanjutSetelahPilihan(benar) {
    this._sedangTransisi = false;
    const modeSalah = this.cfg.modeSalah;
    const targetSet = this._targetSet;

    if (benar) {
      if (this._retryAktif) {
        // baru saja berhasil di soal yang diulang paksa -> mundur 2 soal
        this._retryAktif = false;
        this.idx = Math.max(0, this.idx - 2);
        tampilToast("↩️ Mundur 2 soal untuk pengulangan...");
      } else {
        this.idx++;
      }
      this._lanjutCekAntrian();
      return;
    }

    // jawaban salah
    if (modeSalah === "ulangDariAwal") {
      tampilToast("🔄 Salah! Diulang dari awal...");
      this.idx = 0;
      this._retryAktif = false;
      resetSkor();
      this.tampilSoalPilihan();
      return;
    }
    if (modeSalah === "munculDiAkhir") {
      this.retryQueue.push(targetSet);
      this.idx++;
      this._lanjutCekAntrian();
      return;
    }
    if (modeSalah === "ulang2Sebelumnya") {
      this._retryAktif = true;
      this.tampilSoalPilihan();
      return;
    }
    // default "lanjut"
    this.idx++;
    this._lanjutCekAntrian();
  },

  _lanjutCekAntrian() {
    if (this.idx >= this.soalList.length && this.retryQueue.length) {
      tampilToast(`🔁 Mengulang ${this.retryQueue.length} soal yang salah...`);
      this.soalList = this.retryQueue;
      this.retryQueue = [];
      this.idx = 0;
    }
    this.tampilSoalPilihan();
  },

  // ── MODE B: UCAPKAN & KONTUR ──────────────────────────────────
  tampilSoalUrutan() {
    if (this.idx >= this.soalList.length) { this._tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    let promptHTML = "";
    if (this.disp.hanzi) promptHTML += `<div class="soal-hanzi">${item.hanzi}</div>`;
    if (this.disp.pinyin) promptHTML += `<div class="soal-pinyin">${item.pinyin}</div>`;
    if (this.disp.audio) promptHTML += `
      <div class="audio-btn-wrap">
        <button class="btn-audio" onclick="TTS.mandarin('${item.hanzi}')">🔊 Putar Audio</button>
      </div>`;

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Soal ${this.idx + 1}/${this.soalList.length}</div>
          <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
        </div>
        <div class="label-mode">🗣️ Ucapkan kata di bawah ini</div>
        ${promptHTML}
        <div class="hasil-box" id="hasil-tone" style="display:none"></div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-tone-rec" onclick="ToneModule._rekam()">🎤 Mulai Rekam (maks 5 dtk)</button>
          <button class="btn btn-kuning" onclick="ToneModule._skipUrutan()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="ToneModule.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
    if (this.disp.audio) setTimeout(() => TTS.mandarin(item.hanzi), 350);
  },

  async _rekam() {
    if (this._recording) return;
    if (!PitchRecorder.supported()) { tampilToast("⚠️ Mic/pitch tidak didukung di browser ini."); return; }
    this._recording = true;
    const btn = el("btn-tone-rec");
    btn.disabled = true; btn.innerText = "🎙️ Merekam...";
    setHTML("hasil-tone", ""); el("hasil-tone").style.display = "none";
    try {
      const { contour } = await PitchRecorder.start(5000);
      this._recording = false;
      const item = this.soalList[this.idx];
      const ref = ToneUtil.buildReferenceContour(item.pinyin);
      if (!contour) {
        setHTML("hasil-tone", "⚠️ Suara tidak terdeteksi jelas. Coba lagi lebih dekat ke mic.");
        el("hasil-tone").className = "hasil-box salah"; el("hasil-tone").style.display = "block";
        btn.disabled = false; btn.innerText = "🎤 Coba Lagi";
        return;
      }
      const notes = ToneUtil.compareContours(contour, ref);
      const skorOk = !notes.some(n => n.includes("⚠️"));
      tambahSkor(skorOk);
      const hEl = el("hasil-tone");
      hEl.style.display = "block";
      hEl.className = "hasil-box info";
      hEl.innerHTML = `
        ${ContourChart.svg(contour, ref)}
        <div style="margin-top:8px;text-align:left">${notes.map(n => `<div>${n}</div>`).join("")}</div>`;
      btn.innerText = "✔ Selesai";
      tampilTombolLanjut("hasil-tone", () => { this.idx++; this.tampilSoalUrutan(); });
    } catch (e) {
      this._recording = false;
      tampilToast("❌ " + (e.message || "Gagal mengakses mic."));
      btn.disabled = false; btn.innerText = "🎤 Coba Lagi";
    }
  },

  _skipUrutan() {
    tambahSkor(true);
    this.idx++; this.tampilSoalUrutan();
  },

  // ── SELESAI ────────────────────────────────────────────────────
  _tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    App.catatSesiSelesai("vocab", sesiSkor.benar, sesiSkor.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Sesi Nada Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
          <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="ToneModule.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="ToneModule.kembaliMenu()">← Menu Vocab</button>
        </div>
      </div>`;
  },

  kembaliMenu() { TTS.berhenti(); STT.berhenti(); el("konten-utama").innerHTML = this.renderMenu(); },
};
