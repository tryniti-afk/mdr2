// ================================================================
//  TRANSLATEIN.JS — Fitur "Translate In" di modul Sentence
//    - Audio saja (tanpa hanzi), mulai dari kecepatan lambat
//    - Soal PEMAHAMAN (bukan terjemahan literal): "apa yang terjadi",
//      "siapa yang bicara", dst — via Gemini, generate on-the-fly
//    - Jawab pilihan ganda ATAU ketik bebas (dinilai maknanya oleh AI)
//    - Benar → kecepatan naik ke step berikutnya; Salah → tetap/turun
//    - Setelah jawab: baru tampil teks hanzi + terjemahan
// ================================================================

var TranslateIn = {
  speedSteps: [0.75, 0.85, 1.0, 1.1],
  speedIdx: 0,
  jawabMode: "pilihan",     // "pilihan" | "ketik"
  jumlah: 6,
  idx: 0,
  total: 0,
  skor: { benar: 0, salah: 0 },
  soalSaat: null,
  _sedang: false,

  buka() { el("konten-utama").innerHTML = this.renderSetup(); },

  renderSetup() {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎧 Translate In — Pemahaman Cerita</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">Dengar audio TANPA teks. Jawab pertanyaan pemahaman, bukan artikan kata per kata. Kecepatan naik kalau kamu benar.</div>

        <div style="font-weight:700;margin:10px 0 6px">Tahapan Kecepatan</div>
        <div class="sub-menu-grid">
          <div class="sub-card ${this._speedPreset===0?"sub-card-aktif":""}" onclick="TranslateIn._pilihPreset(0)">
            <div class="sub-label">Standar</div><div class="sub-desc">0.75 → 0.85 → 1.0 → 1.1</div></div>
          <div class="sub-card ${this._speedPreset===1?"sub-card-aktif":""}" onclick="TranslateIn._pilihPreset(1)">
            <div class="sub-label">Landai</div><div class="sub-desc">0.7 → 0.8 → 0.9 → 1.0 → 1.1</div></div>
        </div>
        <div style="margin-top:8px">
          <label style="font-size:12px;color:#777">Custom (pisah koma, mis. 0.75,0.9,1.1):</label>
          <input type="text" id="ti-custom-speed" class="input-teks" value="${this.speedSteps.join(",")}"
                 onchange="TranslateIn._pilihCustom(this.value)">
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Cara Jawab</div>
        <div class="sub-menu-grid">
          <div class="sub-card ${this.jawabMode==="pilihan"?"sub-card-aktif":""}" onclick="TranslateIn._pilihJawab('pilihan')">
            <div class="sub-label">Pilihan Ganda</div></div>
          <div class="sub-card ${this.jawabMode==="ketik"?"sub-card-aktif":""}" onclick="TranslateIn._pilihJawab('ketik')">
            <div class="sub-label">Ketik Bebas</div></div>
        </div>

        <div style="font-weight:700;margin:14px 0 6px">Jumlah Soal</div>
        <div class="sub-menu-grid">
          ${[4,6,8].map(n => `<div class="sub-card ${this.jumlah===n?"sub-card-aktif":""}" onclick="TranslateIn._pilihJumlah(${n})"><div class="sub-label">${n} soal</div></div>`).join("")}
        </div>

        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-hijau" onclick="TranslateIn.mulai()">▶ Mulai</button>
          <button class="btn btn-abu" onclick="Sentence.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },
  _speedPreset: 0,
  _pilihPreset(i) {
    this._speedPreset = i;
    this.speedSteps = i === 0 ? [0.75, 0.85, 1.0, 1.1] : [0.7, 0.8, 0.9, 1.0, 1.1];
    el("konten-utama").innerHTML = this.renderSetup();
  },
  _pilihCustom(val) {
    const arr = val.split(",").map(x => parseFloat(x.trim())).filter(x => !isNaN(x) && x > 0.4 && x < 2);
    if (arr.length) { this.speedSteps = arr; this._speedPreset = -1; }
  },
  _pilihJawab(m) { this.jawabMode = m; el("konten-utama").innerHTML = this.renderSetup(); },
  _pilihJumlah(n) { this.jumlah = n; el("konten-utama").innerHTML = this.renderSetup(); },

  // ── MULAI ────────────────────────────────────────────────────
  async mulai() {
    if (!GeminiAPI.getKey()) {
      const k = prompt("Masukkan Gemini API key (dipakai juga oleh fitur AI lain):");
      if (k) GeminiAPI.setKey(k); else { tampilToast("⚠️ Perlu API key Gemini untuk fitur ini."); return; }
    }
    this.speedIdx = 0;
    this.idx = 0; this.total = 0; this.skor = { benar: 0, salah: 0 };
    this._pool = await this._ambilPool();
    if (!this._pool.length) { tampilToast("⚠️ Data teks kosong."); this.buka(); return; }
    this._nextSoal();
  },

  async _ambilPool() {
    const arr = [];
    try {
      const s = await SetSoal.getSoalSiap("sentence");
      if (s && s.length) s.forEach(x => arr.push({ teks: x.hanzi, arti: x.arti || "" }));
    } catch (e) {}
    if (typeof DB !== "undefined") {
      (DB.sentences || []).forEach(s => arr.push({ teks: s.hanzi, arti: s.arti }));
      (DB.passages || []).forEach(p => arr.push({ teks: p.teks, arti: p.terjemahan }));
    }
    return acak(arr);
  },

  // ── GENERATE SOAL PEMAHAMAN VIA GEMINI ──────────────────────
  async _nextSoal() {
    if (this.idx >= this.jumlah) { this._selesai(); return; }
    setHTML("konten-utama", `<div class="soal-wrap"><div class="label-mode">🎧 Translate In</div><div class="soal-teks-indo">Menyiapkan soal ${this.idx+1}/${this.jumlah}...</div></div>`);
    const sumber = this._pool[this.idx % this._pool.length];
    try {
      const prompt = `Kamu guru bahasa Mandarin. Berikut teks Mandarin (bisa 1 kalimat atau cerita pendek):
"${sumber.teks}"
Terjemahan referensinya: "${sumber.arti || "(buat terjemahan sendiri yang natural)"}"

Buat 1 soal PEMAHAMAN (bukan minta menerjemahkan kata per kata) tentang ISI teks ini — misalnya "apa yang terjadi", "siapa yang berbicara/melakukan sesuatu", "kapan/di mana", dsb. Sertakan 4 pilihan jawaban singkat dalam Bahasa Indonesia (hanya 1 benar).

Balas HANYA JSON valid, tanpa markdown:
{
  "pertanyaan": "...",
  "pilihan": ["...","...","...","..."],
  "jawabanIdx": 0,
  "hanzi": "${sumber.teks.replace(/"/g,'\\"')}",
  "arti": "terjemahan lengkap teks dalam Bahasa Indonesia"
}`;
      const soal = await GeminiAPI.callJSON(prompt, 700);
      this.soalSaat = soal;
      this._tampilSoal();
    } catch (e) {
      tampilToast("❌ Gagal membuat soal: " + e.message);
      this.idx++; this._nextSoal();
    }
  },

  _tampilSoal() {
    this._sedang = false;
    const speed = this.speedSteps[this.speedIdx];
    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="soal-header">
          <div class="progres-teks">Soal ${this.idx + 1}/${this.jumlah}</div>
          <div class="skor-mini" id="skor-mini">✅ ${this.skor.benar} ❌ ${this.skor.salah}</div>
        </div>
        <div class="label-mode">🎧 Dengar baik-baik (kecepatan ${speed}x)</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" onclick="TranslateIn._putar()">🔊 Putar Audio (${speed}x)</button>
        </div>
        <div class="soal-teks-indo" style="font-style:italic">Teks disembunyikan sampai kamu menjawab.</div>

        <div style="margin-top:14px">
          <div style="font-weight:700;margin-bottom:8px">${this.soalSaat.pertanyaan}</div>
          ${this.jawabMode === "pilihan" ? `
            <div class="pilihan-list" id="ti-pilihan-cont">
              ${this.soalSaat.pilihan.map((p, i) => `<button class="btn-pilihan-full" onclick="TranslateIn._jawabPilihan(${i})">${p}</button>`).join("")}
            </div>` : `
            <textarea id="ti-input" class="input-teks" rows="3" placeholder="Ketik jawabanmu (boleh bahasa sendiri, yang penting maksudnya)..."></textarea>
            <button class="btn btn-hijau" style="width:100%;margin-top:8px" onclick="TranslateIn._jawabKetik()">✅ Submit</button>`}
        </div>
        <div class="hasil-box" id="hasil-ti" style="display:none"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-abu" onclick="TranslateIn.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
    setTimeout(() => this._putar(), 350);
  },

  _putar() { TTS.bicara(this.soalSaat.hanzi, "zh-CN", this.speedSteps[this.speedIdx]); },

  _jawabPilihan(i) {
    if (this._sedang) return;
    this._sedang = true;
    const benar = i === this.soalSaat.jawabanIdx;
    this._tandaiPilihan(i, benar);
    this._prosesJawaban(benar, this.soalSaat.pilihan[i]);
  },
  _tandaiPilihan(dipilih, benar) {
    el("ti-pilihan-cont")?.querySelectorAll(".btn-pilihan-full").forEach((b, i) => {
      b.disabled = true;
      if (i === this.soalSaat.jawabanIdx) b.classList.add("pilihan-benar");
      else if (i === dipilih && !benar) b.classList.add("pilihan-salah");
    });
  },

  async _jawabKetik() {
    if (this._sedang) return;
    const inp = el("ti-input");
    const jawabanUser = (inp?.value || "").trim();
    if (!jawabanUser) return;
    this._sedang = true;
    if (inp) inp.disabled = true;
    const hEl = el("hasil-ti");
    hEl.style.display = "block"; hEl.className = "hasil-box info";
    hEl.innerHTML = "🤖 Memeriksa maksud jawabanmu...";
    const jawabanBenar = this.soalSaat.pilihan[this.soalSaat.jawabanIdx];
    try {
      const prompt = `Pertanyaan pemahaman: "${this.soalSaat.pertanyaan}"
Jawaban benar (referensi): "${jawabanBenar}"
Jawaban siswa (bebas, boleh Indonesia/Mandarin campur): "${jawabanUser}"

Nilai apakah MAKNA jawaban siswa sudah sesuai jawaban referensi meskipun beda kata-kata. Jika susunan/urutan info dalam jawaban siswa terbalik atau membingungkan, sebutkan itu di feedback.
Balas HANYA JSON valid: {"benar": true/false, "feedback": "1-2 kalimat penjelasan singkat dalam Bahasa Indonesia"}`;
      const hasil = await GeminiAPI.callJSON(prompt, 300);
      this._prosesJawaban(!!hasil.benar, jawabanUser, hasil.feedback);
    } catch (e) {
      hEl.innerHTML = `⚠️ Gagal menilai otomatis: ${e.message}. Jawaban referensi: <b>${jawabanBenar}</b>`;
      this._prosesJawaban(false, jawabanUser, null, true);
    }
  },

  _prosesJawaban(benar, jawabanDipilih, feedbackAI, skipHasilBox) {
    this.total++;
    if (benar) { this.skor.benar++; this.speedIdx = Math.min(this.speedSteps.length - 1, this.speedIdx + 1); }
    else { this.skor.salah++; this.speedIdx = Math.max(0, this.speedIdx - 1); }

    if (!skipHasilBox) {
      const hEl = el("hasil-ti");
      hEl.style.display = "block";
      hEl.className = "hasil-box " + (benar ? "benar" : "salah");
      hEl.innerHTML = `
        ${benar ? "✅ Benar!" : "❌ Kurang tepat."} ${feedbackAI ? `<br><i>${feedbackAI}</i>` : ""}
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.1)">
          <div class="soal-kalimat" style="font-size:20px">${this.soalSaat.hanzi}</div>
          <div class="soal-teks-indo">${this.soalSaat.arti}</div>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#777">Kecepatan berikutnya: <b>${this.speedSteps[this.speedIdx]}x</b></div>`;
    }
    setHTML("skor-mini", `✅ ${this.skor.benar} ❌ ${this.skor.salah}`);
    setTimeout(() => { this.idx++; this._nextSoal(); }, 4200);
  },

  _selesai() {
    const pct = this.total ? Math.round((this.skor.benar / this.total) * 100) : 0;
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "💪";
    App.catatSesiSelesai("sentence", this.skor.benar, this.total);
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${emoji}</div>
        <h2>Translate In Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${this.skor.benar}</b></div>
          <div>❌ Salah: <b>${this.skor.salah}</b></div>
          <div>🚀 Kecepatan akhir: <b>${this.speedSteps[this.speedIdx]}x</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="TranslateIn.mulai()">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="TranslateIn.kembaliMenu()">← Menu Sentence</button>
        </div>
      </div>`;
  },
  kembaliMenu() { TTS.berhenti(); STT.berhenti(); Sentence.kembaliMenu(); },
};
