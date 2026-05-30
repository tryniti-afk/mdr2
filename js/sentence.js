// ================================================================
//  SENTENCE.JS — 7 Sub-Fitur Sentence Training
// ================================================================

const Sentence = {
  soalList: [],
  idx: 0,
  modeSaat: null,

  renderMenu() {
    const subFitur = [
      { id:"hanzi-indo",  icon:"🈯", label:"Hanzi → Indonesia",   desc:"Terjemahkan kalimat Hanzi" },
      { id:"indo-hanzi",  icon:"🔤", label:"Indonesia → Hanzi",   desc:"Tulis kalimat dalam Hanzi" },
      { id:"audio-trans", icon:"🔊", label:"Audio → Terjemahan",  desc:"Dengar, terjemahkan kalimat" },
      { id:"dictation",   icon:"✍️",  label:"Dikte",              desc:"Dengar audio, ketik Hanzi" },
      { id:"reorder",     icon:"🔀", label:"Susun Kalimat",       desc:"Susun ulang kata-kata" },
      { id:"fill-blank",  icon:"📝", label:"Isi Titik-Titik",     desc:"Lengkapi kalimat yang kosong" },
      { id:"speaking",    icon:"🎤", label:"Speaking Sentence",   desc:"Baca kalimat dengan suara" },
    ];
    return `
      <div class="sub-menu-grid">
        ${subFitur.map(f => `
          <div class="sub-card" onclick="Sentence.mulai('${f.id}')">
            <div class="sub-icon">${f.icon}</div>
            <div class="sub-label">${f.label}</div>
            <div class="sub-desc">${f.desc}</div>
          </div>
        `).join("")}
      </div>
    `;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.soalList = acak(DB.sentences).slice(0, 8);
    this.idx = 0;
    resetSkor();
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    const total = this.soalList.length;

    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${this.idx+1} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>
    `;

    const mode = this.modeSaat;
    if (mode === "hanzi-indo")  html += this._soalHanziIndo(item);
    else if (mode === "indo-hanzi")  html += this._soalIndoHanzi(item);
    else if (mode === "audio-trans") html += this._soalAudioTrans(item);
    else if (mode === "dictation")   html += this._soalDictation(item);
    else if (mode === "reorder")     html += this._soalReorder(item);
    else if (mode === "fill-blank")  html += this._soalFillBlank(item);
    else if (mode === "speaking")    html += this._soalSpeaking(item);

    el("konten-utama").innerHTML = html;
    this._pasangEvent(item);
  },

  _soalHanziIndo(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Hanzi → Indonesia</div>
        <div class="soal-kalimat">${item.hanzi}</div>
        <div class="soal-hint">Terjemahkan kalimat di atas ke bahasa Indonesia:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis terjemahan..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabTeks('${this._esc(item.arti)}')">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalIndoHanzi(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">Indonesia → Hanzi</div>
        <div class="soal-kalimat indo">${item.arti}</div>
        <div class="soal-hint">Tulis kalimat di atas dalam Hanzi:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis Hanzi..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabHanzi('${this._esc(item.hanzi)}')">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalAudioTrans(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🔊 Audio → Terjemahan</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Kalimat</button>
        </div>
        <div class="soal-hint">Dengar kalimat lalu terjemahkan:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis terjemahan Indonesia..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabTeks('${this._esc(item.arti)}')">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalDictation(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">✍️ Dikte</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Putar Audio</button>
        </div>
        <div class="soal-hint">Dengar lalu ketik kalimat dalam Hanzi:</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Ketik Hanzi yang kamu dengar..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._jawabHanzi('${this._esc(item.hanzi)}')">✅ Submit</button>
          <button class="btn btn-kuning" onclick="Sentence._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalReorder(item) {
    // Pecah jadi kata-kata (karakter Hanzi)
    const kataAll = item.hanzi.replace(/[。？！，]/g,"").split("").filter(Boolean);
    // Atau split per kata yang bermakna berdasar spasi pinyin
    const kata = item.pinyin.trim().split(" ");
    // Ambil karakter sesuai jumlah kata pinyin
    let pos = 0, pecah = [];
    // Simple split: setiap ~2-3 karakter
    const rawKata = [];
    let sisa = item.hanzi.replace(/[。？！，、]/g,"");
    kata.forEach(k => {
      const len = k.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g,"a").length <= 3 ? 1 : 2;
      rawKata.push(sisa.slice(0, len > sisa.length ? sisa.length : len));
      sisa = sisa.slice(len > sisa.length ? sisa.length : len);
    });
    if (sisa) rawKata[rawKata.length-1] += sisa;
    const acakKata = acak(rawKata);

    // Simpan jawaban
    this._reorderTarget = rawKata.join("");
    this._reorderPilihan = [];

    return `
      <div class="soal-wrap">
        <div class="label-mode">🔀 Susun Kalimat</div>
        <div class="soal-hint">Susun kata-kata berikut menjadi kalimat yang benar:</div>
        <div class="reorder-target" id="reorder-target">— Sentuh kata untuk menyusun —</div>
        <div class="reorder-bank" id="reorder-bank">
          ${acakKata.map((k,i) => `<button class="reorder-btn" id="rw-${i}" onclick="Sentence._pilihKata('${k}','rw-${i}')">${k}</button>`).join("")}
        </div>
        <div class="soal-hint" style="margin-top:8px">Target: <i>${item.arti}</i></div>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Sentence._cekReorder()">✅ Cek</button>
          <button class="btn btn-abu" id="btn-reset-reorder" onclick="Sentence._resetReorder()">🔄 Reset</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalFillBlank(item) {
    // Cari kata kunci dari DB.vocab yang ada di kalimat
    const cocok = DB.vocab.find(v => item.hanzi.includes(v.hanzi) && v.hanzi.length >= 2);
    if (!cocok) { this.idx++; this.tampilSoal(); return ""; }
    const blank = item.hanzi.replace(cocok.hanzi, "___");
    const salahOpts = acak(DB.vocab.filter(v => v.hanzi !== cocok.hanzi)).slice(0,3).map(v => v.hanzi);
    const semua = acak([cocok.hanzi, ...salahOpts]);
    return `
      <div class="soal-wrap">
        <div class="label-mode">📝 Isi Titik-Titik</div>
        <div class="soal-kalimat">${blank}</div>
        <div class="soal-hint">Pilih kata yang tepat untuk mengisi ___:</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map((p,i) => `<button class="btn-pilihan hanzi" onclick="Sentence._jawabFill('${p}','${cocok.hanzi}','${this._esc(item.hanzi)}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _soalSpeaking(item) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking Sentence</div>
        <div class="soal-kalimat">${item.hanzi}</div>
        <div class="soal-pinyin-hint">${item.pinyin}</div>
        <div class="soal-hint">Baca kalimat di atas dengan suara:</div>
        <div class="hasil-box" id="hasil-box">Tekan mic lalu baca kalimat di atas...</div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-mic" onclick="Sentence._jawabSpeaking('${this._esc(item.hanzi)}')">🎤 Mulai Bicara</button>
          <button class="btn btn-biru" onclick="TTS.mandarin('${this._esc(item.hanzi)}')">🔊 Contoh</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _pasangEvent(item) {
    if (this.modeSaat === "audio-trans" || this.modeSaat === "dictation" || this.modeSaat === "audio-hanzi") {
      setTimeout(() => TTS.mandarin(item.hanzi), 400);
    }
    setTimeout(() => {
      const inp = el("input-jawab");
      if (inp && inp.tagName === "TEXTAREA") {
        inp.onkeydown = (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (this.modeSaat === "hanzi-indo" || this.modeSaat === "audio-trans") this._jawabTeks(item.arti);
            else if (this.modeSaat === "indo-hanzi" || this.modeSaat === "dictation") this._jawabHanzi(item.hanzi);
          }
        };
      }
    }, 100);
  },

  _pilihKata(kata, btnId) {
    const target = el("reorder-target");
    const btn = el(btnId);
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = "0.3";
    this._reorderPilihan.push(kata);
    target.innerText = this._reorderPilihan.join("");
  },

  _resetReorder() {
    this._reorderPilihan = [];
    el("reorder-target").innerText = "— Sentuh kata untuk menyusun —";
    document.querySelectorAll(".reorder-btn").forEach(b => { b.disabled = false; b.style.opacity = "1"; });
  },

  _cekReorder() {
    const hasil = this._reorderPilihan.join("");
    const target = this._reorderTarget;
    const benar = hasil === target;
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ Salah! ") + `Jawaban: <b>${target}</b><br><i>${item.arti}</i>`);
    el("hasil-box").className = "hasil-box " + (benar?"benar":"salah");
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 2000);
  },

  _jawabFill(dipilih, jawaban, kalimatAsli) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    const cont = el("pilihan-cont");
    if (cont) {
      cont.querySelectorAll(".btn-pilihan").forEach(b => {
        b.disabled = true;
        if (b.innerText === jawaban) b.classList.add("pilihan-benar");
        else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
      });
    }
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ Salah! ") + `Kalimat: <b>${kalimatAsli}</b>`);
    el("hasil-box").className = "hasil-box " + (benar?"benar":"salah");
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabTeks(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = cekJawaban(input, target);
    tambahSkor(benar);
    const item = this.soalList[this.idx];
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ ") + `Jawaban: <b>${target}</b>`);
    el("hasil-box").className = "hasil-box " + (benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabHanzi(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = cekHanzi(input, target);
    tambahSkor(benar);
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ ") + `Jawaban: <b>${target}</b>`);
    el("hasil-box").className = "hasil-box " + (benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabSpeaking(target) {
    const btnMic = el("btn-mic");
    if (btnMic) { btnMic.disabled = true; btnMic.innerText = "🎙️ Mendengarkan..."; }
    setTeks("hasil-box", "🎙️ Silakan baca kalimat...");

    STT.mulai("zh-CN",
      (hasil, semua) => {
        // Hitung kesamaan karakter
        const targetClean = target.replace(/[。？！，]/g,"");
        const benar = semua.some(h => {
          const hClean = h.replace(/[。？！，]/g,"");
          const sama = [...targetClean].filter((c,i) => hClean[i] === c).length;
          return sama >= Math.floor(targetClean.length * 0.6);
        });
        tambahSkor(benar);
        setHTML("hasil-box", (benar?"✅ Bagus! ":"❌ Kurang tepat. ") + `Kamu: "${hasil}" <br>Target: <b>${target}</b>`);
        el("hasil-box").className = "hasil-box " + (benar?"benar":"salah");
        if (btnMic) btnMic.innerText = "✔";
        setTimeout(() => { this.idx++; this.tampilSoal(); }, 2500);
      },
      (err) => {
        setTeks("hasil-box", "❌ Mic error: " + err);
        if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Coba Lagi"; }
      },
      (dapat) => {
        if (!dapat) {
          setTeks("hasil-box", "⚠️ Tidak terdeteksi.");
          if (btnMic) { btnMic.disabled = false; btnMic.innerText = "🎤 Coba Lagi"; }
        }
      }
    );
  },

  _skip() {
    const item = this.soalList[this.idx];
    tambahSkor(false);
    setHTML("hasil-box", `⏭ Di-skip. Jawaban: <b>${item.hanzi}</b> — <i>${item.arti}</i>`);
    el("hasil-box").className = "hasil-box salah";
    setTimeout(() => { this.idx++; this.tampilSoal(); }, 1800);
  },

  _esc(s) { return (s||"").replace(/'/g,"\\'"); },

  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
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
          <button class="btn btn-hijau" onclick="Sentence.mulai('${this.modeSaat}')">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="Sentence.kembaliMenu()">← Menu Kalimat</button>
        </div>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti(); STT.berhenti();
    App.renderModul("sentence");
  }
};
