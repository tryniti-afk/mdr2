// ================================================================
//  SENTENCE.JS — Sentence Training + Set Soal Terpusat + Mode Game
//  Sub-fitur yang didukung dengan data GrHSK:
//    hanzi-indo, indo-hanzi, audio-trans, dictation, speaking
//  Sub-fitur yang pakai data lokal tetap (reorder, fill-blank):
//    karena membutuhkan struktur kata khusus
// ================================================================

var Sentence = {

  soalList: [],
  idx: 0,
  modeSaat: null,

  // ── RENDER MENU ──────────────────────────────────────────────
  renderMenu() {
    const subFitur = [
      { id:"hanzi-indo",  icon:"🈯", label:"Hanzi → Indonesia",  desc:"Terjemahkan kalimat Hanzi" },
      { id:"indo-hanzi",  icon:"🔤", label:"Indonesia → Hanzi",  desc:"Tulis kalimat dalam Hanzi" },
      { id:"audio-trans", icon:"🔊", label:"Audio → Terjemahan", desc:"Dengar, terjemahkan kalimat" },
      { id:"dictation",   icon:"✍️",  label:"Dikte",             desc:"Dengar audio, ketik Hanzi" },
      { id:"speaking",    icon:"🎤", label:"Speaking Sentence",  desc:"Baca kalimat dengan suara" },
      { id:"struktur",    icon:"📐", label:"Lihat Struktur",     desc:"Pola & penjelasan kalimat" },
    ];
    return `
      <div style="padding-bottom:12px">
        ${SetSoal.renderWidget("sentence", "s")}
        <div class="sub-menu-grid" style="margin-top:12px">
          ${subFitur.map(f => `
            <div class="sub-card" onclick="Sentence.mulai('${f.id}')">
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
    SetSoal._pilihSheet("sentence", SetSoal.get("sentence").sheet, "s");
  },

  // ── MULAI ─────────────────────────────────────────────────────
  async mulai(mode) {
    this.modeSaat        = mode;
    this.idx             = 0;
    this._infinityRetry  = false;
    this._sedangTransisi = false;
    resetSkor();

    const raw = await SetSoal.getSoalSiap("sentence", mode);
    if (!raw || !raw.length) {
      tampilToast("Tidak ada soal! Cek set soal yang dipilih.");
      return;
    }
    this.soalList = SetSoal.potongSoal(raw, "sentence");
    this.tampilSoal();
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  tampilSoal() {
    this._sedangTransisi = false;   // pastikan selalu reset saat soal baru tampil
    const cfg = SetSoal.get("sentence");
    if (cfg.mode === "infinity" && this.idx >= this.soalList.length) {
      this.idx = 0;
    }
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }

    const item  = this.soalList[this.idx];
    const total = this.soalList.length;
    const mode  = this.modeSaat;

    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${this.idx+1} / ${cfg.mode === "infinity" ? "∞" : total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${cfg.mode !== "infinity" ? (this.idx/total)*100 : 0}%"></div>
      </div>
    `;

    if (mode === "hanzi-indo")  html += this._soalHanziIndo(item);
    else if (mode === "indo-hanzi")  html += this._soalIndoHanzi(item);
    else if (mode === "audio-trans") html += this._soalAudioTrans(item);
    else if (mode === "dictation")   html += this._soalDictation(item);
    else if (mode === "speaking")    html += this._soalSpeaking(item);
    else if (mode === "struktur")    html += this._soalStruktur(item);

    el("konten-utama").innerHTML = html;
    this._pasangEvent(item);
  },

  // ── SOAL: Hanzi → Indonesia ──────────────────────────────────
  _soalHanziIndo(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Indonesia</div>
        <div class="soal-kalimat">${item.hanzi}</div>
        ${item.pinyin ? `<div class="soal-pinyin-hint">${item.pinyin}</div>` : ""}
        <div class="soal-hint">Terjemahkan ke bahasa Indonesia:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis terjemahan..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabTeks()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL: Indonesia → Hanzi ──────────────────────────────────
  _soalIndoHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Indonesia → Hanzi</div>
        <div class="soal-kalimat indo">${item.arti}</div>
        <div class="soal-hint">Tulis kalimat dalam Hanzi:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis Hanzi..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabHanzi()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL: Audio → Terjemahan ─────────────────────────────────
  _soalAudioTrans(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Audio → Terjemahan</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan lalu terjemahkan:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis terjemahan..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabTeks()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL: Dikte ──────────────────────────────────────────────
  _soalDictation(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">✍️ Dikte</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan lalu ketik Hanzi-nya:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Ketik Hanzi..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabHanzi()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL: Speaking ───────────────────────────────────────────
  _soalSpeaking(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking</div>
        <div class="soal-kalimat indo">${item.arti}</div>
        <div class="soal-hint">Ucapkan kalimat Mandarin ini:</div>
        <div class="soal-kalimat" style="font-size:18px;color:#1565c0">${item.hanzi}</div>
        ${item.pinyin ? `<div class="soal-pinyin-hint">${item.pinyin}</div>` : ""}
        <div class="hasil-box" id="hasil-box">Tekan mic lalu baca kalimat di atas...</div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-mic" onclick="Sentence._jawabSuara()">🎤 Mulai Bicara</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── SOAL: Lihat Struktur ─────────────────────────────────────
  _soalStruktur(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">📐 Struktur Kalimat</div>
        <div class="soal-kalimat">${item.hanzi}</div>
        ${item.pinyin ? `<div class="soal-pinyin-hint">${item.pinyin}</div>` : ""}
        <div class="soal-kalimat indo" style="font-size:16px">${item.arti}</div>
        ${item.struktur ? `<div class="ss-info-box" style="margin:10px 0"><b>Struktur:</b> ${item.struktur}</div>` : ""}
        ${item.explain  ? `<div class="ss-info-box" style="background:#f3e5f5;color:#6a1b9a;border-color:#ce93d8"><b>Penjelasan:</b> ${item.explain}</div>` : ""}
        ${item.note     ? `<div class="ss-info-box" style="background:#fff3e0;color:#e65100;border-color:#ffcc80"><b>Catatan:</b> ${item.note}</div>` : ""}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-biru" onclick="Sentence._lanjut()">→ Lanjut</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── EVENTS ───────────────────────────────────────────────────
  _pasangEvent(item) {
    const mode = this.modeSaat;
    const cfg  = App._settings;
    if (mode === "audio-trans" || mode === "dictation") {
      setTimeout(() => TTS.bicara(item.hanzi, "zh-CN", cfg.ttsRate || 0.85), 300);
    }
    setTimeout(() => {
      const inp = el("input-jawab");
      if (inp) inp.focus();
    }, 100);
  },

  // ── PROSES JAWABAN ───────────────────────────────────────────
  _jawabTeks() {
    if (this._sedangTransisi) return;
    const inp   = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const item  = this.soalList[this.idx];
    const kunci = item.arti || item.kunci || "";
    const benar = cekJawaban(input, kunci);
    tambahSkor(benar);
    const hEl = el("hasil-box");
    if (hEl) {
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
      hEl.innerHTML = benar
        ? `✅ Benar! <br><b>${item.hanzi}</b>${item.pinyin ? " — "+item.pinyin : ""}`
        : `❌ Salah.<br>Kuncinya: <b>${kunci}</b>`;
    }
    if (inp) inp.disabled = true;
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    this._nextOrRetry(benar);
  },

  _jawabHanzi() {
    if (this._sedangTransisi) return;
    const inp   = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const item  = this.soalList[this.idx];
    // Cek exact hanzi — toleransi spasi
    const benar = input.replace(/\s/g,"") === item.hanzi.replace(/\s/g,"");
    tambahSkor(benar);
    const hEl = el("hasil-box");
    if (hEl) {
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
      hEl.innerHTML = benar
        ? `✅ Benar! <b>${item.hanzi}</b>`
        : `❌ Salah.<br>Jawaban: <b>${item.hanzi}</b>`;
    }
    if (inp) inp.disabled = true;
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    this._nextOrRetry(benar);
  },

  _jawabSuara() {
    if (this._sedangTransisi) return;
    const item   = this.soalList[this.idx];
    const btnMic = el("btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    setTeks("hasil-box", "🎙️ Silakan baca kalimat...");
    STT.mulai("zh-CN",
      (hasil, semua) => {
        const cln = s => s.replace(/[。，！？\s]/g,"");
        const benar = semua.some(h => cln(h).includes(cln(item.hanzi)) || cln(item.hanzi).includes(cln(h)));
        tambahSkor(benar);
        const hEl = el("hasil-box");
        if (hEl) {
          hEl.className = "hasil-box " + (benar?"benar":"salah");
          hEl.innerHTML = benar
            ? `✅ Bagus! Kamu: "${hasil}"`
            : `❌ Kurang tepat. Kamu: "${hasil}"<br>Target: <b>${item.hanzi}</b>`;
        }
        if (btnMic) btnMic.innerText = "✔ Selesai";
        this._nextOrRetry(benar);
      },
      err => { setTeks("hasil-box","❌ Error mic: "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} },
      dapat => { if(!dapat){ setTeks("hasil-box","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} } }
    );
  },

  _skip() {
    const item = this.soalList[this.idx];
    tambahSkor(false);
    const hEl = el("hasil-box");
    if (hEl) {
      hEl.className = "hasil-box salah";
      hEl.innerHTML = `⏭ Di-skip.<br>Jawaban: <b>${item.hanzi}</b>${item.arti ? " = "+item.arti : ""}`;
    }
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
  },

  _lanjut() {
    this.idx++;
    this.tampilSoal();
  },

  // ── INFINITY RETRY ───────────────────────────────────────────
  _nextOrRetry(benar) {
    if (this._sedangTransisi) return;
    this._sedangTransisi = true;   // blokir input selama animasi transisi
    const cfg = SetSoal.get("sentence");

    if (cfg.mode === "infinity") {
      if (!benar) {
        // Salah → ulang soal ini, idx tidak berubah
        this._infinityRetry = true;
        const hEl = el("hasil-box");
        if (hEl) hEl.innerHTML += "<br><small>🔄 Jawab ulang soal ini...</small>";
        setTimeout(() => this.tampilSoal(), 2200 + 1400);
      } else {
        // Benar → jika tadi retry, kembali ke soal pertama; jika normal, lanjut
        if (this._infinityRetry) {
          this._infinityRetry = false;
          TTS.berhenti();
          STT.berhenti();
          setTimeout(() => { this.idx = 0; this.tampilSoal(); }, 1800);
        } else {
          setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
        }
      }
    } else {
      const delay = benar ? 1800 : 2200;
      setTimeout(() => { this.idx++; this.tampilSoal(); }, delay);
    }
  },

  // ── SELESAI ──────────────────────────────────────────────────
  tampilSelesai() {
    const pct  = sesiSkor.total ? Math.round((sesiSkor.benar / sesiSkor.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    App.catatSesiSelesai("sentence", sesiSkor.benar, sesiSkor.total);
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
          <button class="btn btn-hijau" onclick="Sentence.mulai('${this.modeSaat}')">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="Sentence.kembaliMenu()">← Menu Sentence</button>
        </div>
      </div>`;
  },

  kembaliMenu() { TTS.berhenti(); STT.berhenti(); App.renderModul("sentence"); },
  _esc(s) { return (s||"").replace(/'/g,"\\'").replace(/\n/g," "); },
};
