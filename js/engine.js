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

let kbState = { nada: 0, teks: "" };

function buildKbPinyin(displayId, onUpdate) {
  // reset
  kbState = { nada: 0, teks: "" };

  const cont = el("kb-pinyin-cont");
  if (!cont) return;
  cont.innerHTML = "";

  // display
  const disp = document.createElement("div");
  disp.id = displayId || "kb-display";
  disp.className = "kb-display";
  disp.innerText = "";
  cont.appendChild(disp);

  // nada
  const nadaSec = document.createElement("div");
  nadaSec.className = "kb-section";
  nadaSec.innerHTML = `<div class="kb-label">Nada</div><div class="kb-row" id="kb-nada-row"></div>`;
  cont.appendChild(nadaSec);
  const nadaRow = nadaSec.querySelector("#kb-nada-row");
  [0,1,2,3,4].forEach(n => {
    const b = document.createElement("button");
    b.className = "kb-btn nada" + (n===0?" nada-aktif":"");
    b.id = "nada-btn-"+n;
    b.innerText = ["◌","¯","´","ˇ","`"][n];
    b.onclick = () => {
      kbState.nada = n;
      cont.querySelectorAll(".nada").forEach(x=>x.classList.remove("nada-aktif"));
      b.classList.add("nada-aktif");
    };
    nadaRow.appendChild(b);
  });

  // vokal
  const vokalSec = document.createElement("div");
  vokalSec.className = "kb-section";
  vokalSec.innerHTML = `<div class="kb-label">Vokal</div><div class="kb-row" id="kb-vokal-row"></div>`;
  cont.appendChild(vokalSec);
  const vokalRow = vokalSec.querySelector("#kb-vokal-row");
  VOKAL_BASE.forEach(v => {
    const b = document.createElement("button");
    b.className = "kb-btn vokal";
    b.innerText = v;
    b.onclick = () => {
      const ch = NADA_MAP[v][kbState.nada] || v;
      kbState.teks += ch;
      updateKbDisplay(displayId || "kb-display");
      if (onUpdate) onUpdate(kbState.teks);
    };
    vokalRow.appendChild(b);
  });

  // konsonan
  const konSec = document.createElement("div");
  konSec.className = "kb-section";
  konSec.innerHTML = `<div class="kb-label">Konsonan</div><div class="kb-row" id="kb-kon-row"></div>`;
  cont.appendChild(konSec);
  const konRow = konSec.querySelector("#kb-kon-row");
  KONSONAN.forEach(k => {
    const b = document.createElement("button");
    b.className = "kb-btn";
    b.innerText = k;
    b.onclick = () => {
      kbState.teks += k;
      updateKbDisplay(displayId || "kb-display");
      if (onUpdate) onUpdate(kbState.teks);
    };
    konRow.appendChild(b);
  });

  // action row
  const actSec = document.createElement("div");
  actSec.className = "kb-section";
  actSec.innerHTML = `
    <button class="kb-btn spesial" onclick="kbSpasi()">Spasi</button>
    <button class="kb-btn spesial" onclick="kbHapus()">⌫ Hapus</button>
    <button class="kb-btn spesial" onclick="kbClear()">✕ Clear</button>
  `;
  cont.appendChild(actSec);
}

function updateKbDisplay(id) {
  const e = el(id || "kb-display");
  if (e) e.innerText = kbState.teks || "";
}

function kbSpasi() {
  kbState.teks += " ";
  updateKbDisplay();
}
function kbHapus() {
  kbState.teks = [...kbState.teks].slice(0,-1).join("");
  updateKbDisplay();
}
function kbClear() {
  kbState.teks = "";
  updateKbDisplay();
}
function getKbTeks() { return kbState.teks.trim(); }
function resetKb() {
  kbState.teks = "";
  kbState.nada = 0;
  updateKbDisplay();
  const btns = document.querySelectorAll(".nada");
  btns.forEach((b,i) => { b.classList.toggle("nada-aktif", i===0); });
}
 
