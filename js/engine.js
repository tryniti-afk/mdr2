// ================================================================
//  ENGINE.JS — TTS, STT, Cek Jawaban, Utilitas
// ================================================================

// ── TTS (Text-To-Speech) ─────────────────────────────────────
const TTS = {
  bicara(teks, lang = null, rate = 0.85, onEnd = null) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = lang || deteksiBahasa(teks);
    u.rate = rate;
    if (onEnd) u.onend = onEnd;
    speechSynthesis.speak(u);
    return u;
  },
  mandarin(teks, onEnd = null) {
    return this.bicara(teks, "zh-CN", 0.8, onEnd);
  },
  indo(teks, onEnd = null) {
    return this.bicara(teks, "id-ID", 0.9, onEnd);
  },
  berhenti() {
    speechSynthesis.cancel();
  }
};

// ── STT (Speech-To-Text) ─────────────────────────────────────
const STT = {
  rec: null,
  mulai(lang, onResult, onError, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (onError) onError("SpeechRecognition tidak tersedia. Gunakan Chrome.");
      return;
    }
    this.berhenti();
    const r = new SR();
    r.lang = lang || "zh-CN";
    r.interimResults = false;
    r.maxAlternatives = 3;
    let dapat = false;
    r.onresult = (e) => {
      dapat = true;
      const hasil = Array.from(e.results[0]).map(x => x.transcript.toLowerCase());
      if (onResult) onResult(hasil[0], hasil);
    };
    r.onerror = (e) => {
      if (onError) onError(e.error);
    };
    r.onend = () => {
      if (!dapat && onEnd) onEnd(false);
      else if (onEnd) onEnd(true);
    };
    r.start();
    this.rec = r;
  },
  berhenti() {
    try { if (this.rec) this.rec.abort(); } catch(e) {}
    this.rec = null;
  },
  // Berhenti "halus": tetap memicu onresult/onend dengan hasil yang sudah
  // tertangkap sejauh ini (beda dari berhenti() yang membatalkan total).
  berhentiHalus() {
    try { if (this.rec) this.rec.stop(); } catch(e) {}
  }
};

// ── DETEKSI BAHASA ───────────────────────────────────────────
function deteksiBahasa(teks) {
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(teks)) return "zh-CN";
  return "id-ID";
}

// ── NORMALISASI ──────────────────────────────────────────────
function norm(teks) {
  return (teks || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s\/\+\(\)]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

// ── CEK JAWABAN ──────────────────────────────────────────────
function cekJawaban(input, kunci) {
  const u = norm(input);
  const k = norm(kunci);

  // OR level: a || b
  if (k.includes("||")) {
    return k.split("||").some(x => cekJawaban(u, x.trim()));
  }
  // Kurung OR: (a/b)+c
  if (k.includes("(") && k.includes(")")) {
    const m = k.match(/\((.*?)\)/);
    if (m) {
      const opts = m[1].split("/").map(x => x.trim());
      return opts.some(op => cekJawaban(u, k.replace("("+m[1]+")", op)));
    }
  }
  // OR: a/b
  if (k.includes("/")) return k.split("/").some(x => u.includes(x.trim()));
  // AND: a+b
  if (k.includes("+")) return k.split("+").every(x => u.includes(x.trim()));
  return u.includes(k);
}

// ── CEK HANZI EXACT ──────────────────────────────────────────
function cekHanzi(input, target) {
  return input.trim() === target.trim();
}

// ── CEK PINYIN ───────────────────────────────────────────────
// strict=true  → nada harus tepat (huruf+diakritik harus identik)
// strict=false → nada diabaikan, hanya huruf dasar yang dibandingkan
const NADA_KE_POLOS = {
  "ā":"a","á":"a","ǎ":"a","à":"a",
  "ē":"e","é":"e","ě":"e","è":"e",
  "ī":"i","í":"i","ǐ":"i","ì":"i",
  "ō":"o","ó":"o","ǒ":"o","ò":"o",
  "ū":"u","ú":"u","ǔ":"u","ù":"u",
  "ü":"u","ǖ":"u","ǘ":"u","ǚ":"u","ǜ":"u",
};
function hilangkanNada(s) {
  return (s || "").split("").map(ch => NADA_KE_POLOS[ch] || ch).join("");
}
function cekPinyin(input, target, strict = true) {
  const norm = s => (s || "")
    .toLowerCase()
    .normalize("NFC")           // pastikan bentuk unicode konsisten (huruf+nada gabungan)
    .replace(/\s+/g, " ")
    .trim();
  const a = norm(input);
  const b = norm(target);
  if (strict) return a === b;
  // Mode longgar: hilangkan nada DAN spasi antar suku kata
  // sehingga "ni hao" == "nihao" == "nǐ hǎo"
  return hilangkanNada(a).replace(/\s/g, "") === hilangkanNada(b).replace(/\s/g, "");
}

// ── UI HELPERS ───────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function showEl(...ids) { ids.forEach(id => { const e=el(id); if(e) e.style.display="block"; }); }
function hideEl(...ids) { ids.forEach(id => { const e=el(id); if(e) e.style.display="none"; }); }

function setTeks(id, teks) { const e=el(id); if(e) e.innerText=teks; }
function setHTML(id, html) { const e=el(id); if(e) e.innerHTML=html; }

function tampilHasil(id, benar, pesan) {
  const e = el(id);
  if (!e) return;
  e.className = "hasil-box " + (benar ? "benar" : "salah");
  e.innerHTML = (benar ? "✅ " : "❌ ") + pesan;
}

function buatPilihan(daftarPilihan, onPilih, containerId) {
  const c = el(containerId);
  if (!c) return;
  c.innerHTML = "";
  daftarPilihan.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "btn-pilihan";
    btn.innerText = p;
    btn.onclick = () => onPilih(i, p, btn, c);
    c.appendChild(btn);
  });
}

function highlightPilihan(container, idxBenar, idxDipilih) {
  const btns = container.querySelectorAll(".btn-pilihan");
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === idxBenar) b.classList.add("pilihan-benar");
    else if (i === idxDipilih) b.classList.add("pilihan-salah");
  });
}

// ── SKOR & PROGRESS ─────────────────────────────────────────
let sesiSkor = { benar: 0, salah: 0, total: 0 };

function resetSkor() {
  sesiSkor = { benar: 0, salah: 0, total: 0 };
}

function tambahSkor(benar) {
  sesiSkor.total++;
  if (benar) sesiSkor.benar++;
  else sesiSkor.salah++;
}

// Dipakai saat memulihkan sesi yang ditinggal ("Lanjutkan") supaya skor lama ikut kembali.
function setSkor(benar, salah, total) {
  sesiSkor = { benar: benar || 0, salah: salah || 0, total: total != null ? total : (benar||0)+(salah||0) };
}

// ── SESI TERTUNDA ("Lanjutkan") ───────────────────────────────
//  Dipakai modul Vocab / Sentence / Sesi Pintar supaya kalau user
//  meninggalkan sesi sebelum selesai, progresnya bisa dilanjutkan lagi.
const LANJUT_PREFIX = "mdr_lanjut_";

function simpanSesiLanjut(modul, data) {
  try { localStorage.setItem(LANJUT_PREFIX + modul, JSON.stringify({ ...data, _ts: Date.now() })); } catch (e) {}
}
function ambilSesiLanjut(modul) {
  try {
    const raw = localStorage.getItem(LANJUT_PREFIX + modul);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Kadaluarsa setelah 3 hari supaya tidak menumpuk data basi.
    if (Date.now() - (data._ts || 0) > 3 * 24 * 60 * 60 * 1000) { hapusSesiLanjut(modul); return null; }
    return data;
  } catch (e) { return null; }
}
function hapusSesiLanjut(modul) {
  try { localStorage.removeItem(LANJUT_PREFIX + modul); } catch (e) {}
}

function updateSkorUI(id) {
  const e = el(id);
  if (!e) return;
  const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
  e.innerHTML = `✅ ${sesiSkor.benar} &nbsp;❌ ${sesiSkor.salah} &nbsp;<b>${pct}%</b>`;
}

// ── TIMER ────────────────────────────────────────────────────
let timerInterval = null;
function mulaiTimer(durasi, onTick, onSelesai) {
  clearInterval(timerInterval);
  let sisa = durasi;
  onTick(sisa);
  timerInterval = setInterval(() => {
    sisa--;
    onTick(sisa);
    if (sisa <= 0) { clearInterval(timerInterval); onSelesai(); }
  }, 1000);
}
function hentikanTimer() { clearInterval(timerInterval); }

// ── KEYBOARD PINYIN ──────────────────────────────────────────
const VOKAL_BASE = ["a","e","i","o","u","ü"];
const NADA_MAP = {
  a: ["a","ā","á","ǎ","à"],
  e: ["e","ē","é","ě","è"],
  i: ["i","ī","í","ǐ","ì"],
  o: ["o","ō","ó","ǒ","ò"],
  u: ["u","ū","ú","ǔ","ù"],
  ü: ["ü","ǖ","ǘ","ǚ","ǜ"],
};
const KONSONAN = ["b","p","m","f","d","t","n","l","g","k","h","j","q","x","r","z","c","s","y","w"];

// mode: "tombol" = keyboard tombol pinyin (klik nada+huruf)
//       "angka"  = ketik biasa + angka nada (mis. xi3hua1n -> xǐhuān)
// kbPreferredMode disimpan di luar kbState supaya PERSIST antar soal —
// begitu user pindah mode, soal berikutnya (termasuk saat jawaban salah/lanjut) pakai mode yang sama.
let kbPreferredMode = "tombol";
let kbState = { nada: 0, teks: "", mode: kbPreferredMode, angkaRaw: "", previewOn: false };
let kbCtx   = { displayId: "kb-display", onUpdate: null };

// ── Konversi pinyin-angka -> pinyin-nada ─────────────────────
// Angka (1-4) ditulis TEPAT SETELAH huruf vokal yang mau diberi nada.
// 1=ˉ 2=ˊ 3=ˇ 4=ˋ , tanpa angka = netral. Huruf "v" dianggap sebagai "ü".
function konversiAngkaKePinyin(teks) {
  const raw = (teks || "").toLowerCase();
  let out = "";
  let lastVowelIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    if (ch === "v") ch = "ü";
    if (VOKAL_BASE.includes(ch)) {
      out += ch;
      lastVowelIdx = out.length - 1;
    } else if (/[1-4]/.test(ch)) {
      if (lastVowelIdx >= 0) {
        const baseVowel = out[lastVowelIdx];
        const peta = NADA_MAP[baseVowel];
        if (peta) out = out.slice(0, lastVowelIdx) + peta[parseInt(ch, 10)] + out.slice(lastVowelIdx + 1);
      }
      // angka dibuang dari output (bukan bagian dari pinyin)
    } else if (/[0-9]/.test(ch)) {
      // angka lain (mis. 0/5) diabaikan, dianggap netral
    } else {
      out += ch;
    }
  }
  return out;
}

function buildKbPinyin(displayId, onUpdate) {
  // reset (mode ikut preferensi terakhir user, TIDAK selalu balik ke "tombol")
  kbState = { nada: 0, teks: "", mode: kbPreferredMode, angkaRaw: "", previewOn: false };
  kbCtx   = { displayId: displayId || "kb-display", onUpdate: onUpdate || null };

  const cont = el("kb-pinyin-cont");
  if (!cont) return;
  cont.innerHTML = "";

  // toggle mode keyboard
  const toggleSec = document.createElement("div");
  toggleSec.className = "kb-mode-toggle";
  toggleSec.innerHTML = `
    <button class="kb-mode-btn ${kbState.mode==='tombol'?'aktif':''}" id="kb-mode-tombol" onclick="kbSetMode('tombol')">⌨️ Keyboard Pinyin</button>
    <button class="kb-mode-btn ${kbState.mode==='angka'?'aktif':''}" id="kb-mode-angka" onclick="kbSetMode('angka')">🔢 Ketik + Angka</button>
  `;
  cont.appendChild(toggleSec);

  // display (dipakai bersama oleh kedua mode; di mode angka bisa disembunyikan)
  const disp = document.createElement("div");
  disp.id = kbCtx.displayId;
  disp.className = "kb-display";
  disp.innerText = "";
  cont.appendChild(disp);

  // body: isi berubah sesuai mode
  const body = document.createElement("div");
  body.id = "kb-body-cont";
  cont.appendChild(body);

  // action row: tetap ada di kedua mode (juga titik "kb-section:last-child"
  // yang dipakai quiz.js untuk menyisipkan tombol Submit). Tombol Spasi/Hapus/Clear
  // di dalamnya hanya ditampilkan untuk mode "tombol" (mode "angka" sudah punya keyboard fisik/virtual sendiri).
  const actSec = document.createElement("div");
  actSec.className = "kb-section";
  actSec.id = "kb-action-row";
  actSec.innerHTML = `
    <div class="kb-row" id="kb-basic-actions">
      <button class="kb-btn spesial" onclick="kbSpasi()">Spasi</button>
      <button class="kb-btn spesial" onclick="kbHapus()">⌫ Hapus</button>
      <button class="kb-btn spesial" onclick="kbClear()">✕ Clear</button>
    </div>
  `;
  cont.appendChild(actSec);

  _renderKbBody();
  _applyBasicActionsVisibility();
  _applyPreviewVisibility();
}

function kbSetMode(mode) {
  kbPreferredMode = mode; // ingat pilihan user untuk soal-soal berikutnya
  if (kbState.mode === mode) return;
  kbState.mode = mode;
  kbState.teks = "";
  kbState.nada = 0;
  kbState.angkaRaw = "";
  kbState.previewOn = false;
  const bTombol = el("kb-mode-tombol"), bAngka = el("kb-mode-angka");
  if (bTombol) bTombol.classList.toggle("aktif", mode === "tombol");
  if (bAngka)  bAngka.classList.toggle("aktif", mode === "angka");
  _renderKbBody();
  _applyBasicActionsVisibility();
  updateKbDisplay(kbCtx.displayId);
  _applyPreviewVisibility();
  if (kbCtx.onUpdate) kbCtx.onUpdate(kbState.teks);
}

function _renderKbBody() {
  const body = el("kb-body-cont");
  if (!body) return;
  body.innerHTML = "";
  if (kbState.mode === "angka") _renderKbAngka(body);
  else _renderKbTombol(body);
}

// Tombol Spasi/Hapus/Clear cuma relevan untuk mode "tombol"
function _applyBasicActionsVisibility() {
  const wrap = el("kb-basic-actions");
  if (wrap) wrap.style.display = (kbState.mode === "tombol") ? "flex" : "none";
}

// Kotak preview (tampilan nada) selalu terlihat di mode "tombol" (itu satu-satunya
// feedback saat klik tombol), tapi di mode "angka" defaultnya disembunyikan supaya
// tidak "ramai" saat mengisi — user bisa munculkan lewat tombol 👁️.
function _applyPreviewVisibility() {
  const disp = el(kbCtx.displayId);
  if (!disp) return;
  disp.style.display = (kbState.mode === "angka" && !kbState.previewOn) ? "none" : "block";
}

// ── MODE 1: Keyboard tombol (klik nada, lalu klik huruf) ─────
function _renderKbTombol(body) {
  // nada
  const nadaSec = document.createElement("div");
  nadaSec.className = "kb-section";
  nadaSec.innerHTML = `<div class="kb-label">Nada</div><div class="kb-row" id="kb-nada-row"></div>`;
  body.appendChild(nadaSec);
  const nadaRow = nadaSec.querySelector("#kb-nada-row");
  [0,1,2,3,4].forEach(n => {
    const b = document.createElement("button");
    b.className = "kb-btn nada" + (n===0?" nada-aktif":"");
    b.id = "nada-btn-"+n;
    b.innerText = ["◌","¯","´","ˇ","`"][n];
    b.onclick = () => {
      kbState.nada = n;
      body.querySelectorAll(".nada").forEach(x=>x.classList.remove("nada-aktif"));
      b.classList.add("nada-aktif");
    };
    nadaRow.appendChild(b);
  });

  // vokal
  const vokalSec = document.createElement("div");
  vokalSec.className = "kb-section";
  vokalSec.innerHTML = `<div class="kb-label">Vokal</div><div class="kb-row" id="kb-vokal-row"></div>`;
  body.appendChild(vokalSec);
  const vokalRow = vokalSec.querySelector("#kb-vokal-row");
  VOKAL_BASE.forEach(v => {
    const b = document.createElement("button");
    b.className = "kb-btn vokal";
    b.innerText = v;
    b.onclick = () => {
      const ch = NADA_MAP[v][kbState.nada] || v;
      kbState.teks += ch;
      updateKbDisplay(kbCtx.displayId);
      if (kbCtx.onUpdate) kbCtx.onUpdate(kbState.teks);
    };
    vokalRow.appendChild(b);
  });

  // konsonan
  const konSec = document.createElement("div");
  konSec.className = "kb-section";
  konSec.innerHTML = `<div class="kb-label">Konsonan</div><div class="kb-row" id="kb-kon-row"></div>`;
  body.appendChild(konSec);
  const konRow = konSec.querySelector("#kb-kon-row");
  KONSONAN.forEach(k => {
    const b = document.createElement("button");
    b.className = "kb-btn";
    b.innerText = k;
    b.onclick = () => {
      kbState.teks += k;
      updateKbDisplay(kbCtx.displayId);
      if (kbCtx.onUpdate) kbCtx.onUpdate(kbState.teks);
    };
    konRow.appendChild(b);
  });
}

// ── MODE 2: Ketik biasa + angka nada (mis. xi3hua1n -> xǐhuān) ─
function _renderKbAngka(body) {
  // keterangan singkat saja: peta angka nada + catatan ü→v
  const info = document.createElement("div");
  info.className = "kb-angka-info";
  info.innerHTML = `<b>1</b>=ˉ &nbsp; <b>2</b>=ˊ &nbsp; <b>3</b>=ˇ &nbsp; <b>4</b>=ˋ &nbsp;&nbsp;|&nbsp;&nbsp; <b>ü</b> → <b>v</b>`;
  body.appendChild(info);

  const inputWrap = document.createElement("div");
  inputWrap.className = "kb-section";
  inputWrap.innerHTML = `<input type="text" id="kb-angka-input" class="kb-angka-input" placeholder="cth: xi3hua1n" autocomplete="off" autocapitalize="off" spellcheck="false">`;
  body.appendChild(inputWrap);

  // tombol show/hide preview nada, biar tampilan gak ramai saat ngisi
  const toggleWrap = document.createElement("div");
  toggleWrap.className = "kb-section";
  toggleWrap.innerHTML = `<button type="button" class="kb-btn spesial" id="kb-toggle-preview">${kbState.previewOn ? "🙈 Sembunyikan Nada" : "👁️ Lihat Nada"}</button>`;
  body.appendChild(toggleWrap);

  const inp = body.querySelector("#kb-angka-input");
  inp.value = kbState.angkaRaw;
  inp.oninput = () => {
    kbState.angkaRaw = inp.value;
    kbState.teks = konversiAngkaKePinyin(kbState.angkaRaw);
    updateKbDisplay(kbCtx.displayId);
    if (kbCtx.onUpdate) kbCtx.onUpdate(kbState.teks);
  };
  inp.onkeydown = (e) => {
    if (e.key === "Enter") {
      const cont = el("kb-pinyin-cont");
      const wrap = cont ? (cont.closest(".soal-wrap") || cont.parentElement) : null;
      if (!wrap) return;
      let btn = wrap.querySelector(".btn-hijau");
      if (!btn) btn = Array.from(wrap.querySelectorAll("button")).find(b => /submit/i.test(b.innerText));
      if (btn) btn.click();
    }
  };
  setTimeout(() => inp.focus(), 50);

  const toggleBtn = toggleWrap.querySelector("#kb-toggle-preview");
  toggleBtn.onclick = () => {
    kbState.previewOn = !kbState.previewOn;
    toggleBtn.innerText = kbState.previewOn ? "🙈 Sembunyikan Nada" : "👁️ Lihat Nada";
    _applyPreviewVisibility();
  };
}

function updateKbDisplay(id) {
  const e = el(id || kbCtx.displayId || "kb-display");
  if (e) e.innerText = kbState.teks || "";
}

function kbSpasi() {
  if (kbState.mode === "angka") {
    const inp = el("kb-angka-input");
    if (inp) { inp.value += " "; inp.dispatchEvent(new Event("input")); inp.focus(); return; }
  }
  kbState.teks += " ";
  updateKbDisplay();
}
function kbHapus() {
  if (kbState.mode === "angka") {
    const inp = el("kb-angka-input");
    if (inp) { inp.value = [...inp.value].slice(0,-1).join(""); inp.dispatchEvent(new Event("input")); inp.focus(); return; }
  }
  kbState.teks = [...kbState.teks].slice(0,-1).join("");
  updateKbDisplay();
}
function kbClear() {
  if (kbState.mode === "angka") {
    const inp = el("kb-angka-input");
    if (inp) { inp.value = ""; inp.dispatchEvent(new Event("input")); inp.focus(); return; }
  }
  kbState.teks = "";
  updateKbDisplay();
}
function getKbTeks() { return (kbState.teks || "").trim(); }
function resetKb() {
  kbState.teks = "";
  kbState.nada = 0;
  kbState.angkaRaw = "";
  kbState.previewOn = false;
  updateKbDisplay();
  _applyPreviewVisibility();
  const toggleBtn = el("kb-toggle-preview");
  if (toggleBtn) toggleBtn.innerText = "👁️ Lihat Nada";
  const btns = document.querySelectorAll(".nada");
  btns.forEach((b,i) => { b.classList.toggle("nada-aktif", i===0); });
  const inp = el("kb-angka-input");
  if (inp) inp.value = "";
}



// ================================================================
//  LANJUT CONTROL — pengaturan global "lanjut otomatis / manual"
//  Dipakai bersama oleh Psikotes, Fokus Nada, Shadowing,
//  Buat Kalimat, Translate In, dll supaya konsisten.
// ================================================================
const LanjutCfg = {
  KEY: "mdr_lanjut_cfg",
  get() {
    let cfg = { mode: "auto", detik: 3 };
    try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(this.KEY) || "{}")); } catch (e) {}
    return cfg;
  },
  set(patch) {
    const cfg = Object.assign(this.get(), patch);
    try { localStorage.setItem(this.KEY, JSON.stringify(cfg)); } catch (e) {}
    return cfg;
  },
};

// Blok UI kecil untuk dipasang di layar setup modul manapun.
// renderFnGlobal = nama fungsi global (string) yang akan dipanggil untuk
// me-render ulang tampilan setelah pengaturan berubah (mis. "Vocab._renderSetupNada").
function renderKontrolLanjut(renderFnGlobal) {
  const cfg = LanjutCfg.get();
  return `
    <div style="margin-top:12px">
      <label style="font-size:13px;color:var(--c-sub);font-weight:700">⏭️ Lanjut ke Soal Berikutnya</label>
      <div class="opsi-grup" style="margin-top:6px">
        <button class="opsi ${cfg.mode === "auto" ? "aktif" : ""}" onclick="LanjutCfg.set({mode:'auto'}); ${renderFnGlobal}();">⏱️ Otomatis</button>
        <button class="opsi ${cfg.mode === "manual" ? "aktif" : ""}" onclick="LanjutCfg.set({mode:'manual'}); ${renderFnGlobal}();">👆 Manual (klik tombol)</button>
      </div>
      ${cfg.mode === "auto" ? `
      <div style="margin-top:8px">
        <label style="font-size:12.5px;color:var(--c-sub)">Jeda otomatis (detik):</label><br>
        <input type="number" class="quiz-select" style="max-width:100px;margin-top:4px" min="1" max="15" value="${cfg.detik}"
          onchange="LanjutCfg.set({detik: Math.max(1, parseInt(this.value)||3)}); ${renderFnGlobal}();">
      </div>` : `<p style="font-size:12px;color:var(--c-sub);margin-top:6px">Tombol "➡️ Lanjut" akan muncul setelah tiap jawaban/putaran, kamu klik sendiri kapan mau lanjut.</p>`}
    </div>
  `;
}

// Jadwalkan lanjut ke soal berikutnya: otomatis (setTimeout) atau
// menunggu klik tombol manual yang disisipkan ke dalam containerId.
// - containerId: id elemen tempat tombol manual disisipkan (mis. hasil box)
// - callback: fungsi yang dijalankan saat waktunya lanjut
// - teksTombol: label tombol manual (opsional)
function tampilTombolLanjut(containerId, callback, teksTombol) {
  const cfg = LanjutCfg.get();
  if (cfg.mode === "manual") {
    const c = el(containerId);
    if (c) {
      const btn = document.createElement("div");
      btn.className = "btn-row";
      btn.style.cssText = "justify-content:center;margin-top:10px";
      btn.innerHTML = `<button class="btn btn-hijau">${teksTombol || "➡️ Lanjut"}</button>`;
      btn.querySelector("button").onclick = callback;
      c.appendChild(btn);
    } else {
      setTimeout(callback, (cfg.detik || 3) * 1000);
    }
  } else {
    setTimeout(callback, (cfg.detik || 3) * 1000);
  }
}
