// ================================================================
//  PITCH.JS — Utilitas bersama untuk fitur-fitur baru:
//    • Deteksi pitch dari mic (autocorrelation) → grafik kontur nada
//    • Kontur nada "ideal" dari pinyin (nada 1-4 + netral)
//    • Render grafik SVG overlay (nada kamu vs nada standar)
//    • Panggilan generik ke Gemini API (dipakai fitur AI baru)
//
//  Dipakai oleh: tone.js, shadow.js, vocabextra.js, translatein.js
// ================================================================

// ── GEMINI — HELPER PANGGILAN UMUM ───────────────────────────
// Pakai API key yang sama dengan yang sudah dipakai SentenceVocab
// (tersimpan di localStorage "gemini_api_key"), supaya user cuma
// perlu isi key itu sekali saja di seluruh aplikasi.
var GeminiAPI = {
  URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",

  getKey() { return localStorage.getItem("gemini_api_key") || ""; },
  setKey(k) { localStorage.setItem("gemini_api_key", (k || "").trim()); },

  // Panggil Gemini dengan 1 prompt teks, kembalikan teks jawaban.
  async call(prompt, maxTokens = 700) {
    const apiKey = this.getKey();
    if (!apiKey) throw new Error("API key Gemini belum diisi. Masukkan API key dulu (menu fitur AI lain juga pakai key yang sama).");
    let resp;
    try {
      resp = await fetch(`${this.URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.6 },
        }),
      });
    } catch (e) {
      throw new Error("Gagal terhubung ke Gemini API. Cek koneksi internet kamu.");
    }
    if (!resp.ok) {
      let msg = `Gemini error ${resp.status}`;
      try { const d = await resp.json(); msg = d?.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) throw new Error("AI tidak menghasilkan teks. Coba lagi.");
    return text;
  },

  // Panggil Gemini dan harapkan balasan JSON murni (dibersihkan dari markdown fence).
  async callJSON(prompt, maxTokens = 700) {
    const raw = await this.call(prompt, maxTokens);
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : cleaned);
  },

  esc2(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  }
};

// ── TONE UTIL — parsing pinyin & kontur nada ideal ───────────
const TONE_CHAR_MAP = {
  "ā":1,"á":2,"ǎ":3,"à":4,
  "ē":1,"é":2,"ě":3,"è":4,
  "ī":1,"í":2,"ǐ":3,"ì":4,
  "ō":1,"ó":2,"ǒ":3,"ò":4,
  "ū":1,"ú":2,"ǔ":3,"ù":4,
  "ǖ":1,"ǘ":2,"ǚ":3,"ǜ":4,
};
const TONE_LABEL = {
  1: "Nada 1 — datar tinggi (ˉ)",
  2: "Nada 2 — naik (ˊ)",
  3: "Nada 3 — turun lalu naik (ˇ)",
  4: "Nada 4 — turun tajam (ˋ)",
  5: "Nada netral — ringan & pendek",
};

var ToneUtil = {
  LABEL: TONE_LABEL,

  // Nada dominan 1 suku kata pinyin (ambil tanda nada pertama yang ketemu).
  charTone(pinyinSyll) {
    const s = (pinyinSyll || "").normalize("NFC");
    for (const ch of s) if (TONE_CHAR_MAP[ch]) return TONE_CHAR_MAP[ch];
    return 5; // tidak ada diakritik → netral
  },

  // Urutan nada dari 1 string pinyin (bisa berisi banyak suku kata / kata).
  // Heuristik: tiap huruf vokal bertanda nada dianggap 1 suku kata.
  // Suku kata tanpa tanda nada (netral) tidak selalu terdeteksi individual,
  // tapi cukup akurat untuk membangun kontur referensi secara proporsional.
  extractTones(pinyinStr) {
    const s = (pinyinStr || "").normalize("NFC");
    const tones = [];
    for (const ch of s) { const t = TONE_CHAR_MAP[ch]; if (t) tones.push(t); }
    if (!tones.length) tones.push(5);
    return tones;
  },

  // Bentuk kontur "ideal" 1 nada, n titik, nilai 0..1 (tinggi rendahnya pitch).
  _shape(tone, n = 10) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      let y;
      if (tone === 1) y = 0.82 + 0.03 * Math.sin(x * Math.PI);
      else if (tone === 2) y = 0.35 + 0.5 * Math.pow(x, 1.3);
      else if (tone === 3) {
        // turun lalu naik (bentuk lembah)
        const dip = Math.cos(x * Math.PI); // 1 → -1
        y = 0.45 + 0.30 * dip * -1 * (x < 0.55 ? 1 : 0.85);
        y = 0.5 - 0.35 * Math.sin(x * Math.PI) + (x > 0.6 ? (x - 0.6) * 0.6 : 0);
      } else if (tone === 4) y = 0.92 - 0.75 * Math.pow(x, 0.85);
      else y = 0.42 - 0.05 * x; // netral: pendek, agak datar-menurun
      pts.push(Math.max(0.05, Math.min(0.95, y)));
    }
    return pts;
  },

  // Bangun kontur referensi lengkap (0..1 array, panjang `total` titik)
  // dari 1 string pinyin, dengan menyambung bentuk tiap nada berurutan.
  buildReferenceContour(pinyinStr, total = 24) {
    const tones = this.extractTones(pinyinStr);
    const perSyll = Math.max(4, Math.round(total / tones.length));
    let raw = [];
    tones.forEach(t => { raw = raw.concat(this._shape(t, perSyll)); });
    return this._resample(raw, total);
  },

  // Resample array of y-values (0..1) ke jumlah titik tetap (interpolasi linear).
  _resample(arr, n) {
    if (!arr.length) return new Array(n).fill(0.5);
    if (arr.length === 1) return new Array(n).fill(arr[0]);
    const out = [];
    for (let i = 0; i < n; i++) {
      const pos = (i / (n - 1)) * (arr.length - 1);
      const lo = Math.floor(pos), hi = Math.min(arr.length - 1, lo + 1);
      const frac = pos - lo;
      out.push(arr[lo] * (1 - frac) + arr[hi] * frac);
    }
    return out;
  },

  // Bandingkan kontur user vs referensi, hasilkan catatan teks singkat.
  compareContours(userPts, refPts) {
    if (!userPts || !userPts.length) return ["⚠️ Tidak terdeteksi suara yang cukup jelas."];
    const notes = [];
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const seg = (arr, from, to) => arr.slice(Math.floor(arr.length * from), Math.ceil(arr.length * to));
    const uStart = avg(seg(userPts, 0, 0.3)), rStart = avg(seg(refPts, 0, 0.3));
    const uEnd = avg(seg(userPts, 0.7, 1)), rEnd = avg(seg(refPts, 0.7, 1));
    const uTrend = uEnd - uStart, rTrend = rEnd - rStart;

    if (Math.abs(uStart - rStart) > 0.15) {
      notes.push(uStart < rStart ? "🔽 Awalnya kurang tinggi dibanding contoh." : "🔼 Awalnya terlalu tinggi dibanding contoh.");
    }
    if (Math.abs(uTrend - rTrend) > 0.2) {
      if (rTrend > 0.1 && uTrend < 0.05) notes.push("↗️ Seharusnya naik di akhir, punya kamu kurang naik.");
      else if (rTrend < -0.1 && uTrend > -0.05) notes.push("↘️ Seharusnya turun, punya kamu kurang turun.");
      else notes.push("〰️ Arah kontur nada kamu beda dari contoh standar.");
    }
    if (!notes.length) notes.push("✅ Bentuk konturnya sudah cukup mirip dengan contoh!");
    return notes;
  },

  // Ubah sample pitch mentah {t, freq} (freq=-1 kalau tak bersuara) jadi
  // kontur 0..1 ternormalisasi, panjang tetap `total` titik.
  // Return null kalau tidak ada suara terdeteksi sama sekali.
  samplesToContour(samples, total = 24) {
    const voiced = samples.filter(s => s.freq && s.freq > 60 && s.freq < 500);
    if (voiced.length < 3) return null;
    const median = voiced.map(s => s.freq).sort((a, b) => a - b)[Math.floor(voiced.length / 2)];
    const semis = voiced.map(s => ({ t: s.t, v: 12 * Math.log2(s.freq / median) }));
    const clipped = semis.map(s => ({ t: s.t, v: Math.max(-10, Math.min(10, s.v)) }));
    const tMin = clipped[0].t, tMax = clipped[clipped.length - 1].t;
    const span = Math.max(1, tMax - tMin);
    const raw = [];
    for (let i = 0; i < total; i++) {
      const targetT = tMin + (i / (total - 1)) * span;
      // cari titik terdekat (nearest, cukup untuk visual kasar)
      let best = clipped[0], bestDiff = Infinity;
      for (const p of clipped) { const d = Math.abs(p.t - targetT); if (d < bestDiff) { bestDiff = d; best = p; } }
      raw.push(best.v);
    }
    // min-max normalize ke 0..1, dengan skala minimum supaya suara datar tak "meledak"
    const lo = Math.min(...raw), hi = Math.max(...raw);
    const range = Math.max(hi - lo, 3); // minimal rentang 3 semitone biar tidak over-amplify noise
    return raw.map(v => 0.5 + (v - (lo + hi) / 2) / range);
  },
};

// ── AUTOCORRELATION PITCH DETECTION (algoritma ACF2+, umum dipakai) ──
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // terlalu pelan / hening

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  const trimmed = buf.slice(r1, r2);
  const TSIZE = trimmed.length;
  if (TSIZE < 8) return -1;

  const c = new Array(TSIZE).fill(0);
  for (let i = 0; i < TSIZE; i++)
    for (let j = 0; j < TSIZE - i; j++)
      c[i] += trimmed[j] * trimmed[j + i];

  let d = 0;
  while (d < TSIZE - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < TSIZE; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  let T0 = maxpos;
  if (T0 <= 0) return -1;

  const x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  if (freq < 50 || freq > 800) return -1;
  return freq;
}

// ── PITCH RECORDER — rekam mic, hasilkan kontur + audio blob ────
var PitchRecorder = {
  _ctx: null, _stream: null, _analyser: null, _raf: null,
  _samples: [], _startTime: 0, _recorder: null, _chunks: [],
  _recording: false, _resolve: null, _autoStopTimer: null,

  supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext) && window.MediaRecorder);
  },

  async start(maxMs = 6000) {
    if (!this.supported()) throw new Error("Perekaman pitch tidak didukung di browser ini.");
    this._samples = [];
    this._chunks = [];
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this._ctx.createMediaStreamSource(this._stream);
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    src.connect(this._analyser);

    let mimeType = "";
    for (const t of ["audio/webm", "audio/ogg", "audio/mp4"]) {
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
    }
    this._recorder = mimeType ? new MediaRecorder(this._stream, { mimeType }) : new MediaRecorder(this._stream);
    this._recorder.ondataavailable = e => { if (e.data && e.data.size) this._chunks.push(e.data); };

    this._startTime = performance.now();
    this._recording = true;
    this._recorder.start();

    const buf = new Float32Array(this._analyser.fftSize);
    const poll = () => {
      if (!this._recording) return;
      this._analyser.getFloatTimeDomainData(buf);
      const freq = autoCorrelate(buf, this._ctx.sampleRate);
      this._samples.push({ t: performance.now() - this._startTime, freq });
      this._raf = requestAnimationFrame(poll);
    };
    poll();

    return new Promise(resolve => {
      this._resolve = resolve;
      this._autoStopTimer = setTimeout(() => this.stop(), maxMs);
    });
  },

  stop() {
    if (!this._recording) return;
    this._recording = false;
    clearTimeout(this._autoStopTimer);
    cancelAnimationFrame(this._raf);
    const duration = performance.now() - this._startTime;
    const finish = () => {
      let blob = null, url = null;
      try {
        blob = new Blob(this._chunks, { type: this._chunks[0]?.type || "audio/webm" });
        url = URL.createObjectURL(blob);
      } catch (e) {}
      try { this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      try { this._ctx.close(); } catch (e) {}
      const contour = ToneUtil.samplesToContour(this._samples);
      if (this._resolve) { this._resolve({ contour, blob, url, duration, samples: this._samples }); this._resolve = null; }
    };
    try {
      this._recorder.onstop = finish;
      this._recorder.stop();
    } catch (e) { finish(); }
  },
};

// ── CONTOUR CHART — render SVG overlay nada-kamu vs nada-standar ──
var ContourChart = {
  svg(userPts, refPts, opts = {}) {
    const W = opts.w || 320, H = opts.h || 130, pad = 14;
    const labelChars = opts.labelChars || null; // array karakter untuk garis pemisah per-suku-kata
    const toPath = (pts, color, dash) => {
      if (!pts || !pts.length) return "";
      const step = (W - pad * 2) / (pts.length - 1);
      const d = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(pad + i * step).toFixed(1)} ${(H - pad - v * (H - pad * 2)).toFixed(1)}`).join(" ");
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
    };
    let dividers = "";
    if (labelChars && labelChars.length > 1) {
      const n = labelChars.length;
      for (let i = 1; i < n; i++) {
        const x = pad + (i / n) * (W - pad * 2);
        dividers += `<line x1="${x}" y1="${pad}" x2="${x}" y2="${H - pad}" stroke="#ddd" stroke-width="1" stroke-dasharray="2,3"/>`;
      }
      labelChars.forEach((c, i) => {
        const x = pad + ((i + 0.5) / n) * (W - pad * 2);
        dividers += `<text x="${x}" y="${H - 2}" font-size="11" text-anchor="middle" fill="#888">${c}</text>`;
      });
    }
    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
        <line x1="${pad}" y1="${H/2}" x2="${W-pad}" y2="${H/2}" stroke="#eee" stroke-width="1"/>
        ${dividers}
        ${toPath(refPts, "#9e9e9e", "5,4")}
        ${toPath(userPts, "#2196f3", "")}
      </svg>
      <div style="display:flex;gap:14px;justify-content:center;font-size:11px;color:#666;margin-top:2px">
        <span>▬▬ <b style="color:#2196f3">Suaramu</b></span>
        <span>┅┅ <b style="color:#9e9e9e">Nada standar</b></span>
      </div>`;
  }
};
