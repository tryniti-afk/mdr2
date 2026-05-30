// ================================================================
//  VOCAB.JS — 6 Sub-Fitur Vocabulary Training
// ================================================================

const Vocab = {

  // State sesi
  soalList: [],
  idx: 0,
  skor: { benar:0, salah:0 },
  modeSaat: null,

  // ── RENDER MENU VOCAB ────────────────────────────────────────
  renderMenu() {
    const subFitur = [
      { id:"hanzi-indo",  icon:"🈯", label:"Hanzi → Indonesia",  desc:"Lihat karakter, jawab artinya" },
      { id:"indo-hanzi",  icon:"🔤", label:"Indonesia → Hanzi",  desc:"Lihat arti, tulis karakternya" },
      { id:"hanzi-pinyin",icon:"🔤", label:"Hanzi → Pinyin",     desc:"Tulis cara baca (romanisasi)" },
      { id:"audio-arti",  icon:"🔊", label:"Audio → Arti",       desc:"Dengar audio, jawab artinya" },
      { id:"audio-hanzi", icon:"🎧", label:"Audio → Hanzi",      desc:"Dengar audio, tulis karakter" },
      { id:"speaking",    icon:"🎤", label:"Speaking Vocab",     desc:"Lihat arti, ucapkan Hanzi-nya" },
    ];
    return `
      <div class="sub-menu-grid">
        ${subFitur.map(f => `
          <div class="sub-card" onclick="Vocab.mulai('${f.id}')">
            <div class="sub-icon">${f.icon}</div>
            <div class="sub-label">${f.label}</div>
            <div class="sub-desc">${f.desc}</div>
          </div>
        `).join("")}
      </div>
    `;
  },

  // ── MULAI SUB-FITUR ──────────────────────────────────────────
  mulai(mode) {
    this.modeSaat = mode;
    this.soalList = acak(DB.vocab).slice(0, 10);
    this.idx = 0;
    this.skor = { benar:0, salah:0 };
    resetSkor();
    this.tampilSoal();
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  tampilSoal() {
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    const total = this.soalList.length;
    const mode  = this.modeSaat;

    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${this.idx+1} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>
    `;

    if (mode === "hanzi-indo") {
      html += this._soalHanziIndo(item);
    } else if (mode === "indo-hanzi") {
      html += this._soalIndoHanzi(item);
    } else if (mode === "hanzi-pinyin") {
      html += this._soalHanziPinyin(item);
    } else if (mode === "audio-arti") {
      html += this._soalAudioArti(item);
    } else if (mode === "audio-hanzi") {
      html += this._soalAudioHanzi(item);
    } else if (mode === "speaking") {
      html += this._soalSpeaking(item);
    }

    el("konten-utama").innerHTML = html;
    this._pasangEvent();
  },

  // ── SOAL A: Hanzi → Indonesia (Pilihan Ganda) ───────────────
  _soalHanziIndo(item) {
    const salahOpts = acak(DB.vocab.filter(v => v.arti !== item.arti)).slice(0,3).map(v => v.arti);
    const semua = acak([item.arti, ...salahOpts]);
    const html = `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Indonesia</div>
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="soal-hint">Apa arti kata di atas?</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map((p,i) => `<button class="btn-pilihan" onclick="Vocab._jawabPilihan(${i},'${p}','${item.arti}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
    return html;
  },

  // ── SOAL B: Indonesia → Hanzi (Ketik) ───────────────────────
  _soalIndoHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Indonesia → Hanzi</div>
        <div class="soal-arti">${item.arti}</div>
        <div class="soal-hint">Tulis karakter Hanzi untuk kata di atas:</div>
        <div class="soal-pinyin-hint">Pinyin: ${item.pinyin}</div>
        <input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik Hanzi..." autocomplete="off">
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabKetik('${item.hanzi}', false)">✅ Submit</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
  },

  // ── SOAL C: Hanzi → Pinyin (Keyboard Pinyin) ────────────────
  _soalHanziPinyin(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Pinyin</div>
        <div class="soal-hanzi">${item.hanzi}</div>
        <div class="soal-hint">Tulis Pinyin (dengan tanda nada) untuk karakter di atas:</div>
        <div id="kb-pinyin-cont"></div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabPinyin('${item.pinyin}')">✅ Submit</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
  },

  // ── SOAL D: Audio → Arti (Pilihan) ──────────────────────────
  _soalAudioArti(item) {
    const salahOpts = acak(DB.vocab.filter(v => v.arti !== item.arti)).slice(0,3).map(v => v.arti);
    const semua = acak([item.arti, ...salahOpts]);
    return `
      <div class="soal-wrap">
        <div class="label-mode">Audio → Arti</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${item.hanzi}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan audio lalu pilih artinya:</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map((p,i) => `<button class="btn-pilihan" onclick="Vocab._jawabPilihan(${i},'${p}','${item.arti}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
  },

  // ── SOAL E: Audio → Hanzi (Ketik) ───────────────────────────
  _soalAudioHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Audio → Hanzi</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${item.hanzi}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengarkan audio lalu tulis Hanzi-nya:</div>
        <input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik Hanzi...">
        <div class="hasil-box" id="hasil-vocab"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Vocab._jawabKetik('${item.hanzi}', false)">✅ Submit</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
  },

  // ── SOAL F: Speaking Vocab ───────────────────────────────────
  _soalSpeaking(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking Vocab</div>
        <div class="soal-arti">${item.arti}</div>
        <div class="soal-hint">Ucapkan kata Mandarin untuk arti di atas:</div>
        <div class="soal-pinyin-hint">Target: <b>${item.hanzi}</b> (${item.pinyin})</div>
        <div class="hasil-box" id="hasil-vocab">Tekan tombol mic lalu bicara...</div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-mic" onclick="Vocab._jawabSuara('${item.hanzi}', '${item.arti}')">🎤 Mulai Bicara</button>
          <button class="btn btn-abu" onclick="Vocab.kembaliMenu()">← Menu</button>
        </div>
      </div>
    `;
  },

  // ── EVENT BINDING ────────────────────────────────────────────
  _pasangEvent() {
    const mode = this.modeSaat;
    if (mode === "hanzi-pinyin") {
      setTimeout(() => buildKbPinyin("kb-display", null), 50);
    }
    if (mode === "audio-arti" || mode === "audio-hanzi") {
      setTimeout(() => {
        const item = this.soalList[this.idx];
        TTS.mandarin(item.hanzi);
      }, 300);
    }
    // Enter submit
    setTimeout(() => {
      const inp = el("input-jawab");
      if (inp) inp.onkeydown = (e) => {
        if (e.key === "Enter") {
          const item = this.soalList[this.idx];
          this._jawabKetik(item.hanzi, false);
        }
      };
    }, 100);
  },

  // ── PROSES JAWABAN ───────────────────────────────────────────
  _jawabPilihan(idx, dipilih, jawaban) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    const cont = el("pilihan-cont");
    if (cont) {
      cont.querySelectorAll(".btn-pilihan").forEach((b,i) => {
        b.disabled = true;
        if (b.innerText === jawaban) b.classList.add("pilihan-benar");
        else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
      });
    }
    const msg = benar
      ? `Benar! ${item.hanzi} = <b>${item.arti}</b> (${item.pinyin})`
      : `Salah. Jawaban: <b>${item.arti}</b> (${item.pinyin})`;
    setHTML("hasil-vocab", (benar?"✅ ":"❌ ") + msg);
    el("hasil-vocab").className = "hasil-box " + (benar?"benar":"salah");
    setHTML("skor-mini", `✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}`);
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1600);
  },

  _jawabKetik(jawaban, exact) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = exact ? cekHanzi(input, jawaban) : cekHanzi(input, jawaban);
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    const msg = benar
      ? `Benar! ${item.hanzi} (${item.pinyin})`
      : `Salah. Jawaban: <b>${jawaban}</b>`;
    setHTML("hasil-vocab", (benar?"✅ ":"❌ ") + msg);
    el("hasil-vocab").className = "hasil-box " + (benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabPinyin(target) {
    const input = getKbTeks();
    if (!input) return;
    const benar = cekPinyin(input, target);
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    const msg = benar
      ? `Benar! Pinyin: <b>${target}</b>`
      : `Salah. Pinyin benar: <b>${target}</b>`;
    setHTML("hasil-vocab", (benar?"✅ ":"❌ ") + msg);
    el("hasil-vocab").className = "hasil-box " + (benar?"benar":"salah");
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabSuara(hanziTarget, artiTarget) {
    const btnMic = el("btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    setTeks("hasil-vocab", "🎙️ Silakan bicara...");

    STT.mulai("zh-CN",
      (hasil, semua) => {
        const benar = semua.some(h => h.includes(hanziTarget) || cekHanzi(h, hanziTarget));
        tambahSkor(benar);
        const msg = benar
          ? `Benar! Kamu berkata: "${hasil}" = <b>${artiTarget}</b>`
          : `Salah. Kamu: "${hasil}" — Target: <b>${hanziTarget}</b>`;
        setHTML("hasil-vocab", (benar?"✅ ":"❌ ") + msg);
        el("hasil-vocab").className = "hasil-box " + (benar?"benar":"salah");
        if (btnMic) btnMic.innerText = "✔ Selesai";
        setTimeout(() => { this.idx++; this.tampilSoal(); }, 2000);
      },
      (err) => {
        setTeks("hasil-vocab", "❌ Error mic: " + err + ". Gunakan Chrome.");
        if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Coba Lagi"; }
      },
      (dapat) => {
        if (!dapat) {
          setTeks("hasil-vocab", "⚠️ Tidak terdeteksi. Coba lagi.");
          if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Coba Lagi"; }
        }
      }
    );
  },

  // ── SELESAI ──────────────────────────────────────────────────
  tampilSelesai() {
    const pct = Math.round((sesiSkor.benar / sesiSkor.total) * 100);
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
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
      </div>
    `;
  },

  kembaliMenu() {
    TTS.berhenti(); STT.berhenti();
    App.renderModul("vocab");
  }
};
