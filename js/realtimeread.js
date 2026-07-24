// ================================================================
//  REALTIMEREAD.JS — "Deteksi Real-time" (sub-fitur baru di Reading)
//    • Tampilkan 1 paragraf hanzi, semua abu-abu di awal
//    • Mic mendengarkan TERUS-MENERUS selagi user membaca
//    • Karakter yang sudah terucap BENAR → berubah hitam pekat
//    • Kalau ada kata yang meleset (salah ucap / kedengaran beda) →
//      langsung muncul info: pinyin yang benar, tip lafal, tombol
//      dengar contoh suara, dan tombol cek nada (rekam ulang khusus
//      kata itu, dibandingkan kontur nada standarnya)
//    • Tombol "Dengar Paragraf" bebas diklik kapan saja
//    • Kalau semua kata sudah benar → lanjut dengan klik manual
//    • Teks bisa dibuat otomatis oleh Gemini AI, atau pakai teks
//      contoh bawaan (tidak perlu API key)
//
//  Dipakai: pitch.js (GeminiAPI, ToneUtil, PitchRecorder, ContourChart),
//           engine.js (TTS, el, setHTML, tampilToast, dst)
// ================================================================

// ── Tip lafal singkat untuk inisial pinyin yang sering tertukar ──
const RTR_TIPS = {
  q:  "'q' mirip 'ch' tapi lidah menyentuh belakang gigi bawah — jangan sampai kedengaran seperti 'j'.",
  x:  "'x' mirip 's' yang didesiskan lembut — jangan sampai kedengaran seperti 'sh'.",
  j:  "'j' diucapkan ringan, mirip 'c' lembut — bukan 'j' berat seperti dalam bahasa Indonesia.",
  zh: "'zh' diucapkan dengan ujung lidah digulung ke atas, mirip 'j' tebal — bukan 'z' atau 'j' biasa.",
  ch: "'ch' diucapkan dengan ujung lidah digulung ke atas + hembusan napas, mirip 'c' tebal — bukan 'c' biasa.",
  sh: "'sh' diucapkan dengan ujung lidah digulung ke atas, mirip 'sy' tebal — bukan 's' biasa.",
  r:  "'r' diucapkan dengan ujung lidah digulung ke atas tanpa getar, antara 'r' dan 'j' — bukan 'r' Indonesia.",
  z:  "'z' mirip 'dz' halus, ujung lidah di belakang gigi atas — bukan 'z' Indonesia.",
  c:  "'c' mirip 'ts' dengan hembusan napas kuat — bukan 'c' Indonesia.",
  s:  "'s' seperti 's' biasa, tapi ujung lidah tetap di belakang gigi atas.",
  b:  "'b' diucapkan tanpa suara berat, mirip 'p' yang lembut.",
  d:  "'d' diucapkan tanpa suara berat, mirip 't' yang lembut.",
  g:  "'g' diucapkan tanpa suara berat, mirip 'k' yang lembut.",
  y:  "pastikan bunyi 'y' di depan kedengaran jelas, jangan hilang.",
  w:  "pastikan bunyi 'w' di depan kedengaran jelas, jangan hilang.",
};
function rtrInisial(py) {
  const s = (py || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/^zh/.test(s)) return "zh";
  if (/^ch/.test(s)) return "ch";
  if (/^sh/.test(s)) return "sh";
  const m = s.match(/^[bpmfdtnlgkhjqxrzcsyw]/);
  return m ? m[0] : null;
}

// helper pembentuk token kata: pecah pinyin per-suku-kata memakai peta manual di bawah
// (RTR_SPLIT), supaya akurat untuk kata majemuk yang tak bisa ditebak otomatis.
function w(hanzi, pinyin, arti) {
  return { type: "word", hanzi, pinyin, arti, chars: RTR_SPLIT[hanzi + "|" + pinyin] || _rtrAutoSplit(hanzi, pinyin) };
}
function p(text) { return { type: "punct", text }; }

// Peta pecahan per-karakter untuk kata majemuk pada 2 paragraf contoh bawaan.
const RTR_SPLIT = {
  "爸爸|bàba": [{c:"爸",py:"bà"},{c:"爸",py:"ba"}],
  "妈妈|māma": [{c:"妈",py:"mā"},{c:"妈",py:"ma"}],
  "妹妹|mèimei": [{c:"妹",py:"mèi"},{c:"妹",py:"mei"}],
  "老师|lǎoshī": [{c:"老",py:"lǎo"},{c:"师",py:"shī"}],
  "每天|měitiān": [{c:"每",py:"měi"},{c:"天",py:"tiān"}],
  "学校|xuéxiào": [{c:"学",py:"xué"},{c:"校",py:"xiào"}],
  "上课|shàngkè": [{c:"上",py:"shàng"},{c:"课",py:"kè"}],
  "医院|yīyuàn": [{c:"医",py:"yī"},{c:"院",py:"yuàn"}],
  "工作|gōngzuò": [{c:"工",py:"gōng"},{c:"作",py:"zuò"}],
  "医生|yīshēng": [{c:"医",py:"yī"},{c:"生",py:"shēng"}],
  "今年|jīnnián": [{c:"今",py:"jīn"},{c:"年",py:"nián"}],
  "八岁|bāsuì": [{c:"八",py:"bā"},{c:"岁",py:"suì"}],
  "喜欢|xǐhuan": [{c:"喜",py:"xǐ"},{c:"欢",py:"huan"}],
  "画画|huàhuà": [{c:"画",py:"huà"},{c:"画",py:"huà"}],
  "大学生|dàxuéshēng": [{c:"大",py:"dà"},{c:"学",py:"xué"},{c:"生",py:"shēng"}],
  "学习|xuéxí": [{c:"学",py:"xué"},{c:"习",py:"xí"}],
  "汉语|Hànyǔ": [{c:"汉",py:"Hàn"},{c:"语",py:"yǔ"}],
  "运动|yùndòng": [{c:"运",py:"yùn"},{c:"动",py:"dòng"}],
  "特别是|tèbiéshì": [{c:"特",py:"tè"},{c:"别",py:"bié"},{c:"是",py:"shì"}],
  "打篮球|dǎlánqiú": [{c:"打",py:"dǎ"},{c:"篮",py:"lán"},{c:"球",py:"qiú"}],
  "每个|měigè": [{c:"每",py:"měi"},{c:"个",py:"gè"}],
  "周末|zhōumò": [{c:"周",py:"zhōu"},{c:"末",py:"mò"}],
  "朋友们|péngyoumen": [{c:"朋",py:"péng"},{c:"友",py:"you"},{c:"们",py:"men"}],
  "一起|yìqǐ": [{c:"一",py:"yì"},{c:"起",py:"qǐ"}],
  "操场|cāochǎng": [{c:"操",py:"cāo"},{c:"场",py:"chǎng"}],
  "不但|búdàn": [{c:"不",py:"bú"},{c:"但",py:"dàn"}],
  "可以|kěyǐ": [{c:"可",py:"kě"},{c:"以",py:"yǐ"}],
  "锻炼|duànliàn": [{c:"锻",py:"duàn"},{c:"炼",py:"liàn"}],
  "身体|shēntǐ": [{c:"身",py:"shēn"},{c:"体",py:"tǐ"}],
  "结交|jiéjiāo": [{c:"结",py:"jié"},{c:"交",py:"jiāo"}],
  "朋友|péngyou": [{c:"朋",py:"péng"},{c:"友",py:"you"}],
  "虽然|suīrán": [{c:"虽",py:"suī"},{c:"然",py:"rán"}],
  "打得|dǎde": [{c:"打",py:"dǎ"},{c:"得",py:"de"}],
  "不是|búshì": [{c:"不",py:"bú"},{c:"是",py:"shì"}],
  "很好|hěnhǎo": [{c:"很",py:"hěn"},{c:"好",py:"hǎo"}],
  "但是|dànshì": [{c:"但",py:"dàn"},{c:"是",py:"shì"}],
  "非常|fēicháng": [{c:"非",py:"fēi"},{c:"常",py:"cháng"}],
  "努力|nǔlì": [{c:"努",py:"nǔ"},{c:"力",py:"lì"}],
  "我的|wǒde": [{c:"我",py:"wǒ"},{c:"的",py:"de"}],
  "教练|jiàoliàn": [{c:"教",py:"jiào"},{c:"练",py:"liàn"}],
  "只要|zhǐyào": [{c:"只",py:"zhǐ"},{c:"要",py:"yào"}],
  "坚持|jiānchí": [{c:"坚",py:"jiān"},{c:"持",py:"chí"}],
  "练习|liànxí": [{c:"练",py:"liàn"},{c:"习",py:"xí"}],
  "一定|yídìng": [{c:"一",py:"yí"},{c:"定",py:"dìng"}],
  "进步|jìnbù": [{c:"进",py:"jìn"},{c:"步",py:"bù"}],
};
// Fallback kalau tidak ada di peta manual (mis. hasil AI yg tak sengaja tak berformat "chars"):
// asumsikan tiap hanzi 1 suku kata; kalau pinyin sudah dipisah spasi per-suku-kata, pakai langsung;
// kalau tidak, taruh seluruh pinyin di suku kata pertama saja (cadangan darurat, tetap tampil apa adanya).
function _rtrAutoSplit(hanzi, pinyin) {
  const chars = [...hanzi];
  if (chars.length <= 1) return [{ c: hanzi, py: pinyin }];
  const bySpace = (pinyin || "").trim().split(/\s+/);
  if (bySpace.length === chars.length) return chars.map((c, i) => ({ c, py: bySpace[i] }));
  return chars.map((c, i) => ({ c, py: i === 0 ? pinyin : "" }));
}

// ── 2 paragraf contoh bawaan (tidak perlu API key) — tokenisasi manual ──
const RTR_BUILTIN = [
  {
    judul: "Keluargaku",
    arti: "Keluargaku ada empat orang: ayah, ibu, adik perempuan, dan aku. Ayahku adalah guru, setiap hari dia pergi ke sekolah mengajar. Ibuku bekerja di rumah sakit, dia adalah dokter. Adikku tahun ini berusia delapan tahun, dia sangat suka menggambar. Aku adalah mahasiswa, aku suka belajar bahasa Mandarin.",
    tokens: [
      w("我","wǒ","saya"), w("家","jiā","rumah/keluarga"), w("有","yǒu","punya/ada"), w("四","sì","empat"), w("口","kǒu","(penghitung orang)"), w("人","rén","orang"), p("："),
      w("爸爸","bàba","ayah"), p("、"), w("妈妈","māma","ibu"), p("、"), w("妹妹","mèimei","adik perempuan"), w("和","hé","dan"), w("我","wǒ","saya"), p("。"),
      w("我","wǒ","saya"), w("爸爸","bàba","ayah"), w("是","shì","adalah"), w("老师","lǎoshī","guru"), p("，"), w("他","tā","dia (lk)"), w("每天","měitiān","setiap hari"), w("去","qù","pergi"), w("学校","xuéxiào","sekolah"), w("上课","shàngkè","mengajar/masuk kelas"), p("。"),
      w("我","wǒ","saya"), w("妈妈","māma","ibu"), w("在","zài","di"), w("医院","yīyuàn","rumah sakit"), w("工作","gōngzuò","bekerja"), p("，"), w("她","tā","dia (pr)"), w("是","shì","adalah"), w("医生","yīshēng","dokter"), p("。"),
      w("我","wǒ","saya"), w("妹妹","mèimei","adik perempuan"), w("今年","jīnnián","tahun ini"), w("八岁","bāsuì","delapan tahun"), p("，"), w("她","tā","dia (pr)"), w("很","hěn","sangat"), w("喜欢","xǐhuan","suka"), w("画画","huàhuà","menggambar"), p("。"),
      w("我","wǒ","saya"), w("是","shì","adalah"), w("大学生","dàxuéshēng","mahasiswa"), p("，"), w("我","wǒ","saya"), w("喜欢","xǐhuan","suka"), w("学习","xuéxí","belajar"), w("汉语","Hànyǔ","bahasa Mandarin"), p("。"),
    ],
  },
  {
    judul: "Olahraga Favoritku",
    arti: "Saya sangat suka olahraga, terutama bermain basket. Setiap akhir pekan, saya selalu pergi ke lapangan bermain basket bersama teman-teman. Bermain basket tidak hanya bisa melatih tubuh, tapi juga bisa menambah teman baru. Meskipun saya tidak terlalu pandai bermain, saya sangat berusaha keras. Pelatihku bilang, selama terus berlatih, pasti akan ada kemajuan.",
    tokens: [
      w("我","wǒ","saya"), w("很","hěn","sangat"), w("喜欢","xǐhuan","suka"), w("运动","yùndòng","olahraga"), p("，"), w("特别是","tèbiéshì","terutama"), w("打篮球","dǎlánqiú","bermain basket"), p("。"),
      w("每个","měigè","setiap"), w("周末","zhōumò","akhir pekan"), p("，"), w("我","wǒ","saya"), w("都","dōu","selalu"), w("和","hé","dengan"), w("朋友们","péngyoumen","teman-teman"), w("一起","yìqǐ","bersama"), w("去","qù","pergi"), w("操场","cāochǎng","lapangan"), w("打篮球","dǎlánqiú","bermain basket"), p("。"),
      w("打篮球","dǎlánqiú","bermain basket"), w("不但","búdàn","tidak hanya"), w("可以","kěyǐ","bisa"), w("锻炼","duànliàn","melatih"), w("身体","shēntǐ","tubuh"), p("，"), w("还","hái","juga"), w("可以","kěyǐ","bisa"), w("结交","jiéjiāo","menambah/berkenalan"), w("新","xīn","baru"), w("朋友","péngyou","teman"), p("。"),
      w("虽然","suīrán","meskipun"), w("我","wǒ","saya"), w("打得","dǎde","bermainnya"), w("不是","búshì","tidak"), w("很好","hěnhǎo","terlalu baik"), p("，"), w("但是","dànshì","tapi"), w("我","wǒ","saya"), w("非常","fēicháng","sangat"), w("努力","nǔlì","berusaha keras"), p("。"),
      w("我的","wǒde","saya punya (-ku)"), w("教练","jiàoliàn","pelatih"), w("说","shuō","bilang"), p("，"), w("只要","zhǐyào","selama/asalkan"), w("坚持","jiānchí","terus/bertahan"), w("练习","liànxí","berlatih"), p("，"), w("一定","yídìng","pasti"), w("会","huì","akan"), w("进步","jìnbù","maju/berkembang"), w("的","de","(partikel penegas)"), p("。"),
    ],
  },
];

// ================================================================
var RealtimeReading = {
  passage: null,       // { judul, arti, tokens }
  flat: [],            // [{c, py, wordIdx}]
  status: [],          // paralel dgn flat: 'unread' | 'ok' | {status:'error', heard}
  heardBuffer: "",      // teks kumulatif hasil STT (final) sejak mulai/ulangi
  listening: false,
  showPinyin: false,
  showArti: false,
  _recognition: null,
  _restartTimer: null,

  // ── ENTRY ────────────────────────────────────────────────────
  buka() { el("konten-utama").innerHTML = this.renderSetup(); },

  renderSetup() {
    return `
      <div class="soal-wrap">
        <div class="label-mode">🎙️ Deteksi Real-time — Reading</div>
        <div class="soal-teks-indo" style="margin-bottom:12px">
          Baca paragraf dengan suara. Karakter yang terucap benar akan berubah hitam pekat secara langsung,
          dan kalau ada yang meleset (kata atau nada) akan langsung muncul bantuannya.
        </div>
        <div class="sub-menu-grid">
          <div class="sub-card" onclick="RealtimeReading._mulaiBawaan()">
            <div class="sub-icon">📚</div>
            <div class="sub-label">Pakai Teks Contoh</div>
            <div class="sub-desc">Langsung mulai, tanpa perlu API key</div>
          </div>
          <div class="sub-card" onclick="RealtimeReading._tampilFormAI()">
            <div class="sub-icon">🤖</div>
            <div class="sub-label">Buat dengan AI</div>
            <div class="sub-desc">Gemini buatkan paragraf baru sesuai level/topik</div>
          </div>
        </div>
        <div id="rtr-ai-form"></div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-abu" onclick="Reading.kembaliMenu()">← Batal</button>
        </div>
      </div>`;
  },

  _tampilFormAI() {
    setHTML("rtr-ai-form", `
      <div class="sub-card sub-card-aktif" style="margin-top:10px;cursor:default">
        <div style="text-align:left">
          <label style="font-size:12.5px;color:var(--c-sub);font-weight:700">Level HSK</label><br>
          <select id="rtr-level" class="quiz-select" style="margin-top:4px">
            <option value="1">HSK 1</option><option value="2" selected>HSK 2</option>
            <option value="3">HSK 3</option><option value="4">HSK 4</option>
          </select>
          <div style="margin-top:10px">
            <label style="font-size:12.5px;color:var(--c-sub);font-weight:700">Topik (opsional)</label><br>
            <input type="text" id="rtr-topik" class="quiz-select" style="margin-top:4px;width:100%" placeholder="mis. liburan, makanan, cuaca">
          </div>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn btn-hijau" onclick="RealtimeReading._mulaiAI()">✨ Buat & Mulai</button>
          </div>
        </div>
      </div>`);
  },

  // ── MULAI ────────────────────────────────────────────────────
  _mulaiBawaan() {
    this.passage = acak(RTR_BUILTIN)[0];
    this._setup();
  },

  async _mulaiAI() {
    if (!GeminiAPI.getKey()) {
      const k = prompt("Masukkan Gemini API key (dipakai juga oleh fitur AI lain):");
      if (k) GeminiAPI.setKey(k); else { tampilToast("⚠️ Perlu API key Gemini untuk fitur ini."); return; }
    }
    const level = el("rtr-level") ? el("rtr-level").value : "2";
    const topik = el("rtr-topik") ? el("rtr-topik").value.trim() : "";
    el("konten-utama").innerHTML = `<div class="soal-wrap"><div class="label-mode">🤖 Membuat paragraf...</div></div>`;
    try {
      const prompt2 = `Buat SATU paragraf bacaan bahasa Mandarin level HSK ${level}${topik ? ` dengan topik "${topik}"` : ""}, panjang 4-6 kalimat.
Balas HANYA JSON valid (tanpa markdown, tanpa penjelasan) dengan format persis:
{
  "arti": "terjemahan Indonesia lengkap paragraf",
  "tokens": [
    {"type":"word","hanzi":"我","pinyin":"wǒ","arti":"saya","chars":[{"c":"我","py":"wǒ"}]},
    {"type":"punct","text":"，"}
  ]
}
Aturan PENTING:
- Setiap kata majemuk (2+ karakter) WAJIB punya field "chars": array per-karakter {"c":..., "py":...} dengan pinyin bertanda nada (ā á ǎ à dst), urut sesuai hanzi.
- Tanda baca (，。！？：、) ditulis sebagai token terpisah bertipe "punct", JANGAN digabung ke kata.
- Pinyin harus pakai diakritik nada, BUKAN angka.
- Urutan token harus sama persis dengan urutan kalimat aslinya.`;
      const data = await GeminiAPI.callJSON(prompt2, 1400);
      if (!data || !Array.isArray(data.tokens) || !data.tokens.length) throw new Error("Format AI tidak sesuai.");
      // validasi & lengkapi chars yang mungkin kosong
      data.tokens.forEach(t => {
        if (t.type === "word" && (!t.chars || !t.chars.length)) t.chars = _rtrAutoSplit(t.hanzi, t.pinyin);
      });
      this.passage = { judul: topik || `Bacaan HSK ${level}`, arti: data.arti || "", tokens: data.tokens };
      this._setup();
    } catch (e) {
      tampilToast("❌ " + (e.message || "Gagal membuat paragraf. Coba teks contoh dulu."));
      this.buka();
    }
  },

  _setup() {
    // ratakan jadi flat[] per-karakter (abaikan tanda baca)
    this.flat = [];
    this.passage.tokens.forEach((tok, wi) => {
      if (tok.type !== "word") return;
      tok.chars.forEach(cd => this.flat.push({ c: cd.c, py: cd.py, wordIdx: wi }));
    });
    this.status = this.flat.map(() => "unread");
    this.heardBuffer = "";
    this.showPinyin = false;
    this.showArti = false;
    this._render();
  },

  // ── RENDER ───────────────────────────────────────────────────
  _currentIdx() {
    for (let i = 0; i < this.status.length; i++) {
      if (this.status[i] !== "ok") return i;
    }
    return -1; // semua sudah benar
  },

  _render() {
    const curIdx = this._currentIdx();
    const curWordIdx = curIdx >= 0 ? this.flat[curIdx].wordIdx : -1;
    let flatPos = 0;
    let bodyHTML = "";
    this.passage.tokens.forEach((tok, wi) => {
      if (tok.type === "punct") { bodyHTML += `<span class="rtr-punct">${_rtrEsc(tok.text)}</span>`; return; }
      const isCur = wi === curWordIdx;
      let charsHTML = "";
      tok.chars.forEach(() => {
        const st = this.status[flatPos];
        const cls = st === "ok" ? "rtr-char rtr-ok" : (st && st.status === "error" ? "rtr-char rtr-err" : "rtr-char");
        charsHTML += `<span class="${cls}">${this.flat[flatPos].c}</span>`;
        flatPos++;
      });
      bodyHTML += `<span class="rtr-word${isCur ? " rtr-current" : ""}">${charsHTML}${this.showPinyin ? `<div class="rtr-pinyin">${_rtrEsc(tok.pinyin)}</div>` : ""}</span>`;
    });

    const selesai = curIdx === -1;
    const curErr = curIdx >= 0 && this.status[curIdx] && this.status[curIdx].status === "error";

    el("konten-utama").innerHTML = `
      <div class="soal-wrap">
        <div class="label-mode">🎙️ Deteksi Real-time${this.passage.judul ? " — " + _rtrEsc(this.passage.judul) : ""}</div>
        <div class="btn-row" style="margin-bottom:10px">
          <button class="btn-audio" onclick="RealtimeReading._dengarParagraf()">🔊 Dengar Paragraf</button>
          <button class="btn ${this.showPinyin ? "btn-biru" : "btn-abu"}" onclick="RealtimeReading._toggle('showPinyin')">🔤 Pinyin</button>
          <button class="btn ${this.showArti ? "btn-biru" : "btn-abu"}" onclick="RealtimeReading._toggle('showArti')">💬 Arti</button>
        </div>
        ${this.showArti ? `<div class="hasil-box info" style="margin-bottom:10px">${_rtrEsc(this.passage.arti || "-")}</div>` : ""}
        <div class="rtr-passage" id="rtr-passage">${bodyHTML}</div>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn ${this.listening ? "btn-merah" : "btn-hijau"}" id="rtr-mic-btn" onclick="RealtimeReading._toggleMic()">
            ${this.listening ? "⏹ Berhenti Dengar" : "🎤 Mulai Membaca"}
          </button>
          <button class="btn btn-kuning" onclick="RealtimeReading._ulangi()">🔄 Ulangi</button>
        </div>
        <div id="rtr-hint">${curErr ? this._hintHTML(curIdx) : ""}</div>
        <div id="rtr-nada-hasil"></div>

        ${selesai ? `
        <div class="hasil-box benar" style="margin-top:12px">✅ Semua kata sudah terbaca dengan benar!</div>
        <div class="btn-row" style="justify-content:center;margin-top:10px">
          <button class="btn btn-hijau" onclick="RealtimeReading._lanjut()">➡️ Lanjut (Paragraf Baru)</button>
        </div>` : ""}

        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-abu" onclick="RealtimeReading.kembaliMenu()">← Menu</button>
        </div>
      </div>`;
  },

  _toggle(key) { this[key] = !this[key]; this._render(); },

  _hintHTML(idx) {
    const target = this.flat[idx];
    const heardChar = this.status[idx].heard || "?";
    const tip = RTR_TIPS[rtrInisial(target.py)] || "";
    return `
      <div class="hasil-box salah" style="margin-top:10px;text-align:left">
        ⚠️ Sepertinya kedengaran "<b>${_rtrEsc(heardChar)}</b>", tapi seharusnya kata ini dibaca:
        <div class="rtr-target-py">${_rtrEsc(target.c)} — <b>${_rtrEsc(target.py)}</b></div>
        ${tip ? `<div class="rtr-tip">💡 ${tip}</div>` : ""}
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-biru" onclick="RealtimeReading._dengarKata(${idx})">🔊 Dengar Ucapan Benar</button>
          <button class="btn btn-ungu" onclick="RealtimeReading._cekNada(${idx})">🎵 Cek Nada Kata Ini</button>
        </div>
      </div>`;
  },

  // ── AUDIO BEBAS KAPAN SAJA ───────────────────────────────────
  _dengarParagraf() {
    const teks = this.passage.tokens.map(t => t.type === "word" ? t.hanzi : t.text).join("");
    TTS.mandarin(teks);
  },
  _dengarKata(idx) {
    TTS.mandarin(this.flat[idx].c);
  },

  // ── CEK NADA KATA AKTIF (rekam khusus, bandingkan kontur) ────
  async _cekNada(idx) {
    if (!PitchRecorder.supported()) { tampilToast("⚠️ Mic/pitch tidak didukung di browser ini."); return; }
    const wasListening = this.listening;
    if (wasListening) this._stopMic(true); // jeda STT sebentar supaya mic tidak dipakai bareng
    const target = this.flat[idx];
    const box = el("rtr-nada-hasil");
    if (box) box.innerHTML = `<div class="hasil-box info">🎙️ Merekam... ucapkan "${_rtrEsc(target.c)}" (${_rtrEsc(target.py)})</div>`;
    try {
      const { contour } = await PitchRecorder.start(2500);
      const ref = ToneUtil.buildReferenceContour(target.py);
      if (!contour) {
        if (box) box.innerHTML = `<div class="hasil-box salah">⚠️ Suara kurang jelas, coba lagi.</div>`;
      } else {
        const notes = ToneUtil.compareContours(contour, ref);
        if (box) box.innerHTML = `<div class="hasil-box info">${ContourChart.svg(contour, ref, { labelChars: [target.c] })}
          <div style="margin-top:8px;text-align:left">${notes.map(n => `<div>${n}</div>`).join("")}</div></div>`;
      }
    } catch (e) {
      tampilToast("❌ " + (e.message || "Gagal merekam."));
    } finally {
      if (wasListening) this._startMic();
    }
  },

  // ── STT REAL-TIME (continuous + interim) ─────────────────────
  _toggleMic() { this.listening ? this._stopMic() : this._startMic(); },

  _startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { tampilToast("⚠️ SpeechRecognition tidak tersedia. Gunakan Chrome."); return; }
    STT.berhenti(); // pastikan tidak bentrok dgn STT modul lain
    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalChunk = "", interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t; else interimChunk += t;
      }
      if (finalChunk) this.heardBuffer += finalChunk;
      this._proses(this.heardBuffer + interimChunk);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // wajar saat jeda, biarkan auto-restart
      tampilToast("❌ Error mic: " + e.error);
    };
    r.onend = () => {
      if (this.listening) { // masih aktif tapi API-nya berhenti sendiri (umum di Chrome) → restart otomatis
        clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => { if (this.listening) { try { r.start(); } catch (e) {} } }, 200);
      }
    };
    try { r.start(); } catch (e) {}
    this._recognition = r;
    this.listening = true;
    this._render();
  },

  _stopMic(diam) {
    this.listening = false;
    clearTimeout(this._restartTimer);
    try { if (this._recognition) this._recognition.stop(); } catch (e) {}
    this._recognition = null;
    if (!diam) this._render();
  },

  // ── ALGORITMA PENCOCOKAN REAL-TIME (bertoleransi noise ASR) ──
  _proses(heardRaw) {
    const heard = (heardRaw || "").replace(/[，。！？、,\.!\?\s]/g, "");
    const target = this.flat.map(f => f.c);
    const W = 4;
    const newStatus = new Array(target.length).fill("unread");
    let ti = 0, hi = 0;
    while (ti < target.length && hi < heard.length) {
      if (target[ti] === heard[hi]) { newStatus[ti] = "ok"; ti++; hi++; continue; }
      let found = false;
      for (let win = 1; win <= W && !found; win++) {
        if (hi + win < heard.length && heard[hi + win] === target[ti]) { hi += win; found = true; }
        else if (ti + win < target.length && target[ti + win] === heard[hi]) {
          for (let k = 0; k < win; k++) newStatus[ti + k] = "unread";
          ti += win; found = true;
        }
      }
      if (!found) { newStatus[ti] = { status: "error", heard: heard[hi] }; ti++; hi++; }
    }
    this.status = newStatus;
    this._render(); // render tiap update biar terasa real-time
    if (this._currentIdx() === -1 && this.listening) this._stopMic(); // otomatis berhenti dengar kalau sudah selesai semua
  },

  _ulangi() {
    this.status = this.flat.map(() => "unread");
    this.heardBuffer = "";
    this._render();
  },

  _lanjut() {
    this._stopMic(true);
    // ambil paragraf berikutnya: kalau paragraf sebelumnya dari AI, tawarkan bawaan; simple: acak dari bawaan
    const lain = RTR_BUILTIN.find(p2 => p2 !== this.passage) || acak(RTR_BUILTIN)[0];
    this.passage = lain;
    this._setup();
  },

  kembaliMenu() {
    TTS.berhenti();
    this._stopMic(true);
    STT.berhenti();
    Reading.kembaliMenu();
  },
};

function _rtrEsc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
