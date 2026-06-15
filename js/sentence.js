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
      { id:"vocab-ai",   icon:"🤖", label:"Generate AI",         desc:"AI buat soal dari vocab HSK kamu" },
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
    if (mode === "vocab-ai") { el("konten-utama").innerHTML = SentenceVocab.renderMenu(); return; }
    this.modeSaat        = mode;
    this.idx             = 0;
    this._infinityRetry  = false;
    this._soalSelesai    = 0;
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
    const modeRetry = cfg.mode === "infinity" || cfg.mode === "jumlah";
    if (cfg.mode === "infinity" && this.idx >= this.soalList.length) {
      this.idx = 0;
    }
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }

    const item  = this.soalList[this.idx];
    const total = this.soalList.length;
    const mode  = this.modeSaat;

    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${modeRetry ? this._soalSelesai+1 : this.idx+1} / ${total}</div>
        <div class="skor-mini" id="skor-mini">✅ ${sesiSkor.benar} ❌ ${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${modeRetry ? (this._soalSelesai/total)*100 : (this.idx/total)*100}%"></div>
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
    this._sedangTransisi = true;
    const cfg = SetSoal.get("sentence");
    const modeRetry = cfg.mode === "infinity" || cfg.mode === "jumlah";

    if (modeRetry) {
      if (!benar) {
        // Salah → ulang soal ini sampai benar
        this._infinityRetry = true;
        const hEl = el("hasil-box");
        if (hEl) hEl.innerHTML += "<br><small>🔄 Jawab ulang soal ini...</small>";
        setTimeout(() => this.tampilSoal(), 2200 + 1400);
      } else {
        if (this._infinityRetry) {
          // Setelah retry berhasil → kembali ke soal pertama
          this._infinityRetry = false;
          this._soalSelesai++;
          TTS.berhenti();
          STT.berhenti();
          setTimeout(() => { this.idx = 0; this._soalSelesai = 0; this.tampilSoal(); }, 1800);
        } else {
          this._soalSelesai++;
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

// ================================================================
//  SENTENCE VOCAB AI — Generate Kalimat dari Vocab HSK via Gemini
// ================================================================

// ================================================================
//  SENTENCE_VOCAB.JS — Generate Kalimat dari Vocab HSK via Gemini (Apps Script)
//  Versi: 2.1
//
//  Fitur:
//    - Pilih level HSK multi-select (1-2, 3, 4, 5)
//    - Mode: hanzi→indo atau indo→hanzi
//    - Tampilan: teks, audio, atau teks+audio
//    - Jawab: ketik atau suara
//    - AI generate kalimat natural dari vocab terpilih
//    - Breakdown vocab + grammar dari sheet Grhsk (+ grammar umum Gemini)
//    - Tanya AI saat salah (chat mini, multi-turn)
//    - API key aman: tersimpan di Apps Script, tidak ada di source code JS
//
//  Cara pasang:
//    1. <script src="js/sentence_vocab.js"></script> di index.html
//       (sebelum </body>, setelah sentence.js)
//    2. Di sentence.js → renderMenu(), tambahkan card:
//       { id:"vocab-ai", icon:"🤖", label:"Generate dari Vocab", desc:"AI buat kalimat dari vocab kamu" }
//    3. Di sentence.js → mulai(mode), tambahkan:
//       else if (mode === "vocab-ai") { SentenceVocab.mulai(); return; }
// ================================================================

var SentenceVocab = {

  // ── CONFIG ───────────────────────────────────────────────────
  // URL Apps Script (doPost). API key Gemini tersimpan aman di Script Properties,
  // tidak ada di file JS ini — aman di-push ke GitHub.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxls_Di7DYdG4pvgYVAL89H9m6OLuPZMzlVGd199qCV6gZfY8L5g9ekflk8YV332yzN/exec",

  LEVEL_MAP: {
    "hsk1-2": { label: "HSK 1-2", grSheet: "Grhsk1" },
    "Hsk3":   { label: "HSK 3",   grSheet: "Grhsk3" },
    "Hsk4":   { label: "HSK 4",   grSheet: "Grhsk4" },
    "Hsk5":   { label: "HSK 5",   grSheet: "Grhsk5" },
  },

  _state: {
    levelDipilih: ["hsk1-2"],
    mode: "hanzi-indo",
    tampilan: "teks-audio",
    jawab: "ketik",
    total: 10,
    idx: 0,
    skor: { benar: 0, salah: 0 },
    vocabPool: [],
    grammarContoh: [],
    soalSaat: null,
    // Untuk chat tanya AI saat salah
    chatHistory: [],
    sedangChat: false,
  },

  // ── PARSE VOCAB ──────────────────────────────────────────────
  _parseKunci(raw) {
    if (!raw) return { hanzi: "", pinyin: "", arti: "" };
    const [bagian1, bagianArti] = raw.split("||").map(s => s.trim());
    const arti = bagianArti ? bagianArti.split(";")[0].trim() : "";
    if (bagian1 && bagian1.includes("/")) {
      const slash = bagian1.indexOf("/");
      return {
        hanzi:  bagian1.slice(0, slash).trim(),
        pinyin: bagian1.slice(slash + 1).trim(),
        arti,
      };
    }
    return { hanzi: (bagian1 || "").trim(), pinyin: "", arti };
  },

  async _ambilVocab(sheetIds) {
    const pool = [];
    for (const sheetId of sheetIds) {
      try {
        const raw = await DataMgr.fetchSheet(sheetId);
        if (!raw || !raw.length) continue;
        for (const r of raw) {
          const hanziRaw = r["Pertanyaan"] || r[0] || "";
          const kunciRaw = r["Kunci jawaban"] || r[1] || "";
          const artiRaw  = r["Translate"] || r[2] || "";
          const parsed   = this._parseKunci(kunciRaw);
          const hanzi    = parsed.hanzi || hanziRaw.trim();
          const pinyin   = parsed.pinyin;
          const arti     = parsed.arti || artiRaw.trim().split(";")[0];
          if (hanzi && arti && hanzi !== "Pertanyaan") {
            pool.push({ hanzi, pinyin, arti, level: sheetId });
          }
        }
      } catch (e) { console.warn("Gagal ambil vocab sheet", sheetId, e); }
    }
    return pool;
  },

  async _ambilGrammarContoh(levelSheetIds) {
    const contoh = [];
    for (const vSheet of levelSheetIds) {
      const grSheet = this.LEVEL_MAP[vSheet]?.grSheet;
      if (!grSheet) continue;
      try {
        const raw = await DataMgr.fetchSheet(grSheet);
        if (!raw) continue;
        for (const r of raw.slice(0, 8)) {
          const kalimat  = r["Kalimat"]     || r[1] || "";
          const arti     = r["Translateid"] || r[4] || "";
          const struktur = r["struktur"]    || r[5] || "";
          const explain  = r["Explain"]     || r[6] || "";
          const note     = r["Note"]        || r[7] || "";
          if (kalimat && struktur) {
            contoh.push({
              kalimat, arti,
              struktur: struktur.replace(/::/g, "").trim(),
              explain, note,
            });
          }
        }
      } catch (e) {}
    }
    return contoh;
  },

  // ── CALL GEMINI via APPS SCRIPT ──────────────────────────────
  // Kirim { prompt } ke Apps Script → diteruskan ke Gemini → balik teks.
  // API key Gemini aman di Script Properties, tidak terekspos di JS ini.
  async _callAI(messages, _maxTokens = 900) {
    // Gabung semua messages jadi satu prompt teks (Gemini single-turn lewat Apps Script)
    const prompt = messages.map(m => {
      const prefix = m.role === "assistant" ? "AI: " : "User: ";
      return prefix + m.content;
    }).join("\n\n");

    let resp;
    try {
      resp = await fetch(this.APPS_SCRIPT_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt }),
      });
    } catch (e) {
      throw new Error("Gagal terhubung ke server AI. Cek koneksi internet kamu.");
    }

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Server error ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();

    // Response Gemini: data.candidates[0].content.parts[0].text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) throw new Error("AI tidak menghasilkan teks. Coba lagi.");
    return text;
  },

  // ── GENERATE SOAL ────────────────────────────────────────────
  async _generateSoal(vocabPool, grammarContoh, mode) {
    const jumlah   = 3 + Math.floor(Math.random() * 3); // 3-5 vocab per kalimat
    const terpilih = acak(vocabPool).slice(0, jumlah);

    const vocabList = terpilih.map(v =>
      `- ${v.hanzi} (${v.pinyin || "?"}) = ${v.arti}`
    ).join("\n");

    const grCtx = grammarContoh.length > 0
      ? "\n\nContoh pola kalimat dari data grammar user:\n" +
        grammarContoh.slice(0, 6).map(g =>
          `- "${g.kalimat}" = "${g.arti}" [${g.struktur}]`
        ).join("\n")
      : "";

    const prompt = `Kamu adalah guru bahasa Mandarin HSK. Buat 1 kalimat Mandarin natural menggunakan minimal 2 kata dari daftar vocab berikut:

Vocab tersedia:
${vocabList}
${grCtx}

Aturan:
- Kalimat harus natural, sesuai level HSK vocab yang diberikan
- Gunakan minimal 2 vocab dari daftar di atas
- Jika ada pola grammar dari contoh di atas, boleh diikuti
- Untuk grammar yang tidak ada di contoh, gunakan grammar Mandarin standar (bisa dari pengetahuan umum)

Balas HANYA dengan JSON valid (tanpa markdown, tanpa komentar):
{
  "hanzi": "kalimat lengkap hanzi",
  "pinyin": "kalimat lengkap pinyin bertanda nada",
  "indonesia": "terjemahan bahasa Indonesia",
  "struktur": "pola grammar, contoh: Subj. + Verb + Obj.",
  "grammar_note": "penjelasan singkat grammar dalam bahasa Indonesia, 1-2 kalimat",
  "grammar_source": "dari_data_user" atau "grammar_umum",
  "breakdown": [
    { "hanzi": "kata/karakter", "pinyin": "pinyin", "arti": "arti", "dari_vocab": true }
  ],
  "vocab_dipakai": ["hanzi1", "hanzi2"]
}`;

    const rawText = await this._callAI([{ role: "user", content: prompt }]);

    let parsed;
    try {
      const clean = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch (e2) { throw new Error("Gagal parse JSON dari AI. Response: " + rawText.slice(0, 300)); }
      } else {
        throw new Error("Format JSON tidak ditemukan. Response: " + rawText.slice(0, 300));
      }
    }

    return { ...parsed, _vocabDipakai: terpilih };
  },

  // ── RENDER MENU ──────────────────────────────────────────────
  renderMenu() {
    const s = this._state;

    return `
      <div class="sv-menu-wrap">
        <div class="sv-header">
          <div class="sv-icon">🤖</div>
          <div>
            <div class="sv-title">Generate Kalimat dari Vocab</div>
            <div class="sv-subtitle">AI buat kalimat dari vocab HSK kamu</div>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">📚 Level HSK (bisa lebih dari satu):</div>
          <div class="sv-chips" id="sv-level-chips">
            ${Object.entries(this.LEVEL_MAP).map(([id, cfg]) => `
              <button class="sv-chip ${s.levelDipilih.includes(id) ? "aktif" : ""}"
                onclick="SentenceVocab._toggleLevel('${id}')">
                ${cfg.label}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔄 Mode Soal:</div>
          <div class="sv-chips">
            <button class="sv-chip ${s.mode === "hanzi-indo" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('mode','hanzi-indo',this)">
              🈯 Hanzi → Indonesia
            </button>
            <button class="sv-chip ${s.mode === "indo-hanzi" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('mode','indo-hanzi',this)">
              🔤 Indonesia → Hanzi
            </button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">👁️ Tampilkan Soal:</div>
          <div class="sv-chips">
            <button class="sv-chip ${s.tampilan === "teks" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('tampilan','teks',this)">📝 Teks</button>
            <button class="sv-chip ${s.tampilan === "audio" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('tampilan','audio',this)">🔊 Audio</button>
            <button class="sv-chip ${s.tampilan === "teks-audio" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('tampilan','teks-audio',this)">📝🔊 Teks+Audio</button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">✏️ Cara Menjawab:</div>
          <div class="sv-chips">
            <button class="sv-chip ${s.jawab === "ketik" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('jawab','ketik',this)">⌨️ Ketik</button>
            <button class="sv-chip ${s.jawab === "suara" ? "aktif" : ""}"
              onclick="SentenceVocab._setOpt('jawab','suara',this)">🎤 Suara</button>
          </div>
        </div>

        <div class="sv-section">
          <div class="sv-label">🔢 Jumlah Soal: <b id="sv-jumlah-label">${s.total}</b></div>
          <input type="range" min="3" max="20" value="${s.total}"
            oninput="SentenceVocab._setTotal(this.value)"
            style="width:100%;accent-color:#1565c0;margin-top:6px">
        </div>

        <div class="sv-section" style="padding:10px;background:#e8f5e9;border-radius:8px;border-left:3px solid #66bb6a">
          <div style="font-size:12px;color:#2e7d32">
            🔒 AI ditenagai <b>Gemini 2.5 Flash</b> via server — 
            tidak perlu input API key. Key tersimpan aman di server.
          </div>
        </div>

        <button class="btn btn-hijau" style="width:100%;margin-top:8px;font-size:15px;padding:12px"
          onclick="SentenceVocab.mulai()">
          🚀 Mulai Generate Kalimat
        </button>
        <button class="btn btn-abu" style="width:100%;margin-top:8px"
          onclick="SentenceVocab.kembaliMenu()">
          ← Kembali ke Menu Sentence
        </button>
      </div>
    `;
  },

  // ── OPTIONS ──────────────────────────────────────────────────
  _toggleLevel(id) {
    const s = this._state;
    const idx = s.levelDipilih.indexOf(id);
    if (idx >= 0) {
      if (s.levelDipilih.length === 1) { tampilToast("Pilih minimal 1 level!"); return; }
      s.levelDipilih.splice(idx, 1);
    } else {
      s.levelDipilih.push(id);
    }
    const chipsEl = document.getElementById("sv-level-chips");
    if (chipsEl) {
      chipsEl.innerHTML = Object.entries(this.LEVEL_MAP).map(([sid, cfg]) => `
        <button class="sv-chip ${s.levelDipilih.includes(sid) ? "aktif" : ""}"
          onclick="SentenceVocab._toggleLevel('${sid}')">
          ${cfg.label}
        </button>
      `).join("");
    }
  },

  _setOpt(key, val, btn) {
    this._state[key] = val;
    // Update tampilan chip aktif tanpa re-render penuh
    if (btn) {
      const group = btn.closest(".sv-chips");
      if (group) group.querySelectorAll(".sv-chip").forEach(b => b.classList.remove("aktif"));
      btn.classList.add("aktif");
    }
  },

  _setTotal(val) {
    this._state.total = parseInt(val);
    const lbl = document.getElementById("sv-jumlah-label");
    if (lbl) lbl.textContent = val;
  },



  // ── MULAI SESI ───────────────────────────────────────────────
  async mulai() {
    const s = this._state;
    s.idx   = 0;
    s.skor  = { benar: 0, salah: 0 };
    s.soalSaat = null;

    el("konten-utama").innerHTML = this._htmlLoading("Mengambil vocab dari spreadsheet...");

    try {
      const vocabPool = await this._ambilVocab(s.levelDipilih);
      if (vocabPool.length < 3) {
        tampilToast("Vocab terlalu sedikit! Pastikan sheet sudah di-import.");
        el("konten-utama").innerHTML = this.renderMenu();
        return;
      }
      s.vocabPool     = vocabPool;
      s.grammarContoh = await this._ambilGrammarContoh(s.levelDipilih);
      await this._nextSoal();
    } catch (e) {
      el("konten-utama").innerHTML = this._htmlError(e.message);
    }
  },

  async _nextSoal() {
    const s = this._state;
    if (s.idx >= s.total) { this._tampilSelesai(); return; }

    el("konten-utama").innerHTML = this._htmlLoading(`Generating soal ${s.idx + 1} dari ${s.total}...`);

    try {
      s.soalSaat    = await this._generateSoal(s.vocabPool, s.grammarContoh, s.mode);
      s.chatHistory = [];
      s.sedangChat  = false;
      this._tampilSoal();
    } catch (e) {
      el("konten-utama").innerHTML = `
        <div class="soal-wrap" style="text-align:center;padding:30px">
          <div style="font-size:36px">❌</div>
          <div style="color:#c62828;font-size:13px;margin:12px">${this._esc2(e.message)}</div>
          <div class="btn-row" style="justify-content:center">
            <button class="btn btn-hijau" onclick="SentenceVocab._nextSoal()">🔄 Coba Lagi</button>
            <button class="btn btn-abu" onclick="SentenceVocab.kembaliMenu()">← Menu</button>
          </div>
        </div>`;
    }
  },

  // ── TAMPIL SOAL ──────────────────────────────────────────────
  _tampilSoal() {
    const s        = this._state;
    const soal     = s.soalSaat;
    const mode     = s.mode;
    const tampilan = s.tampilan;
    const jawab    = s.jawab;

    const pct = Math.round((s.idx / s.total) * 100);
    const header = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${s.idx + 1} / ${s.total}</div>
        <div class="skor-mini" id="sv-skor-mini">✅ ${s.skor.benar} ❌ ${s.skor.salah}</div>
      </div>
      <div class="progres-bar">
        <div class="progres-fill" style="width:${pct}%"></div>
      </div>`;

    // Vocab badges
    const vocabBadges = (soal._vocabDipakai || []).map(v =>
      `<span class="sv-vocab-badge">${v.hanzi}
        ${v.pinyin ? `<span class="sv-pinyin">${v.pinyin}</span>` : ""}
        = ${v.arti}
      </span>`
    ).join("");

    // Konten soal
    let soalKonten = "";
    const hanziEsc = this._esc(soal.hanzi);
    const indoEsc  = this._esc(soal.indonesia);

    if (mode === "hanzi-indo") {
      const showTeks  = tampilan !== "audio";
      const showAudio = tampilan !== "teks";
      soalKonten = `
        <div class="label-mode">🈯 Hanzi → Indonesia</div>
        ${showTeks ? `<div class="soal-kalimat">${soal.hanzi}</div>
          <div class="soal-pinyin-hint">${soal.pinyin || ""}</div>` : ""}
        ${showAudio ? `<div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.mandarin('${hanziEsc}')">🔊 Putar Audio</button>
        </div>` : ""}
        <div class="soal-hint">Terjemahkan ke bahasa Indonesia:</div>`;
    } else {
      const showAudio = tampilan !== "teks";
      soalKonten = `
        <div class="label-mode">🔤 Indonesia → Hanzi</div>
        <div class="soal-kalimat indo">${soal.indonesia}</div>
        ${showAudio ? `<div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TTS.indonesia('${indoEsc}')">🔊 Dengarkan</button>
        </div>` : ""}
        <div class="soal-hint">Tulis kalimat di atas dalam Hanzi:</div>`;
    }

    // Input area
    const inputArea = jawab === "ketik"
      ? `<textarea id="sv-input-jawab" class="input-jawab" rows="3"
           placeholder="${mode === "hanzi-indo" ? "Tulis terjemahan Indonesia..." : "Tulis kalimat Hanzi..."}"></textarea>`
      : `<div class="hasil-box" id="sv-hasil-suara">Tekan mic lalu jawab...</div>`;

    const tombol = jawab === "ketik"
      ? `<div class="btn-row">
          <button class="btn btn-hijau" onclick="SentenceVocab._jawabKetik()">✅ Submit</button>
          <button class="btn btn-kuning" onclick="SentenceVocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="SentenceVocab.kembaliMenu()">← Menu</button>
        </div>`
      : `<div class="btn-row">
          <button class="btn btn-merah" id="sv-btn-mic" onclick="SentenceVocab._jawabSuara()">🎤 Mulai Bicara</button>
          <button class="btn btn-kuning" onclick="SentenceVocab._skip()">⏭ Skip</button>
          <button class="btn btn-abu" onclick="SentenceVocab.kembaliMenu()">← Menu</button>
        </div>`;

    el("konten-utama").innerHTML = `
      ${header}
      <div class="soal-wrap">
        ${soalKonten}
        ${inputArea}
        <div class="hasil-box" id="sv-hasil-box"></div>
        <div class="sv-vocab-info">
          <div class="sv-vocab-label">📚 Vocab dalam soal ini:</div>
          <div class="sv-vocab-badges">${vocabBadges}</div>
        </div>
        ${tombol}
      </div>`;

    // Auto-play audio
    if (tampilan === "audio" || tampilan === "teks-audio") {
      if (mode === "hanzi-indo") setTimeout(() => TTS.mandarin(soal.hanzi), 500);
    }

    // Focus textarea
    setTimeout(() => { const inp = el("sv-input-jawab"); if (inp) inp.focus(); }, 100);

    // Enter to submit
    setTimeout(() => {
      const inp = el("sv-input-jawab");
      if (inp) {
        inp.addEventListener("keydown", e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            SentenceVocab._jawabKetik();
          }
        });
      }
    }, 150);
  },

  // ── JAWAB: KETIK ─────────────────────────────────────────────
  _jawabKetik() {
    const inp   = el("sv-input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) { tampilToast("Tulis jawaban dulu!"); return; }

    const soal  = this._state.soalSaat;
    const mode  = this._state.mode;
    let benar   = false;
    let kunci   = "";

    if (mode === "hanzi-indo") {
      kunci = soal.indonesia;
      benar = cekJawaban(input, soal.indonesia);
    } else {
      kunci = soal.hanzi;
      benar = input.replace(/\s/g, "") === soal.hanzi.replace(/\s/g, "");
    }

    if (benar) this._state.skor.benar++;
    else this._state.skor.salah++;
    if (inp) inp.disabled = true;

    this._tampilHasil(benar, kunci, soal, input);
  },

  // ── JAWAB: SUARA ─────────────────────────────────────────────
  _jawabSuara() {
    const soal   = this._state.soalSaat;
    const mode   = this._state.mode;
    const btnMic = el("sv-btn-mic");
    const hasilEl = el("sv-hasil-suara");

    if (btnMic) { btnMic.disabled = true; btnMic.textContent = "🎙️ Mendengarkan..."; }

    const lang   = mode === "hanzi-indo" ? "id-ID" : "zh-CN";
    const target = mode === "hanzi-indo" ? soal.indonesia : soal.hanzi;

    STT.mulai(lang,
      (hasil, semua) => {
        const cln  = s => s.replace(/[。，！？\s,.!?]/g, "").toLowerCase();
        const benar = semua.some(h => cln(h).includes(cln(target)) || cln(target).includes(cln(h)));
        if (benar) this._state.skor.benar++;
        else this._state.skor.salah++;
        if (btnMic) btnMic.textContent = "✔ Selesai";
        this._tampilHasil(benar, target, soal, hasil);
      },
      err => {
        if (hasilEl) hasilEl.textContent = "❌ Error mic: " + err;
        if (btnMic) { btnMic.disabled = false; btnMic.textContent = "🎤 Coba Lagi"; }
      },
      dapat => {
        if (!dapat) {
          if (hasilEl) hasilEl.textContent = "⚠️ Tidak terdeteksi, coba lagi.";
          if (btnMic) { btnMic.disabled = false; btnMic.textContent = "🎤 Coba Lagi"; }
        }
      }
    );
  },

  // ── TAMPIL HASIL + BREAKDOWN + GRAMMAR ───────────────────────
  _tampilHasil(benar, kunci, soal, inputUser) {
    const hEl = el("sv-hasil-box");
    if (!hEl) return;

    hEl.className = "hasil-box " + (benar ? "benar" : "salah");

    // Breakdown vocab
    const breakdownHtml = (soal.breakdown || []).map(b => `
      <div class="sv-breakdown-item ${b.dari_vocab ? "sv-vocab-highlight" : ""}">
        <span class="sv-bd-hanzi">${b.hanzi}</span>
        <span class="sv-bd-pinyin">${b.pinyin || ""}</span>
        <span class="sv-bd-arti">${b.arti}</span>
        ${b.dari_vocab ? '<span class="sv-bd-tag">📚 vocab</span>' : ""}
      </div>
    `).join("");

    // Label sumber grammar
    const grSumber = soal.grammar_source === "dari_data_user"
      ? '<span style="font-size:11px;color:#388e3c;background:#e8f5e9;padding:2px 6px;border-radius:4px">📂 dari data kamu</span>'
      : '<span style="font-size:11px;color:#1565c0;background:#e3f2fd;padding:2px 6px;border-radius:4px">🌐 grammar umum</span>';

    hEl.innerHTML = `
      ${benar
        ? `<div class="sv-hasil-status sv-benar-status">✅ Benar! Bagus sekali!</div>`
        : `<div class="sv-hasil-status sv-salah-status">❌ Kurang tepat.</div>
           <div class="sv-hasil-kunci">Jawaban: <b>${kunci}</b></div>
           ${inputUser ? `<div style="font-size:12px;color:#78909c;margin-top:4px">Jawabanmu: "${this._esc2(inputUser)}"</div>` : ""}`
      }

      <div class="sv-info-kalimat">
        <div class="sv-info-row"><b>🈯 Hanzi:</b>
          ${soal.hanzi}
          <button class="btn-audio-kecil" onclick="TTS.mandarin('${this._esc(soal.hanzi)}')">🔊</button>
        </div>
        <div class="sv-info-row"><b>🔤 Pinyin:</b> ${soal.pinyin || "-"}</div>
        <div class="sv-info-row"><b>🇮🇩 Indonesia:</b> ${soal.indonesia}</div>
        ${soal.struktur ? `<div class="sv-info-row">
          <b>📐 Struktur:</b> <span class="sv-struktur">${soal.struktur}</span> ${grSumber}
        </div>` : ""}
        ${soal.grammar_note ? `<div class="sv-info-row">
          <b>💡 Grammar:</b> ${soal.grammar_note}
        </div>` : ""}
      </div>

      ${breakdownHtml ? `
      <div class="sv-breakdown-wrap">
        <div class="sv-bd-title">📖 Breakdown Kata:</div>
        <div class="sv-breakdown-list">${breakdownHtml}</div>
      </div>` : ""}

      ${!benar ? `
      <div class="sv-tanya-wrap" id="sv-tanya-wrap">
        <div class="sv-tanya-title">🤔 Ada yang ingin ditanyakan ke AI?</div>
        <div class="sv-chat-area" id="sv-chat-area"></div>
        <div class="sv-tanya-input-row">
          <input type="text" id="sv-tanya-input"
            placeholder="Contoh: kenapa pakai 在 bukan 是 di sini?"
            style="flex:1;padding:8px 10px;border:1.5px solid #b0bec5;border-radius:8px;font-size:13px"
            onkeydown="if(event.key==='Enter')SentenceVocab._kirimTanya()">
          <button class="btn btn-biru" style="padding:8px 12px;font-size:13px"
            onclick="SentenceVocab._kirimTanya()">💬 Tanya</button>
        </div>
      </div>` : ""}

      <div class="btn-row" style="margin-top:12px" id="sv-btn-lanjut-wrap">
        <button class="btn btn-biru" onclick="SentenceVocab._lanjut()">→ Soal Berikutnya</button>
        <button class="btn btn-abu" onclick="SentenceVocab.kembaliMenu()">← Menu</button>
      </div>
    `;

    // Update skor
    const skorMini = el("sv-skor-mini");
    if (skorMini) skorMini.innerHTML = `✅ ${this._state.skor.benar} ❌ ${this._state.skor.salah}`;

    // Auto TTS kalimat benar
    setTimeout(() => TTS.mandarin(soal.hanzi), 400);
  },

  // ── TANYA AI SAAT SALAH ──────────────────────────────────────
  async _kirimTanya() {
    const inputEl = el("sv-tanya-input");
    const pertanyaan = inputEl ? inputEl.value.trim() : "";
    if (!pertanyaan) return;
    if (this._state.sedangChat) { tampilToast("AI sedang menjawab..."); return; }

    const soal = this._state.soalSaat;
    if (!soal) return;

    inputEl.value = "";
    inputEl.disabled = true;
    this._state.sedangChat = true;

    // Tampilkan pertanyaan di chat area
    this._appendChat("user", pertanyaan);
    this._appendChat("ai", "⏳ Sedang berpikir...", "sv-chat-ai-loading");

    // Bangun konteks untuk AI
    const konteksSoal = `
Kalimat Mandarin: ${soal.hanzi}
Pinyin: ${soal.pinyin || "-"}
Terjemahan: ${soal.indonesia}
Struktur grammar: ${soal.struktur || "-"}
Penjelasan grammar: ${soal.grammar_note || "-"}
Breakdown: ${(soal.breakdown || []).map(b => `${b.hanzi}(${b.pinyin})=${b.arti}`).join(", ")}
    `.trim();

    // Bangun history pesan untuk multi-turn
    const systemMsg = {
      role: "user",
      content: `Kamu adalah guru bahasa Mandarin yang ramah dan sabar. 
Seorang siswa sedang belajar kalimat Mandarin berikut dan punya pertanyaan:

${konteksSoal}

Jawab pertanyaan siswa dengan bahasa Indonesia, singkat dan jelas. 
Jika perlu contoh, berikan 1-2 contoh kalimat pendek.`,
    };

    // Bangun messages array (multi-turn)
    const messages = [systemMsg];
    for (const h of this._state.chatHistory) {
      messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
    }
    messages.push({ role: "user", content: pertanyaan });

    try {
      const jawaban = await this._callAI(messages, 500);

      // Simpan ke history
      this._state.chatHistory.push({ role: "user", text: pertanyaan });
      this._state.chatHistory.push({ role: "ai",   text: jawaban });

      // Update tampilan
      this._updateChatAILoading(jawaban);
    } catch (e) {
      this._updateChatAILoading("❌ Gagal terhubung ke AI: " + e.message);
    }

    if (inputEl) inputEl.disabled = false;
    this._state.sedangChat = false;
    setTimeout(() => { if (inputEl) inputEl.focus(); }, 100);
  },

  _appendChat(role, teks, extraClass = "") {
    const area = el("sv-chat-area");
    if (!area) return;
    const div = document.createElement("div");
    div.className = `sv-chat-bubble sv-chat-${role} ${extraClass}`;
    div.innerHTML = role === "ai"
      ? `<span class="sv-chat-label">🤖 AI Guru:</span> ${this._esc2(teks)}`
      : `<span class="sv-chat-label">👤 Kamu:</span> ${this._esc2(teks)}`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  _updateChatAILoading(teks) {
    const area = el("sv-chat-area");
    if (!area) return;
    const loading = area.querySelector(".sv-chat-ai-loading");
    if (loading) {
      loading.className = "sv-chat-bubble sv-chat-ai";
      loading.innerHTML = `<span class="sv-chat-label">🤖 AI Guru:</span> ${this._esc2(teks)}`;
    } else {
      this._appendChat("ai", teks);
    }
    area.scrollTop = area.scrollHeight;
  },

  // ── SKIP ─────────────────────────────────────────────────────
  _skip() {
    const soal = this._state.soalSaat;
    this._state.skor.salah++;
    const hEl = el("sv-hasil-box");
    if (hEl) {
      hEl.className = "hasil-box salah";
      hEl.innerHTML = `⏭ Di-skip.<br>Kalimat: <b>${soal.hanzi}</b> = ${soal.indonesia}`;
    }
    setTimeout(() => this._lanjut(), 1800);
  },

  _lanjut() {
    this._state.idx++;
    this._nextSoal();
  },

  // ── SELESAI ──────────────────────────────────────────────────
  _tampilSelesai() {
    const s   = this._state;
    const pct = s.total ? Math.round((s.skor.benar / s.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    const levelLabel = s.levelDipilih.map(id => this.LEVEL_MAP[id]?.label || id).join(", ");

    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Sesi Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${s.skor.benar}</b></div>
          <div>❌ Salah: <b>${s.skor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div style="font-size:13px;color:#546e7a;margin:12px 0">
          Level: ${levelLabel} · ${s.total} soal
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px">
          <button class="btn btn-hijau" onclick="SentenceVocab.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="SentenceVocab.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  // ── HELPERS ──────────────────────────────────────────────────
  _htmlLoading(pesan) {
    return `
      <div style="text-align:center;padding:60px 20px">
        <div class="sv-spinner"></div>
        <div style="margin-top:16px;color:#546e7a;font-size:14px">${pesan}</div>
      </div>`;
  },

  _htmlError(msg) {
    return `
      <div class="soal-wrap" style="text-align:center;padding:30px">
        <div style="font-size:40px">⚠️</div>
        <div style="color:#c62828;margin:12px 0;font-size:14px">${this._esc2(msg)}</div>
        <button class="btn btn-abu" onclick="SentenceVocab.kembaliMenu()">← Kembali</button>
      </div>`;
  },

  kembaliMenu() {
    TTS.berhenti();
    if (window.STT) STT.berhenti();
    App.renderModul("sentence");
  },

  // Escape untuk atribut HTML (onclick strings)
  _esc(s) { return (s || "").replace(/'/g, "\\'").replace(/\n/g, " "); },

  // Escape untuk konten HTML
  _esc2(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  },
};

// ── CSS tambahan ──────────────────────────────────────────────
(function _injectCSS() {
  if (document.getElementById("sv-styles")) return;
  const style = document.createElement("style");
  style.id = "sv-styles";
  style.textContent = `
    /* ── SentenceVocab Layout ── */
    .sv-menu-wrap { padding: 8px 0 20px; }
    .sv-header { display:flex; align-items:center; gap:14px; margin-bottom:16px; padding:14px; background:#e3f2fd; border-radius:12px; }
    .sv-icon { font-size:32px; }
    .sv-title { font-size:16px; font-weight:700; color:#1565c0; }
    .sv-subtitle { font-size:12px; color:#546e7a; }

    .sv-section { margin-bottom:14px; }
    .sv-label { font-size:13px; font-weight:600; color:#37474f; margin-bottom:8px; }

    .sv-chips { display:flex; flex-wrap:wrap; gap:8px; }
    .sv-chip {
      padding:7px 14px; border-radius:20px; font-size:13px; font-weight:500;
      border:1.5px solid #b0bec5; background:#fff; color:#546e7a; cursor:pointer;
      transition:all .15s;
    }
    .sv-chip.aktif { background:#1565c0; color:#fff; border-color:#1565c0; }
    .sv-chip:hover:not(.aktif) { background:#e3f2fd; border-color:#90caf9; }

    /* ── Vocab Info di soal ── */
    .sv-vocab-info { margin:10px 0; padding:10px; background:#f5f5f5; border-radius:8px; }
    .sv-vocab-label { font-size:12px; font-weight:600; color:#546e7a; margin-bottom:6px; }
    .sv-vocab-badges { display:flex; flex-wrap:wrap; gap:6px; }
    .sv-vocab-badge {
      background:#e3f2fd; color:#1565c0; border-radius:6px;
      padding:3px 8px; font-size:12px; border:1px solid #90caf9;
    }
    .sv-pinyin { color:#0277bd; font-size:11px; margin:0 3px; }

    /* ── Info kalimat setelah jawab ── */
    .sv-info-kalimat { margin:10px 0; padding:10px; background:#f9fbe7; border-radius:8px; border-left:3px solid #aed581; }
    .sv-info-row { font-size:13px; margin:4px 0; line-height:1.5; }
    .sv-struktur { background:#fff3e0; color:#e65100; padding:2px 8px; border-radius:4px; font-size:12px; }

    /* ── Breakdown ── */
    .sv-breakdown-wrap { margin:10px 0; }
    .sv-bd-title { font-size:12px; font-weight:600; color:#546e7a; margin-bottom:6px; }
    .sv-breakdown-list { display:flex; flex-wrap:wrap; gap:6px; }
    .sv-breakdown-item {
      display:flex; flex-direction:column; align-items:center;
      padding:6px 10px; background:#fff; border:1px solid #e0e0e0;
      border-radius:8px; font-size:12px; min-width:52px; text-align:center;
    }
    .sv-breakdown-item.sv-vocab-highlight { background:#e8f5e9; border-color:#a5d6a7; }
    .sv-bd-hanzi { font-size:20px; line-height:1.2; color:#37474f; }
    .sv-bd-pinyin { font-size:11px; color:#0277bd; }
    .sv-bd-arti { font-size:11px; color:#546e7a; }
    .sv-bd-tag { font-size:10px; color:#388e3c; background:#e8f5e9; padding:1px 4px; border-radius:3px; margin-top:2px; }

    /* ── Status hasil ── */
    .sv-hasil-status { font-size:15px; font-weight:600; margin-bottom:8px; }
    .sv-benar-status { color:#2e7d32; }
    .sv-salah-status { color:#c62828; }
    .sv-hasil-kunci { font-size:13px; color:#37474f; margin-bottom:4px; }

    /* ── Tombol audio kecil ── */
    .btn-audio-kecil {
      background:none; border:none; cursor:pointer; font-size:16px;
      padding:2px 4px; vertical-align:middle; opacity:.7;
    }
    .btn-audio-kecil:hover { opacity:1; }

    /* ── Chat tanya AI ── */
    .sv-tanya-wrap {
      margin:12px 0; padding:12px; background:#f3e5f5;
      border-radius:10px; border:1px solid #ce93d8;
    }
    .sv-tanya-title { font-size:13px; font-weight:600; color:#6a1b9a; margin-bottom:8px; }
    .sv-chat-area {
      max-height:180px; overflow-y:auto; margin-bottom:8px;
      display:flex; flex-direction:column; gap:6px;
    }
    .sv-chat-bubble {
      padding:7px 10px; border-radius:8px; font-size:13px; line-height:1.5; max-width:95%;
    }
    .sv-chat-user { background:#e3f2fd; color:#1565c0; align-self:flex-end; text-align:right; }
    .sv-chat-ai { background:#fff; color:#37474f; border:1px solid #e0e0e0; align-self:flex-start; }
    .sv-chat-ai-loading { opacity:.6; }
    .sv-chat-label { font-weight:600; font-size:11px; display:block; margin-bottom:2px; }
    .sv-tanya-input-row { display:flex; gap:8px; }

    /* ── Spinner ── */
    .sv-spinner {
      width:36px; height:36px; border:4px solid #e3f2fd;
      border-top-color:#1565c0; border-radius:50%;
      animation:sv-spin .8s linear infinite; margin:0 auto;
    }
    @keyframes sv-spin { to { transform:rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();


