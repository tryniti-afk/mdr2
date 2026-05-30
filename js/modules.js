// ================================================================
//  GRAMMAR.JS — 4 Sub-Fitur Grammar Training
// ================================================================

const Grammar = {
  idx: 0,
  modeSaat: null,
  soalList: [],

  renderMenu() {
    const sub = [
      { id:"pattern",    icon:"📐", label:"Pattern Matching",   desc:"Pilih kalimat yang menggunakan pola grammar dengan benar" },
      { id:"correction", icon:"✏️",  label:"Grammar Correction", desc:"Perbaiki kalimat yang salah" },
      { id:"choice",     icon:"🎯", label:"Grammar Choice",     desc:"Pilih partikel/grammar yang tepat: 了/过/着" },
      { id:"build",      icon:"🏗️",  label:"Build Sentence",     desc:"Buat kalimat menggunakan pola grammar" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Grammar.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.soalList = acak(DB.grammar).slice(0, 6);
    this.idx = 0;
    resetSkor();
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const g = this.soalList[this.idx];
    const total = this.soalList.length;
    let html = `
      <div class="soal-header">
        <div class="progres-teks">Soal ${this.idx+1}/${total}</div>
        <div class="skor-mini" id="skor-mini">✅${sesiSkor.benar} ❌${sesiSkor.salah}</div>
      </div>
      <div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>
    `;
    const mode = this.modeSaat;
    if (mode === "pattern") html += this._pattern(g);
    else if (mode === "correction") html += this._correction(g);
    else if (mode === "choice") html += this._choice(g);
    else if (mode === "build") html += this._build(g);
    el("konten-utama").innerHTML = html;
  },

  _pattern(g) {
    const semua = acak([...g.contoh.slice(0,2), ...g.salah.slice(0,2)]);
    return `
      <div class="soal-wrap">
        <div class="label-mode">📐 Pattern Matching</div>
        <div class="grammar-pola">${g.pola}</div>
        <div class="soal-hint">Pola: <i>${g.arti}</i><br>Pilih kalimat yang BENAR menggunakan pola ini:</div>
        <div class="grammar-info">${g.keterangan}</div>
        <div class="pilihan-list" id="pilihan-cont">
          ${semua.map((p,i)=>`<button class="btn-pilihan-full" onclick="Grammar._jawabPattern('${this._esc(p)}',${g.contoh.includes(p)})">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row"><button class="btn btn-abu" onclick="Grammar.kembaliMenu()">← Menu</button></div>
      </div>`;
  },

  _correction(g) {
    const kalimatSalah = g.salah[0];
    const benarContoh = g.contoh[0];
    return `
      <div class="soal-wrap">
        <div class="label-mode">✏️ Grammar Correction</div>
        <div class="soal-kalimat salah-kalimat">${kalimatSalah} ❌</div>
        <div class="soal-hint">Perbaiki kalimat di atas (pola: ${g.pola}):</div>
        <textarea id="input-jawab" class="input-jawab" rows="2" placeholder="Tulis kalimat yang benar..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Grammar._jawabCorrection('${this._esc(benarContoh)}')">✅ Submit</button>
          <button class="btn btn-abu" onclick="Grammar.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _choice(g) {
    // Soal pilihan partikel 了/过/着
    const partikel = ["了","过","着"];
    const contoh = g.contoh[0];
    // Ganti partikel di contoh dengan blank
    let blank = contoh, pakai = "";
    partikel.forEach(p => { if (contoh.includes(p)) { blank = contoh.replace(p, "___"); pakai = p; } });
    if (!pakai) { pakai = partikel[0]; blank = contoh + "___"; }
    const semua = acak(partikel);
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎯 Grammar Choice</div>
        <div class="soal-kalimat">${blank}</div>
        <div class="soal-hint">Pilih partikel yang tepat untuk melengkapi kalimat:</div>
        <div class="pilihan-grid" id="pilihan-cont">
          ${semua.map(p=>`<button class="btn-pilihan hanzi lg" onclick="Grammar._jawabChoice('${p}','${pakai}')">${p}</button>`).join("")}
        </div>
        <div class="grammar-info" style="margin-top:12px">
          <b>了</b> = selesai/perubahan &nbsp;|&nbsp; <b>过</b> = pernah (pengalaman) &nbsp;|&nbsp; <b>着</b> = sedang berlangsung
        </div>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row"><button class="btn btn-abu" onclick="Grammar.kembaliMenu()">← Menu</button></div>
      </div>`;
  },

  _build(g) {
    const vocab = acak(DB.vocab).slice(0,4).map(v=>v.hanzi).join("、");
    return `
      <div class="soal-wrap">
        <div class="label-mode">🏗️ Build Sentence</div>
        <div class="grammar-pola">${g.pola}</div>
        <div class="soal-hint">Buat kalimat menggunakan pola di atas.<br>Kata yang bisa dipakai: <b>${vocab}</b></div>
        <div class="grammar-info">Contoh: ${g.contoh[0]}</div>
        <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Buat kalimatmu sendiri..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Grammar._jawabBuild('${this._esc(g.pola)}')">✅ Submit</button>
          <button class="btn btn-abu" onclick="Grammar.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _jawabPattern(dipilih, benar) {
    tambahSkor(benar);
    const g = this.soalList[this.idx];
    el("pilihan-cont").querySelectorAll(".btn-pilihan-full").forEach(b => {
      b.disabled = true;
      if (g.contoh.includes(b.innerText)) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ Salah! ") + `Contoh benar: <b>${g.contoh[0]}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabCorrection(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const g = this.soalList[this.idx];
    // Cek apakah mengandung pola grammar
    const polaPart = g.pola.replace("……","").trim();
    const benar = input.includes(polaPart.split("……")[0] || polaPart);
    tambahSkor(benar);
    setHTML("hasil-box", (benar?"✅ Bagus! ":"❌ ") + `Jawaban: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabChoice(dipilih, jawaban) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    el("pilihan-cont").querySelectorAll(".btn-pilihan").forEach(b => {
      b.disabled = true;
      if (b.innerText === jawaban) b.classList.add("pilihan-benar");
      else if (b.innerText === dipilih && !benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box", (benar?"✅ Benar! ":"❌ Salah! ") + `Jawaban: <b>${jawaban}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabBuild(pola) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    // Sederhana: cek panjang > 3 karakter
    const benar = input.length >= 4;
    tambahSkor(benar);
    setHTML("hasil-box", benar ? "✅ Kalimat diterima! Bagus!" : "❌ Kalimat terlalu pendek.");
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },

  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    el("konten-utama").innerHTML = `
      <div class="selesai-wrap">
        <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
        <h2>Sesi Selesai!</h2>
        <div class="selesai-skor">
          <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
          <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
          <div class="skor-pct">${pct}%</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:20px;">
          <button class="btn btn-hijau" onclick="Grammar.mulai('${this.modeSaat}')">🔄 Ulangi</button>
          <button class="btn btn-biru" onclick="Grammar.kembaliMenu()">← Menu Grammar</button>
        </div>
      </div>`;
  },
  kembaliMenu(){ TTS.berhenti(); App.renderModul("grammar"); }
};


// ================================================================
//  DIALOGUE.JS — 5 Sub-Fitur Dialog Training
// ================================================================

const Dialogue = {
  idx: 0,
  modeSaat: null,
  dialogSaat: null,

  renderMenu() {
    const sub = [
      { id:"qa",       icon:"💬", label:"Q & A",              desc:"Jawab pertanyaan dalam Mandarin" },
      { id:"choose",   icon:"🎯", label:"Pilih Respon",        desc:"Pilih jawaban paling cocok" },
      { id:"continue", icon:"▶",  label:"Lanjutkan Dialog",   desc:"Lengkapi dialog yang terputus" },
      { id:"audio",    icon:"🔊", label:"Audio Dialog",        desc:"Dengar percakapan, jawab pertanyaan" },
      { id:"speaking", icon:"🎤", label:"Speaking Conv.",      desc:"AI bertanya, kamu jawab dengan suara" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Dialogue.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.dialogSaat = acak(DB.dialogues)[0];
    this.idx = 0;
    resetSkor();
    this.tampilSoal();
  },

  tampilSoal() {
    const d = this.dialogSaat;
    const mode = this.modeSaat;
    let html = "";

    if (mode === "qa") html = this._qa(d);
    else if (mode === "choose") html = this._choose(d);
    else if (mode === "continue") html = this._continue(d);
    else if (mode === "audio") html = this._audio(d);
    else if (mode === "speaking") html = this._speaking(d);

    el("konten-utama").innerHTML = html;
    if (mode === "audio") setTimeout(() => this._mainkanDialog(d), 400);
  },

  _renderDialog(d, sampaiIdx) {
    return d.giliran.slice(0, sampaiIdx ?? d.giliran.length).map(g => `
      <div class="dialog-baris ${g.peran==='A'||g.peran==='买家'||g.peran==='客人'?'kiri':'kanan'}">
        <span class="dialog-peran">${g.peran}:</span>
        <span class="dialog-hanzi">${g.hanzi}</span>
        <span class="dialog-arti">${g.arti}</span>
      </div>`).join("");
  },

  _qa(d) {
    const tanya = d.giliran[0];
    return `
      <div class="soal-wrap">
        <div class="label-mode">💬 Q & A Dialog</div>
        <div class="dialog-box">${this._renderDialog(d,1)}</div>
        <div class="soal-hint">Jawab pertanyaan di atas dalam Mandarin:</div>
        <textarea id="input-jawab" class="input-jawab" rows="2" placeholder="Tulis jawaban Hanzi..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Dialogue._jawabQA('${this._esc(d.giliran[1]?.hanzi||"")}')">✅ Submit</button>
          <button class="btn btn-biru" onclick="TTS.mandarin('${this._esc(tanya.hanzi)}')">🔊 Ulangi</button>
          <button class="btn btn-abu" onclick="Dialogue.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _choose(d) {
    const tanya = d.giliran[0];
    const benarResp = d.giliran[1]?.hanzi || "我很好。";
    const salah = ["没有问题。","谢谢你！","我不知道。"];
    const semua = acak([benarResp, ...salah]);
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎯 Pilih Respon</div>
        <div class="dialog-box">${this._renderDialog(d,1)}</div>
        <div class="soal-hint">Pilih respon yang paling tepat:</div>
        <div class="pilihan-list" id="pilihan-cont">
          ${semua.map(p=>`<button class="btn-pilihan-full" onclick="Dialogue._jawabChoose('${this._esc(p)}','${this._esc(benarResp)}')">${p}</button>`).join("")}
        </div>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row"><button class="btn btn-abu" onclick="Dialogue.kembaliMenu()">← Menu</button></div>
      </div>`;
  },

  _continue(d) {
    const sampai = Math.floor(d.giliran.length / 2);
    const target = d.giliran[sampai]?.hanzi || "";
    return `
      <div class="soal-wrap">
        <div class="label-mode">▶ Lanjutkan Dialog</div>
        <div class="dialog-box">${this._renderDialog(d, sampai)}</div>
        <div class="soal-hint">Lanjutkan dialog. ${d.giliran[sampai]?.peran || "B"} seharusnya berkata apa?</div>
        <textarea id="input-jawab" class="input-jawab" rows="2" placeholder="Tulis kelanjutan dialog..."></textarea>
        <div class="hasil-box" id="hasil-box"></div>
        <div class="btn-row">
          <button class="btn btn-hijau" onclick="Dialogue._jawabContinue('${this._esc(target)}')">✅ Submit</button>
          <button class="btn btn-abu" onclick="Dialogue.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _audio(d) {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🔊 Audio Dialog</div>
        <div class="audio-btn-wrap">
          <button class="btn-audio" id="btn-play-dialog" onclick="Dialogue._mainkanDialog(Dialogue.dialogSaat)">🔊 Putar Dialog</button>
        </div>
        <div class="hasil-box" id="status-audio" style="background:#f0f4f8">⏳ Memuat...</div>
        <div id="pertanyaan-cont" style="display:none">
          <div class="soal-hint">Jawab pertanyaan berikut:</div>
          ${d.pertanyaan.map((q,qi)=>`
            <div class="quiz-item" id="quiz-${qi}">
              <div class="quiz-soal">${q.soal}</div>
              <div class="pilihan-grid" id="pilihan-${qi}">
                ${q.pilihan.map((p,pi)=>`<button class="btn-pilihan" onclick="Dialogue._jawabAudio(${qi},${pi},${q.jawaban})">${p}</button>`).join("")}
              </div>
            </div>`).join("")}
        </div>
        <div class="btn-row"><button class="btn btn-abu" onclick="Dialogue.kembaliMenu()">← Menu</button></div>
      </div>`;
  },

  _mainkanDialog(d) {
    setTeks("status-audio", "🔊 Memutar dialog...");
    let i = 0;
    const main = () => {
      if (i >= d.giliran.length) {
        setTeks("status-audio", "✅ Dialog selesai. Jawab pertanyaan di bawah:");
        showEl("pertanyaan-cont");
        return;
      }
      setTeks("status-audio", `🔊 ${d.giliran[i].peran}: "${d.giliran[i].hanzi}"`);
      TTS.mandarin(d.giliran[i].hanzi, () => { i++; setTimeout(main, 500); });
    };
    main();
  },

  _speaking(d) {
    const pertanyaan = DB.sentences.filter(s => s.hanzi.includes("？"));
    const tanya = acak(pertanyaan)[0] || { hanzi:"你好吗？", arti:"Apa kabar?" };
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎤 Speaking Conversation</div>
        <div class="dialog-box">
          <div class="dialog-baris kanan">
            <span class="dialog-peran">AI:</span>
            <span class="dialog-hanzi">${tanya.hanzi}</span>
            <span class="dialog-arti">${tanya.arti}</span>
          </div>
        </div>
        <div class="soal-hint">Jawab pertanyaan AI dengan suara:</div>
        <div class="hasil-box" id="hasil-box">Tekan mic lalu bicara...</div>
        <div id="user-resp" style="display:none" class="dialog-box"></div>
        <div class="btn-row">
          <button class="btn btn-merah" id="btn-mic" onclick="Dialogue._jawabSpeaking()">🎤 Jawab</button>
          <button class="btn btn-biru" onclick="TTS.mandarin('${this._esc(tanya.hanzi)}')">🔊 Ulangi</button>
          <button class="btn btn-abu" onclick="Dialogue.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _jawabQA(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = input.length >= 2;
    tambahSkor(benar);
    setHTML("hasil-box", (benar?"✅ Jawaban diterima! ":"❌ ") + `Contoh: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if (inp) inp.disabled = true;
    setTimeout(()=>{ this.mulai(this.modeSaat); }, 2000);
  },

  _jawabChoose(dipilih, jawaban) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    el("pilihan-cont").querySelectorAll(".btn-pilihan-full").forEach(b=>{
      b.disabled=true;
      if(b.innerText===jawaban) b.classList.add("pilihan-benar");
      else if(b.innerText===dipilih&&!benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Respon: <b>${jawaban}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.mulai(this.modeSaat); }, 2000);
  },

  _jawabContinue(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = input.length >= 2;
    tambahSkor(benar);
    setHTML("hasil-box", (benar?"✅ Bagus! ":"❌ ") + `Contoh: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if (inp) inp.disabled=true;
    setTimeout(()=>{ this.mulai(this.modeSaat); }, 2000);
  },

  _jawabAudio(qi, pi, jawaban) {
    const benar = pi === jawaban;
    tambahSkor(benar);
    const cont = el("pilihan-"+qi);
    cont.querySelectorAll(".btn-pilihan").forEach((b,i)=>{
      b.disabled=true;
      if(i===jawaban) b.classList.add("pilihan-benar");
      else if(i===pi&&!benar) b.classList.add("pilihan-salah");
    });
    const res = document.createElement("div");
    res.className="hasil-box "+(benar?"benar":"salah");
    res.innerText=(benar?"✅ Benar!":"❌ Salah!");
    el("quiz-"+qi).appendChild(res);
  },

  _jawabSpeaking() {
    const btnMic = el("btn-mic");
    if(btnMic){ btnMic.disabled=true; btnMic.innerText="🎙️..."; }
    STT.mulai("zh-CN",
      (hasil)=>{
        tambahSkor(true);
        const respBox = el("user-resp");
        if(respBox){
          respBox.style.display="block";
          respBox.innerHTML=`<div class="dialog-baris kiri"><span class="dialog-peran">Kamu:</span><span class="dialog-hanzi">${hasil}</span></div>`;
        }
        setHTML("hasil-box","✅ Respon diterima! Bagus!");
        el("hasil-box").className="hasil-box benar";
        if(btnMic){ btnMic.disabled=false; btnMic.innerText="🎤 Jawab Lagi"; }
      },
      (err)=>{ setTeks("hasil-box","❌ "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} },
      (dapat)=>{ if(!dapat){ setTeks("hasil-box","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} } }
    );
  },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },
  kembaliMenu(){ TTS.berhenti(); STT.berhenti(); App.renderModul("dialogue"); }
};


// ================================================================
//  LISTENING.JS — 6 Sub-Fitur Listening Training
// ================================================================

const Listening = {
  idx: 0,
  modeSaat: null,
  soalList: [],

  renderMenu() {
    const sub = [
      { id:"vocab",    icon:"🔊", label:"Vocab Listening",   desc:"Dengar kata, pilih artinya" },
      { id:"sentence", icon:"📻", label:"Sentence Listening",desc:"Dengar kalimat, pilih terjemahan" },
      { id:"dialogue", icon:"💬", label:"Dialogue Listening",desc:"Dengar percakapan, jawab pertanyaan" },
      { id:"dictation",icon:"✍️",  label:"Dikte Audio",      desc:"Dengar lalu ketik apa yang kamu dengar" },
      { id:"shadowing",icon:"🎭", label:"Shadowing",         desc:"Tiru pengucapan audio" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Listening.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.idx = 0;
    resetSkor();
    if (mode === "vocab") this.soalList = acak(DB.vocab).slice(0,8);
    else if (mode === "sentence" || mode === "dictation" || mode === "shadowing") this.soalList = acak(DB.sentences).slice(0,8);
    else if (mode === "dialogue") { this.soalList = [acak(DB.dialogues)[0]]; }
    this.tampilSoal();
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    const total = this.soalList.length;
    const hdr = `<div class="soal-header"><div class="progres-teks">Soal ${this.idx+1}/${total}</div><div class="skor-mini">✅${sesiSkor.benar} ❌${sesiSkor.salah}</div></div><div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>`;
    const mode = this.modeSaat;
    let html = hdr;
    if (mode==="vocab") html += this._vocab(item);
    else if (mode==="sentence") html += this._sentence(item);
    else if (mode==="dialogue") html += this._dialogue(item);
    else if (mode==="dictation") html += this._dictation(item);
    else if (mode==="shadowing") html += this._shadowing(item);
    el("konten-utama").innerHTML = html;
    setTimeout(()=>{
      const hanzi = item.hanzi || item.arti;
      if(hanzi) TTS.mandarin(item.hanzi||"");
    }, 300);
  },

  _vocab(v) {
    const salah = acak(DB.vocab.filter(x=>x.arti!==v.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([v.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode">🔊 Vocab Listening</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${v.hanzi}')">🔊 Ulangi</button></div>
      <div class="soal-hint">Dengar audio lalu pilih arti yang benar:</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan" onclick="Listening._pilih('${p}','${v.arti}','${v.hanzi}','${v.pinyin}')">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Listening.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _sentence(s) {
    const salah = acak(DB.sentences.filter(x=>x.arti!==s.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([s.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode">📻 Sentence Listening</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Ulangi</button></div>
      <div class="soal-hint">Pilih terjemahan yang benar:</div>
      <div class="pilihan-list" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan-full" onclick="Listening._pilih('${this._esc(p)}','${this._esc(s.arti)}','${this._esc(s.hanzi)}')">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Listening.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _dictation(s) {
    return `<div class="soal-wrap">
      <div class="label-mode">✍️ Dikte Audio</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Ulangi</button></div>
      <div class="soal-hint">Ketik kalimat yang kamu dengar:</div>
      <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Ketik Hanzi..."></textarea>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Listening._jawabDikte('${this._esc(s.hanzi)}')">✅ Submit</button>
        <button class="btn btn-abu" onclick="Listening.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _shadowing(s) {
    return `<div class="soal-wrap">
      <div class="label-mode">🎭 Shadowing</div>
      <div class="soal-hint">Dengar lalu tirukan kalimat ini:</div>
      <div class="soal-kalimat">${s.hanzi}</div>
      <div class="soal-pinyin-hint">${s.pinyin}</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Dengar</button></div>
      <div class="hasil-box" id="hasil-box">Dengar dulu, lalu tekan Mic untuk meniru...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Listening._jawabShadow('${this._esc(s.hanzi)}')">🎤 Tirukan</button>
        <button class="btn btn-abu" onclick="Listening.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _dialogue(d) {
    return `<div class="soal-wrap">
      <div class="label-mode">💬 Dialogue Listening</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="Dialogue._mainkanDialog(Listening.soalList[0])">🔊 Putar Dialog</button></div>
      <div class="hasil-box" id="status-audio">Tekan putar untuk mendengarkan...</div>
      <div id="pertanyaan-cont" style="display:none">
        <div class="soal-hint">Jawab pertanyaan:</div>
        ${d.pertanyaan.map((q,qi)=>`
          <div class="quiz-item" id="lquiz-${qi}">
            <div class="quiz-soal">${q.soal}</div>
            <div class="pilihan-grid" id="lpilihan-${qi}">
              ${q.pilihan.map((p,pi)=>`<button class="btn-pilihan" onclick="Listening._jawabDialog(${qi},${pi},${q.jawaban})">${p}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Listening.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _pilih(dipilih, jawaban, hanzi, pinyin) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    const cont = el("pilihan-cont");
    if(cont) cont.querySelectorAll(".btn-pilihan,.btn-pilihan-full").forEach(b=>{
      b.disabled=true;
      if(b.innerText===jawaban) b.classList.add("pilihan-benar");
      else if(b.innerText===dipilih&&!benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`${hanzi||""} = <b>${jawaban}</b>${pinyin?` (${pinyin})`:"" }`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1600);
  },

  _jawabDikte(target) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = cekHanzi(input, target);
    tambahSkor(benar);
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Jawaban: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if(inp) inp.disabled=true;
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _jawabShadow(target) {
    const btnMic = el("btn-mic");
    if(btnMic){ btnMic.disabled=true; btnMic.innerText="🎙️..."; }
    STT.mulai("zh-CN",
      (hasil,semua)=>{
        const targetClean = target.replace(/[。？！，]/g,"");
        const benar = semua.some(h=>{
          const hc=h.replace(/[。？！，]/g,"");
          const sama=[...targetClean].filter((c,i)=>hc[i]===c).length;
          return sama>=Math.floor(targetClean.length*0.5);
        });
        tambahSkor(benar);
        setHTML("hasil-box",(benar?"✅ Bagus! ":"❌ Kurang tepat. ")+`Kamu: "${hasil}"<br>Target: <b>${target}</b>`);
        el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
        if(btnMic){ btnMic.disabled=false; btnMic.innerText="🎤 Tirukan Lagi"; }
        setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 2500);
      },
      (err)=>{ setTeks("hasil-box","❌ "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} },
      (dapat)=>{ if(!dapat){ setTeks("hasil-box","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba Lagi";} } }
    );
  },

  _jawabDialog(qi, pi, jawaban) {
    const benar = pi === jawaban;
    tambahSkor(benar);
    const cont = el("lpilihan-"+qi);
    cont.querySelectorAll(".btn-pilihan").forEach((b,i)=>{
      b.disabled=true;
      if(i===jawaban) b.classList.add("pilihan-benar");
      else if(i===pi&&!benar) b.classList.add("pilihan-salah");
    });
    const res=document.createElement("div");
    res.className="hasil-box "+(benar?"benar":"salah");
    res.innerText=(benar?"✅ Benar!":"❌ Salah!");
    el("lquiz-"+qi).appendChild(res);
  },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },

  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    el("konten-utama").innerHTML = `<div class="selesai-wrap">
      <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
      <h2>Sesi Selesai!</h2>
      <div class="selesai-skor">
        <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
        <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
        <div class="skor-pct">${pct}%</div>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:20px;">
        <button class="btn btn-hijau" onclick="Listening.mulai('${this.modeSaat}')">🔄 Ulangi</button>
        <button class="btn btn-biru" onclick="Listening.kembaliMenu()">← Menu Listening</button>
      </div>
    </div>`;
  },
  kembaliMenu(){ TTS.berhenti(); STT.berhenti(); App.renderModul("listening"); }
};


// ================================================================
//  READING.JS — 5 Sub-Fitur Reading Training
// ================================================================

const Reading = {
  idx: 0,
  modeSaat: null,
  passageSaat: null,

  renderMenu() {
    const sub = [
      { id:"sentence",     icon:"📖", label:"Sentence Reading",    desc:"Baca kalimat & jawab pertanyaan" },
      { id:"paragraph",    icon:"📄", label:"Paragraph Reading",   desc:"Baca paragraf & terjemahkan" },
      { id:"comprehension",icon:"🧠", label:"Comprehension Q",     desc:"Jawab pertanyaan isi teks" },
      { id:"main-idea",    icon:"💡", label:"Main Idea",           desc:"Temukan ide pokok teks" },
      { id:"cloze",        icon:"📝", label:"Cloze Passage",       desc:"Isi kata-kata yang hilang di teks" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Reading.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.passageSaat = acak(DB.passages)[0];
    this.idx = 0;
    resetSkor();
    this.tampilSoal();
  },

  tampilSoal() {
    const p = this.passageSaat;
    const mode = this.modeSaat;
    let html = "";
    if (mode==="sentence") html = this._sentence();
    else if (mode==="paragraph") html = this._paragraph(p);
    else if (mode==="comprehension") html = this._comprehension(p);
    else if (mode==="main-idea") html = this._mainIdea(p);
    else if (mode==="cloze") html = this._cloze(p);
    el("konten-utama").innerHTML = html;
  },

  _sentence() {
    const s = acak(DB.sentences)[0];
    const salah = acak(DB.sentences.filter(x=>x.arti!==s.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([s.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode">📖 Sentence Reading</div>
      <div class="reading-teks">${s.hanzi}</div>
      <div class="soal-hint">${s.pinyin}</div>
      <div class="soal-hint">Pilih terjemahan yang benar:</div>
      <div class="pilihan-list" id="pilihan-cont">
        ${semua.map(opt=>`<button class="btn-pilihan-full" onclick="Reading._pilih('${this._esc(opt)}','${this._esc(s.arti)}','${this._esc(s.hanzi)}')">${opt}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _paragraph(p) {
    return `<div class="soal-wrap">
      <div class="label-mode">📄 Paragraph Reading</div>
      <div class="reading-judul">${p.judul}</div>
      <div class="reading-teks">${p.teks}</div>
      <div class="terjemahan-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        💡 Lihat Terjemahan ▾
      </div>
      <div class="terjemahan-box" style="display:none">${p.terjemahan}</div>
      <div class="btn-row">
        <button class="btn btn-biru" onclick="Reading.mulai(Reading.modeSaat)">📄 Teks Lain</button>
        <button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _comprehension(p) {
    if (this.idx >= p.pertanyaan.length) { this.tampilSelesai(); return ""; }
    const q = p.pertanyaan[this.idx];
    return `<div class="soal-wrap">
      <div class="label-mode">🧠 Comprehension</div>
      <div class="reading-teks compact">${p.teks}</div>
      <div class="quiz-soal" style="margin:12px 0">${q.soal}</div>
      <div class="pilihan-list" id="pilihan-cont">
        ${q.pilihan.map((opt,pi)=>`<button class="btn-pilihan-full" onclick="Reading._pilihComp(${pi},${q.jawaban},'${this._esc(q.pilihan[q.jawaban])}')">${opt}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _mainIdea(p) {
    const benar = p.pertanyaan[p.pertanyaan.length-1];
    return `<div class="soal-wrap">
      <div class="label-mode">💡 Main Idea</div>
      <div class="reading-teks compact">${p.teks}</div>
      <div class="quiz-soal" style="margin:12px 0">${benar.soal}</div>
      <div class="pilihan-list" id="pilihan-cont">
        ${benar.pilihan.map((opt,pi)=>`<button class="btn-pilihan-full" onclick="Reading._pilihComp(${pi},${benar.jawaban},'${this._esc(benar.pilihan[benar.jawaban])}')">${opt}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _cloze(p) {
    // Ambil beberapa kata dari teks dan buat blank
    const kata = DB.vocab.filter(v => p.teks.includes(v.hanzi) && v.hanzi.length >= 2);
    if (!kata.length) { this.modeSaat = "paragraph"; this.tampilSoal(); return ""; }
    const target = acak(kata)[0];
    const blankTeks = p.teks.replace(target.hanzi, `<span class="cloze-blank">___</span>`);
    const salah = acak(DB.vocab.filter(v=>v.hanzi!==target.hanzi)).slice(0,3).map(v=>v.hanzi);
    const semua = acak([target.hanzi,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode">📝 Cloze Passage</div>
      <div class="reading-teks">${blankTeks}</div>
      <div class="soal-hint">Pilih kata yang tepat untuk mengisi ___:</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(opt=>`<button class="btn-pilihan hanzi" onclick="Reading._pilih('${opt}','${target.hanzi}')">${opt}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Menu</button></div>
    </div>`;
  },

  _pilih(dipilih, jawaban, hanzi) {
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    const cont = el("pilihan-cont");
    if(cont) cont.querySelectorAll(".btn-pilihan,.btn-pilihan-full").forEach(b=>{
      b.disabled=true;
      if(b.innerText===jawaban) b.classList.add("pilihan-benar");
      else if(b.innerText===dipilih&&!benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Jawaban: <b>${jawaban}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.mulai(this.modeSaat); }, 1800);
  },

  _pilihComp(pi, jawaban, jawabanTeks) {
    const benar = pi === jawaban;
    tambahSkor(benar);
    el("pilihan-cont").querySelectorAll(".btn-pilihan-full").forEach((b,i)=>{
      b.disabled=true;
      if(i===jawaban) b.classList.add("pilihan-benar");
      else if(i===pi&&!benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Jawaban: <b>${jawabanTeks}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.idx++; this.tampilSoal(); }, 1800);
  },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },

  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    el("konten-utama").innerHTML = `<div class="selesai-wrap">
      <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
      <h2>Sesi Selesai!</h2>
      <div class="selesai-skor">
        <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
        <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
        <div class="skor-pct">${pct}%</div>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:20px;">
        <button class="btn btn-hijau" onclick="Reading.mulai('${this.modeSaat}')">🔄 Ulangi</button>
        <button class="btn btn-biru" onclick="Reading.kembaliMenu()">← Menu Reading</button>
      </div>
    </div>`;
  },
  kembaliMenu(){ App.renderModul("reading"); }
};


// ================================================================
//  WRITING.JS — 5 Sub-Fitur Writing Training
// ================================================================

const Writing = {
  idx: 0,
  modeSaat: null,
  soalList: [],

  renderMenu() {
    const sub = [
      { id:"hanzi-typing",    icon:"⌨️",  label:"Hanzi Typing",       desc:"Ketik Hanzi dari Pinyin yang diberikan" },
      { id:"pinyin-typing",   icon:"🔤", label:"Pinyin Typing",      desc:"Ketik Pinyin dari Hanzi yang diberikan" },
      { id:"translate",       icon:"🌐", label:"Translate Writing",  desc:"Terjemahkan Indonesia ke Hanzi" },
      { id:"free-sentence",   icon:"✍️",  label:"Free Sentence",      desc:"Buat kalimatmu sendiri" },
      { id:"paragraph",       icon:"📝", label:"Paragraph Writing",  desc:"Tulis paragraf pendek" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Writing.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.idx = 0;
    resetSkor();
    if (mode==="hanzi-typing"||mode==="pinyin-typing") this.soalList = acak(DB.vocab).slice(0,8);
    else if (mode==="translate") this.soalList = acak(DB.sentences).slice(0,6);
    else this.soalList = [{}];
    this.tampilSoal();
  },

  tampilSoal() {
    const mode = this.modeSaat;
    const item = this.soalList[this.idx] || {};
    const total = this.soalList.length;
    let html = `<div class="soal-header"><div class="progres-teks">Soal ${this.idx+1}/${total}</div><div class="skor-mini">✅${sesiSkor.benar} ❌${sesiSkor.salah}</div></div><div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>`;
    if(mode==="hanzi-typing") html+=this._hanziTyping(item);
    else if(mode==="pinyin-typing") html+=this._pinyinTyping(item);
    else if(mode==="translate") html+=this._translate(item);
    else if(mode==="free-sentence") html+=this._free();
    else if(mode==="paragraph") html+=this._paragraph();
    el("konten-utama").innerHTML = html;
  },

  _hanziTyping(v) {
    return `<div class="soal-wrap">
      <div class="label-mode">⌨️ Hanzi Typing</div>
      <div class="soal-hanzi">${v.pinyin}</div>
      <div class="soal-hint">Ketik Hanzi untuk Pinyin di atas:</div>
      <input type="text" id="input-jawab" class="input-jawab" placeholder="Ketik Hanzi...">
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Writing._jawab('${this._esc(v.hanzi)}', false)">✅ Submit</button>
        <button class="btn btn-abu" onclick="Writing.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _pinyinTyping(v) {
    return `<div class="soal-wrap">
      <div class="label-mode">🔤 Pinyin Typing</div>
      <div class="soal-hanzi">${v.hanzi}</div>
      <div class="soal-hint">Ketik Pinyin (dengan tanda nada) untuk karakter di atas:</div>
      <div id="kb-pinyin-cont"></div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Writing._jawabPinyin('${this._esc(v.pinyin)}')">✅ Submit</button>
        <button class="btn btn-abu" onclick="Writing.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _translate(s) {
    return `<div class="soal-wrap">
      <div class="label-mode">🌐 Translate Writing</div>
      <div class="soal-kalimat indo">${s.arti}</div>
      <div class="soal-hint">Terjemahkan ke Hanzi:</div>
      <textarea id="input-jawab" class="input-jawab" rows="3" placeholder="Tulis Hanzi..."></textarea>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Writing._jawab('${this._esc(s.hanzi)}', true)">✅ Submit</button>
        <button class="btn btn-kuning" onclick="Writing._skip('${this._esc(s.hanzi)}')">⏭ Skip</button>
        <button class="btn btn-abu" onclick="Writing.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _free() {
    const vocab = acak(DB.vocab).slice(0,3).map(v=>`${v.hanzi}(${v.arti})`).join("、");
    return `<div class="soal-wrap">
      <div class="label-mode">✍️ Free Sentence Writing</div>
      <div class="soal-hint">Buat kalimat Mandarin menggunakan kata-kata berikut:<br><b>${vocab}</b></div>
      <textarea id="input-jawab" class="input-jawab" rows="4" placeholder="Tulis kalimatmu..."></textarea>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Writing._jawabFree()">✅ Submit</button>
        <button class="btn btn-abu" onclick="Writing.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _paragraph() {
    const topik = acak(["keluargaku","hobimu","hari libur","sekolah","makanan favorit"])[0];
    return `<div class="soal-wrap">
      <div class="label-mode">📝 Paragraph Writing</div>
      <div class="soal-hint">Tulis paragraf pendek (3-5 kalimat) tentang: <b>${topik}</b></div>
      <textarea id="input-jawab" class="input-jawab" rows="8" placeholder="Tulis paragrafmu dalam Hanzi atau Pinyin..."></textarea>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row">
        <button class="btn btn-hijau" onclick="Writing._jawabParagraph()">✅ Submit</button>
        <button class="btn btn-abu" onclick="Writing.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _jawab(target, isHanzi) {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if (!input) return;
    const benar = isHanzi ? cekHanzi(input, target) : cekHanzi(input, target);
    tambahSkor(benar);
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Jawaban: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    if(inp) inp.disabled=true;
    setTimeout(()=>{ this.idx++; if(this.idx>=this.soalList.length) this.tampilSelesai(); else this.tampilSoal(); }, 1800);
  },

  _jawabPinyin(target) {
    const input = getKbTeks();
    if (!input) return;
    const benar = cekPinyin(input, target);
    tambahSkor(benar);
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`Pinyin: <b>${target}</b>`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setTimeout(()=>{ this.idx++; if(this.idx>=this.soalList.length) this.tampilSelesai(); else this.tampilSoal(); }, 1800);
  },

  _jawabFree() {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if(!input||input.length<3) { setTeks("hasil-box","⚠️ Tulis minimal 1 kalimat."); return; }
    tambahSkor(true);
    setTeks("hasil-box","✅ Kalimat diterima! Bagus!");
    el("hasil-box").className="hasil-box benar";
    if(inp) inp.disabled=true;
    setTimeout(()=>{ this.tampilSoal(); }, 1500);
  },

  _jawabParagraph() {
    const inp = el("input-jawab");
    const input = inp ? inp.value.trim() : "";
    if(!input||input.length<5) { setTeks("hasil-box","⚠️ Tulis lebih banyak!"); return; }
    tambahSkor(true);
    setHTML("hasil-box","✅ Paragraf diterima! Kata: "+input.length+" karakter");
    el("hasil-box").className="hasil-box benar";
    if(inp) inp.disabled=true;
  },

  _skip(target) {
    tambahSkor(false);
    setHTML("hasil-box",`⏭ Di-skip. Jawaban: <b>${target}</b>`);
    el("hasil-box").className="hasil-box salah";
    setTimeout(()=>{ this.idx++; if(this.idx>=this.soalList.length) this.tampilSelesai(); else this.tampilSoal(); }, 1500);
  },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },
  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    el("konten-utama").innerHTML = `<div class="selesai-wrap">
      <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
      <h2>Sesi Selesai!</h2>
      <div class="selesai-skor">
        <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
        <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
        <div class="skor-pct">${pct}%</div>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:20px;">
        <button class="btn btn-hijau" onclick="Writing.mulai('${this.modeSaat}')">🔄 Ulangi</button>
        <button class="btn btn-biru" onclick="Writing.kembaliMenu()">← Menu Writing</button>
      </div>
    </div>`;
  },
  kembaliMenu() {
    setTimeout(()=>{ if(el("kb-pinyin-cont")) buildKbPinyin("kb-display"); }, 100);
    App.renderModul("writing");
  }
};


// ================================================================
//  SPEAKING.JS — 6 Sub-Fitur Speaking / HSKK
// ================================================================

const Speaking = {
  idx: 0,
  modeSaat: null,
  soalList: [],

  renderMenu() {
    const sub = [
      { id:"repeat",    icon:"🔁", label:"Repeat Sentence",  desc:"Dengar dan ulangi kalimat" },
      { id:"read-aloud",icon:"📢", label:"Read Aloud",       desc:"Baca kalimat dengan suara" },
      { id:"answer",    icon:"💬", label:"Answer Question",  desc:"Jawab pertanyaan secara lisan" },
      { id:"describe",  icon:"🖼️",  label:"Describe Picture", desc:"Deskripsikan gambar/situasi" },
      { id:"opinion",   icon:"🗣️",  label:"Give Opinion",    desc:"Sampaikan pendapatmu tentang topik" },
      { id:"story",     icon:"📖", label:"Storytelling",     desc:"Ceritakan pengalaman singkat" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Speaking.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.idx = 0;
    resetSkor();
    this.soalList = acak(DB.sentences).slice(0, 6);
    this.tampilSoal();
  },

  tampilSoal() {
    const mode = this.modeSaat;
    const item = this.soalList[this.idx] || {};
    const total = this.soalList.length;
    const hdr = `<div class="soal-header"><div class="progres-teks">Soal ${this.idx+1}/${total}</div><div class="skor-mini">✅${sesiSkor.benar} ❌${sesiSkor.salah}</div></div><div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>`;
    let html = hdr;
    if (mode==="repeat")     html+=this._repeat(item);
    else if(mode==="read-aloud") html+=this._readAloud(item);
    else if(mode==="answer")     html+=this._answer();
    else if(mode==="describe")   html+=this._describe();
    else if(mode==="opinion")    html+=this._opinion();
    else if(mode==="story")      html+=this._story();
    el("konten-utama").innerHTML = html;
    if(mode==="repeat") setTimeout(()=>TTS.mandarin(item.hanzi||""), 400);
  },

  _repeat(s) {
    return `<div class="soal-wrap">
      <div class="label-mode">🔁 Repeat Sentence</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Putar</button></div>
      <div class="soal-hint">Dengar lalu ulangi kalimat ini:</div>
      <div class="soal-kalimat">${s.hanzi}</div>
      <div class="soal-pinyin-hint">${s.pinyin}</div>
      <div class="hasil-box" id="hasil-box">Tekan mic...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabSuara('${this._esc(s.hanzi)}')">🎤 Ulangi</button>
        <button class="btn btn-kuning" onclick="Speaking._next()">⏭ Berikutnya</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _readAloud(s) {
    return `<div class="soal-wrap">
      <div class="label-mode">📢 Read Aloud</div>
      <div class="soal-kalimat">${s.hanzi}</div>
      <div class="soal-pinyin-hint">${s.pinyin}</div>
      <div class="soal-hint">Baca kalimat di atas dengan suara:</div>
      <div class="hasil-box" id="hasil-box">Tekan mic untuk mulai membaca...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabSuara('${this._esc(s.hanzi)}')">🎤 Baca</button>
        <button class="btn btn-biru" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Contoh</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _answer() {
    const pertanyaan = acak(DB.sentences.filter(s=>s.hanzi.includes("？")))[0] || DB.sentences[0];
    return `<div class="soal-wrap">
      <div class="label-mode">💬 Answer Question</div>
      <div class="soal-kalimat">${pertanyaan.hanzi}</div>
      <div class="soal-pinyin-hint">${pertanyaan.pinyin}</div>
      <div class="soal-hint">${pertanyaan.arti}</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(pertanyaan.hanzi)}')">🔊 Dengar Pertanyaan</button></div>
      <div class="hasil-box" id="hasil-box">Jawab dengan suara...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabBebas()">🎤 Jawab</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _describe() {
    const situasi = acak(["🌧️ Hari hujan","🏫 Di sekolah","🛒 Di pasar","🏠 Di rumah","🌳 Di taman"])[0];
    return `<div class="soal-wrap">
      <div class="label-mode">🖼️ Describe Picture</div>
      <div class="soal-hanzi" style="font-size:48px">${situasi.split(" ")[0]}</div>
      <div class="soal-hint">Situasi: <b>${situasi.split(" ").slice(1).join(" ")}</b></div>
      <div class="soal-hint">Deskripsikan situasi ini dalam bahasa Mandarin (2-3 kalimat):</div>
      <div class="hasil-box" id="hasil-box">Tekan mic untuk mulai...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabBebas()">🎤 Deskripsikan</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _opinion() {
    const topik = acak(["你怎么看网络购物？","你喜欢看电影还是看书？","你觉得学外语难吗？","你对运动有什么看法？"])[0];
    return `<div class="soal-wrap">
      <div class="label-mode">🗣️ Give Opinion</div>
      <div class="soal-kalimat">${topik}</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${topik}')">🔊 Dengar</button></div>
      <div class="soal-hint">Sampaikan pendapatmu (minimal 2-3 kalimat):</div>
      <div class="hasil-box" id="hasil-box">Tekan mic...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabBebas()">🎤 Bicara</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _story() {
    const prompt = acak(["Ceritakan liburanmu","Ceritakan harimu tadi","Ceritakan tentang temanmu","Ceritakan pengalaman belanja"])[0];
    return `<div class="soal-wrap">
      <div class="label-mode">📖 Storytelling</div>
      <div class="soal-hint">Topik: <b>${prompt}</b></div>
      <div class="soal-hint">Ceritakan dalam bahasa Mandarin (minimal 3 kalimat):</div>
      <div class="hasil-box" id="hasil-box">Tekan mic untuk mulai bercerita...</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabBebas()">🎤 Mulai Cerita</button>
        <button class="btn btn-abu" onclick="Speaking.kembaliMenu()">← Menu</button>
      </div>
    </div>`;
  },

  _jawabSuara(target) {
    const btnMic = el("btn-mic");
    if(btnMic){ btnMic.disabled=true; btnMic.innerText="🎙️..."; }
    STT.mulai("zh-CN",
      (hasil,semua)=>{
        const targetClean = target.replace(/[。？！，]/g,"");
        const benar = semua.some(h=>{
          const hc=h.replace(/[。？！，]/g,"");
          const sama=[...targetClean].filter((c,i)=>hc[i]===c).length;
          return sama>=Math.floor(targetClean.length*0.5);
        });
        tambahSkor(benar);
        setHTML("hasil-box",(benar?"✅ Bagus! ":"❌ Kurang tepat. ")+`Kamu: "${hasil}"<br>Target: <b>${target}</b>`);
        el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
        if(btnMic){ btnMic.disabled=false; btnMic.innerText="🎤 Ulangi"; }
        setTimeout(()=>this._next(), 2500);
      },
      (err)=>{ setTeks("hasil-box","❌ "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba";} },
      (dapat)=>{ if(!dapat){ setTeks("hasil-box","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba";} } }
    );
  },

  _jawabBebas() {
    const btnMic = el("btn-mic");
    if(btnMic){ btnMic.disabled=true; btnMic.innerText="🎙️ Mendengarkan..."; }
    STT.mulai("zh-CN",
      (hasil)=>{
        tambahSkor(true);
        setHTML("hasil-box",`✅ Kamu berkata: "<b>${hasil}</b>" — Bagus!`);
        el("hasil-box").className="hasil-box benar";
        if(btnMic){ btnMic.disabled=false; btnMic.innerText="🎤 Bicara Lagi"; }
      },
      (err)=>{ setTeks("hasil-box","❌ "+err); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba";} },
      (dapat)=>{ if(!dapat){ setTeks("hasil-box","⚠️ Tidak terdeteksi."); if(btnMic){btnMic.disabled=false;btnMic.innerText="🎤 Coba";} } }
    );
  },

  _next() { this.idx++; if(this.idx>=this.soalList.length) this.tampilSelesai(); else this.tampilSoal(); },

  _esc(s){ return (s||"").replace(/'/g,"\\'"); },
  tampilSelesai() {
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    el("konten-utama").innerHTML = `<div class="selesai-wrap">
      <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"👍":"💪"}</div>
      <h2>Sesi Selesai!</h2>
      <div class="selesai-skor">
        <div>✅ Benar: <b>${sesiSkor.benar}</b></div>
        <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
        <div class="skor-pct">${pct}%</div>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:20px;">
        <button class="btn btn-hijau" onclick="Speaking.mulai('${this.modeSaat}')">🔄 Ulangi</button>
        <button class="btn btn-biru" onclick="Speaking.kembaliMenu()">← Menu Speaking</button>
      </div>
    </div>`;
  },
  kembaliMenu(){ TTS.berhenti(); STT.berhenti(); App.renderModul("speaking"); }
};


// ================================================================
//  EXAM.JS — 5 Sub-Fitur Exam Mode (HSK/HSKK Simulasi)
// ================================================================

const Exam = {
  idx: 0,
  modeSaat: null,
  soalList: [],
  salahList: [],
  waktuSisa: 0,

  renderMenu() {
    const sub = [
      { id:"hsk-mock",   icon:"📋", label:"HSK Mock Test",       desc:"Simulasi ujian HSK (Listening + Reading)" },
      { id:"hskk-mock",  icon:"🎤", label:"HSKK Mock Test",      desc:"Simulasi ujian berbicara HSKK" },
      { id:"timed",      icon:"⏱️",  label:"Timed Quiz",          desc:"Kuis dengan batas waktu" },
      { id:"review",     icon:"🔍", label:"Review Jawaban Salah", desc:"Ulangi soal yang pernah salah" },
      { id:"adaptive",   icon:"🎯", label:"Adaptive Quiz",       desc:"Tingkat kesulitan otomatis menyesuaikan" },
    ];
    return `<div class="sub-menu-grid">${sub.map(f=>`
      <div class="sub-card" onclick="Exam.mulai('${f.id}')">
        <div class="sub-icon">${f.icon}</div>
        <div class="sub-label">${f.label}</div>
        <div class="sub-desc">${f.desc}</div>
      </div>`).join("")}</div>`;
  },

  mulai(mode) {
    this.modeSaat = mode;
    this.idx = 0;
    this.salahList = [];
    resetSkor();
    if (mode==="hsk-mock") this.soalList = this._buatSoalHSK();
    else if (mode==="hskk-mock") this.soalList = acak(DB.sentences).slice(0,5);
    else if (mode==="timed") { this.soalList = acak([...DB.vocab.slice(0,20)]).slice(0,10); this.waktuSisa = 60; }
    else if (mode==="review") {
      const prog = ambilProgress();
      this.soalList = prog.salah ? acak(prog.salah).slice(0,8) : acak(DB.vocab).slice(0,8);
    }
    else if (mode==="adaptive") this.soalList = this._buatSoalAdaptive();
    this.tampilSoal();
  },

  _buatSoalHSK() {
    const listening = acak(DB.sentences).slice(0,5).map(s=>({
      tipe:"listening", data:s
    }));
    const reading = acak(DB.vocab).slice(0,5).map(v=>({
      tipe:"reading", data:v
    }));
    return [...listening, ...reading];
  },

  _buatSoalAdaptive() {
    const prog = ambilProgress();
    const level = prog.level || 1;
    const filtered = DB.vocab.filter(v => v.level <= level+1);
    return acak(filtered).slice(0,10);
  },

  tampilSoal() {
    if (this.idx >= this.soalList.length) { this.tampilSelesai(); return; }
    const item = this.soalList[this.idx];
    const total = this.soalList.length;
    const hdr = `<div class="soal-header">
      <div class="progres-teks">Soal ${this.idx+1}/${total}</div>
      <div class="skor-mini" id="skor-mini">✅${sesiSkor.benar} ❌${sesiSkor.salah}</div>
    </div>
    <div class="progres-bar"><div class="progres-fill" style="width:${(this.idx/total)*100}%"></div></div>`;

    let html = hdr;
    const mode = this.modeSaat;

    if (mode==="hsk-mock" && item.tipe==="listening") html+=this._hskListening(item.data);
    else if (mode==="hsk-mock" && item.tipe==="reading") html+=this._hskReading(item.data);
    else if (mode==="hskk-mock") html+=this._hskk(item);
    else if (mode==="timed") html+=this._timed(item);
    else if (mode==="review") html+=this._review(item);
    else if (mode==="adaptive") html+=this._adaptive(item);

    el("konten-utama").innerHTML = html;

    if (mode==="hsk-mock" && this.soalList[this.idx]?.tipe==="listening") {
      setTimeout(()=>TTS.mandarin(item.data.hanzi||""), 500);
    }
    if (mode==="timed") this._mulaiTimer();
  },

  _hskListening(s) {
    const salah = acak(DB.sentences.filter(x=>x.arti!==s.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([s.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">📋 HSK — Listening</div>
      <div class="audio-btn-wrap"><button class="btn-audio" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Putar</button></div>
      <div class="soal-hint">Dengar dan pilih terjemahan yang benar:</div>
      <div class="pilihan-list" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan-full" onclick="Exam._pilih('${this._esc(p)}','${this._esc(s.arti)}',${JSON.stringify(s)})">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button></div>
    </div>`;
  },

  _hskReading(v) {
    const salah = acak(DB.vocab.filter(x=>x.arti!==v.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([v.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">📋 HSK — Reading</div>
      <div class="soal-hanzi">${v.hanzi}</div>
      <div class="soal-hint">Pilih arti yang benar:</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan" onclick="Exam._pilih('${p}','${v.arti}',${JSON.stringify(v)})">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button></div>
    </div>`;
  },

  _hskk(s) {
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">🎤 HSKK — Speaking</div>
      <div class="soal-kalimat">${s.hanzi}</div>
      <div class="soal-pinyin-hint">${s.pinyin}</div>
      <div class="soal-hint">${s.arti}</div>
      <div class="hasil-box" id="hasil-box">Baca kalimat di atas lalu tekan Submit.</div>
      <div class="btn-row">
        <button class="btn btn-merah" id="btn-mic" onclick="Speaking._jawabSuara('${this._esc(s.hanzi)}')">🎤 Baca</button>
        <button class="btn btn-biru" onclick="TTS.mandarin('${this._esc(s.hanzi)}')">🔊 Contoh</button>
        <button class="btn btn-kuning" onclick="Exam._next()">⏭ Skip</button>
        <button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button>
      </div>
    </div>`;
  },

  _timed(v) {
    const salah = acak(DB.vocab.filter(x=>x.arti!==v.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([v.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">⏱️ Timed Quiz</div>
      <div class="timer-box" id="timer-box">${this.waktuSisa}s</div>
      <div class="soal-hanzi">${v.hanzi}</div>
      <div class="soal-hint">Pilih arti yang benar (waktu terbatas!):</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan" onclick="Exam._pilih('${p}','${v.arti}',${JSON.stringify(v)})">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button></div>
    </div>`;
  },

  _review(v) {
    if (!v.hanzi) { this._next(); return ""; }
    const salah = acak(DB.vocab.filter(x=>x.arti!==v.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([v.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">🔍 Review Salah</div>
      <div class="soal-hanzi">${v.hanzi}</div>
      <div class="soal-hint">Kamu pernah salah kata ini. Pilih arti yang benar:</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan" onclick="Exam._pilih('${p}','${v.arti}',${JSON.stringify(v)})">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button></div>
    </div>`;
  },

  _adaptive(v) {
    const salah = acak(DB.vocab.filter(x=>x.arti!==v.arti)).slice(0,3).map(x=>x.arti);
    const semua = acak([v.arti,...salah]);
    return `<div class="soal-wrap">
      <div class="label-mode exam-badge">🎯 Adaptive — Level ${v.level||1}</div>
      <div class="soal-hanzi">${v.hanzi}</div>
      <div class="soal-hint">Pilih arti yang benar:</div>
      <div class="pilihan-grid" id="pilihan-cont">
        ${semua.map(p=>`<button class="btn-pilihan" onclick="Exam._pilih('${p}','${v.arti}',${JSON.stringify(v)})">${p}</button>`).join("")}
      </div>
      <div class="hasil-box" id="hasil-box"></div>
      <div class="btn-row"><button class="btn btn-abu" onclick="Exam.kembaliMenu()">⏹ Keluar</button></div>
    </div>`;
  },

  _mulaiTimer() {
    hentikanTimer();
    mulaiTimer(this.waktuSisa,
      (sisa)=>{ this.waktuSisa=sisa; const t=el("timer-box"); if(t){ t.innerText=sisa+"s"; t.style.color=sisa<=10?"#f44336":"#333"; } },
      ()=>{ this._pilih("__habis__","__habis__",{}); }
    );
  },

  _pilih(dipilih, jawaban, item) {
    hentikanTimer();
    const benar = dipilih === jawaban;
    tambahSkor(benar);
    if(!benar && item.hanzi) {
      this.salahList.push(item);
      // Simpan ke progress
      const prog = ambilProgress();
      prog.salah = prog.salah || [];
      if(!prog.salah.find(x=>x.hanzi===item.hanzi)) prog.salah.push(item);
      simpanProgress(prog);
    }
    const cont = el("pilihan-cont");
    if(cont) cont.querySelectorAll(".btn-pilihan,.btn-pilihan-full").forEach(b=>{
      b.disabled=true;
      if(b.innerText===jawaban) b.classList.add("pilihan-benar");
      else if(b.innerText===dipilih&&!benar) b.classList.add("pilihan-salah");
    });
    setHTML("hasil-box",(benar?"✅ Benar! ":"❌ ")+`<b>${item.hanzi||""}</b> = ${jawaban}`);
    el("hasil-box").className="hasil-box "+(benar?"benar":"salah");
    setHTML("skor-mini",`✅${sesiSkor.benar} ❌${sesiSkor.salah}`);
    if(this.modeSaat==="timed") this.waktuSisa = 60;
    setTimeout(()=>this._next(), 1600);
  },

  _next() { this.idx++; this.tampilSoal(); },
  _esc(s){ return (s||"").replace(/'/g,"\\'"); },

  tampilSelesai() {
    hentikanTimer();
    const pct = sesiSkor.total ? Math.round((sesiSkor.benar/sesiSkor.total)*100) : 0;
    const grade = pct>=90?"A":pct>=75?"B":pct>=60?"C":pct>=40?"D":"E";
    el("konten-utama").innerHTML = `<div class="selesai-wrap">
      <div class="selesai-emoji">${pct>=80?"🏆":pct>=60?"🎖️":"💪"}</div>
      <h2>Ujian Selesai!</h2>
      <div class="exam-grade grade-${grade.toLowerCase()}">${grade}</div>
      <div class="selesai-skor">
        <div>✅ Benar: <b>${sesiSkor.benar}</b> / ${sesiSkor.total}</div>
        <div>❌ Salah: <b>${sesiSkor.salah}</b></div>
        <div class="skor-pct">${pct}%</div>
      </div>
      ${this.salahList.length ? `
        <div class="review-section">
          <h3>📋 Perlu Dipelajari Lagi:</h3>
          ${this.salahList.map(v=>`<div class="review-item"><b>${v.hanzi}</b> (${v.pinyin||""}) = ${v.arti||v.hanzi}</div>`).join("")}
        </div>` : ""}
      <div class="btn-row" style="justify-content:center;margin-top:20px;">
        <button class="btn btn-hijau" onclick="Exam.mulai('${this.modeSaat}')">🔄 Ulangi</button>
        <button class="btn btn-biru" onclick="Exam.kembaliMenu()">← Menu Exam</button>
      </div>
    </div>`;
  },
  kembaliMenu(){ hentikanTimer(); TTS.berhenti(); STT.berhenti(); App.renderModul("exam"); }
};
