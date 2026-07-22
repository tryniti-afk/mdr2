// ================================================================
//  DATA.JS — Database Kosakata, Kalimat, Grammar, Dialog
//  Struktur: { hanzi, pinyin, arti, audio?, kategori, level }
// ================================================================

const DB = {

  // ── VOCABULARY ──────────────────────────────────────────────
  vocab: [
    { hanzi:"苹果", pinyin:"píngguǒ",   arti:"apel",           level:1, tag:"makanan" },
    { hanzi:"香蕉", pinyin:"xiāngjiāo", arti:"pisang",         level:1, tag:"makanan" },
    { hanzi:"水",   pinyin:"shuǐ",      arti:"air",            level:1, tag:"dasar" },
    { hanzi:"书",   pinyin:"shū",       arti:"buku",           level:1, tag:"benda" },
    { hanzi:"笔",   pinyin:"bǐ",        arti:"pena",           level:1, tag:"benda" },
    { hanzi:"猫",   pinyin:"māo",       arti:"kucing",         level:1, tag:"hewan" },
    { hanzi:"狗",   pinyin:"gǒu",       arti:"anjing",         level:1, tag:"hewan" },
    { hanzi:"学校", pinyin:"xuéxiào",   arti:"sekolah",        level:1, tag:"tempat" },
    { hanzi:"医院", pinyin:"yīyuàn",    arti:"rumah sakit",    level:1, tag:"tempat" },
    { hanzi:"朋友", pinyin:"péngyou",   arti:"teman",          level:1, tag:"orang" },
    { hanzi:"老师", pinyin:"lǎoshī",    arti:"guru",           level:1, tag:"orang" },
    { hanzi:"学生", pinyin:"xuéshēng",  arti:"murid",          level:1, tag:"orang" },
    { hanzi:"汉语", pinyin:"Hànyǔ",     arti:"bahasa Mandarin",level:1, tag:"bahasa" },
    { hanzi:"中文", pinyin:"Zhōngwén",  arti:"bahasa Tiongkok",level:1, tag:"bahasa" },
    { hanzi:"喜欢", pinyin:"xǐhuān",    arti:"suka",           level:1, tag:"kata kerja" },
    { hanzi:"吃",   pinyin:"chī",       arti:"makan",          level:1, tag:"kata kerja" },
    { hanzi:"喝",   pinyin:"hē",        arti:"minum",          level:1, tag:"kata kerja" },
    { hanzi:"看",   pinyin:"kàn",       arti:"melihat/membaca",level:1, tag:"kata kerja" },
    { hanzi:"说",   pinyin:"shuō",      arti:"berbicara",      level:1, tag:"kata kerja" },
    { hanzi:"去",   pinyin:"qù",        arti:"pergi",          level:1, tag:"kata kerja" },
    { hanzi:"来",   pinyin:"lái",       arti:"datang",         level:1, tag:"kata kerja" },
    { hanzi:"买",   pinyin:"mǎi",       arti:"membeli",        level:1, tag:"kata kerja" },
    { hanzi:"大",   pinyin:"dà",        arti:"besar",          level:1, tag:"kata sifat" },
    { hanzi:"小",   pinyin:"xiǎo",      arti:"kecil",          level:1, tag:"kata sifat" },
    { hanzi:"好",   pinyin:"hǎo",       arti:"baik/bagus",     level:1, tag:"kata sifat" },
    { hanzi:"漂亮", pinyin:"piàoliang", arti:"cantik",         level:1, tag:"kata sifat" },
    { hanzi:"忙",   pinyin:"máng",      arti:"sibuk",          level:1, tag:"kata sifat" },
    { hanzi:"累",   pinyin:"lèi",       arti:"lelah",          level:1, tag:"kata sifat" },
    { hanzi:"今天", pinyin:"jīntiān",   arti:"hari ini",       level:1, tag:"waktu" },
    { hanzi:"昨天", pinyin:"zuótiān",   arti:"kemarin",        level:1, tag:"waktu" },
    { hanzi:"明天", pinyin:"míngtiān",  arti:"besok",          level:1, tag:"waktu" },
    { hanzi:"现在", pinyin:"xiànzài",   arti:"sekarang",       level:1, tag:"waktu" },
    // HSK 2
    { hanzi:"爱情", pinyin:"àiqíng",    arti:"cinta",          level:2, tag:"perasaan" },
    { hanzi:"高兴", pinyin:"gāoxìng",   arti:"senang",         level:2, tag:"perasaan" },
    { hanzi:"担心", pinyin:"dānxīn",    arti:"khawatir",       level:2, tag:"perasaan" },
    { hanzi:"觉得", pinyin:"juéde",     arti:"merasa/berpikir",level:2, tag:"kata kerja" },
    { hanzi:"知道", pinyin:"zhīdào",    arti:"mengetahui",     level:2, tag:"kata kerja" },
    { hanzi:"认为", pinyin:"rènwéi",    arti:"berpendapat",    level:2, tag:"kata kerja" },
    { hanzi:"帮助", pinyin:"bāngzhù",   arti:"membantu",       level:2, tag:"kata kerja" },
    { hanzi:"准备", pinyin:"zhǔnbèi",   arti:"mempersiapkan",  level:2, tag:"kata kerja" },
    { hanzi:"问题", pinyin:"wèntí",     arti:"masalah/pertanyaan",level:2, tag:"benda" },
    { hanzi:"时间", pinyin:"shíjiān",   arti:"waktu",          level:2, tag:"waktu" },
    // HSK 3
    { hanzi:"虽然", pinyin:"suīrán",    arti:"meskipun",       level:3, tag:"konjungsi" },
    { hanzi:"但是", pinyin:"dànshì",    arti:"tetapi",         level:3, tag:"konjungsi" },
    { hanzi:"因为", pinyin:"yīnwèi",    arti:"karena",         level:3, tag:"konjungsi" },
    { hanzi:"所以", pinyin:"suǒyǐ",     arti:"oleh karena itu",level:3, tag:"konjungsi" },
    { hanzi:"如果", pinyin:"rúguǒ",     arti:"jika",           level:3, tag:"konjungsi" },
    { hanzi:"经验", pinyin:"jīngyàn",   arti:"pengalaman",     level:3, tag:"benda" },
    { hanzi:"环境", pinyin:"huánjìng",  arti:"lingkungan",     level:3, tag:"benda" },
    { hanzi:"发展", pinyin:"fāzhǎn",    arti:"berkembang",     level:3, tag:"kata kerja" },
  ],

  // ── SENTENCES ────────────────────────────────────────────────
  sentences: [
    { hanzi:"我喜欢中文。",        pinyin:"Wǒ xǐhuān Zhōngwén.",        arti:"Saya suka bahasa Mandarin.", level:1 },
    { hanzi:"今天天气很好。",       pinyin:"Jīntiān tiānqì hěn hǎo.",    arti:"Cuaca hari ini sangat bagus.", level:1 },
    { hanzi:"我今天很忙。",         pinyin:"Wǒ jīntiān hěn máng.",       arti:"Hari ini saya sangat sibuk.", level:1 },
    { hanzi:"我昨天去了学校。",     pinyin:"Wǒ zuótiān qùle xuéxiào.",   arti:"Kemarin saya pergi ke sekolah.", level:1 },
    { hanzi:"你好吗？",             pinyin:"Nǐ hǎo ma?",                 arti:"Apa kabar?", level:1 },
    { hanzi:"我很好，谢谢。",       pinyin:"Wǒ hěn hǎo, xièxiè.",       arti:"Saya baik-baik saja, terima kasih.", level:1 },
    { hanzi:"你去哪儿？",           pinyin:"Nǐ qù nǎr?",                 arti:"Kamu pergi ke mana?", level:1 },
    { hanzi:"我去超市买东西。",     pinyin:"Wǒ qù chāoshì mǎi dōngxi.", arti:"Saya pergi ke supermarket membeli sesuatu.", level:1 },
    { hanzi:"他是我的老师。",       pinyin:"Tā shì wǒ de lǎoshī.",      arti:"Dia adalah guru saya.", level:1 },
    { hanzi:"我们一起去吃饭吧。",   pinyin:"Wǒmen yìqǐ qù chīfàn ba.", arti:"Ayo kita pergi makan bersama.", level:2 },
    { hanzi:"虽然下雨了，但是我还是去了学校。", pinyin:"Suīrán xià yǔ le, dànshì wǒ háishì qùle xuéxiào.", arti:"Meskipun hujan, saya tetap pergi ke sekolah.", level:3 },
    { hanzi:"因为他很努力，所以成绩很好。", pinyin:"Yīnwèi tā hěn nǔlì, suǒyǐ chéngjì hěn hǎo.", arti:"Karena dia sangat rajin, maka nilainya bagus.", level:3 },
    { hanzi:"如果明天不下雨，我们就去公园。", pinyin:"Rúguǒ míngtiān bù xià yǔ, wǒmen jiù qù gōngyuán.", arti:"Jika besok tidak hujan, kita akan pergi ke taman.", level:3 },
    { hanzi:"你周末做什么？",       pinyin:"Nǐ zhōumò zuò shénme?",     arti:"Apa yang kamu lakukan di akhir pekan?", level:2 },
    { hanzi:"我在家休息。",         pinyin:"Wǒ zài jiā xiūxi.",          arti:"Saya beristirahat di rumah.", level:1 },
  ],

  // ── GRAMMAR PATTERNS ─────────────────────────────────────────
  grammar: [
    {
      pola: "虽然……但是……",
      arti: "Meskipun ... tetapi ...",
      contoh: ["虽然下雨了，但是我还是去了。", "虽然他很忙，但是他来了。"],
      salah:  ["虽然下雨了，我还是去了。", "但是下雨了，虽然我去了。"],
      keterangan: "Digunakan untuk menyatakan kontras/pertentangan.",
      level: 3
    },
    {
      pola: "因为……所以……",
      arti: "Karena ... oleh karena itu ...",
      contoh: ["因为我累了，所以我睡觉了。", "因为天气好，所以我们去公园。"],
      salah:  ["所以我累了，因为我睡觉了。", "因为我累了，我睡觉了。"],
      keterangan: "Digunakan untuk menyatakan sebab-akibat.",
      level: 2
    },
    {
      pola: "如果……就……",
      arti: "Jika ... maka ...",
      contoh: ["如果你帮我，我就帮你。", "如果明天下雨，我就不去了。"],
      salah:  ["如果你帮我，我帮你。", "就你帮我，如果我帮你。"],
      keterangan: "Digunakan untuk menyatakan kondisi/syarat.",
      level: 3
    },
    {
      pola: "……了",
      arti: "Tanda perubahan keadaan / aksi sudah selesai",
      contoh: ["我吃了饭。", "他来了。", "天亮了。"],
      salah:  ["我了吃饭。", "他了来。"],
      keterangan: "了 diletakkan setelah kata kerja (selesai) atau di akhir kalimat (perubahan).",
      level: 1
    },
    {
      pola: "……过",
      arti: "Pernah melakukan sesuatu (pengalaman)",
      contoh: ["我去过北京。", "他吃过这个菜。"],
      salah:  ["我去北京过。", "他过吃这个菜。"],
      keterangan: "过 diletakkan setelah kata kerja, menyatakan pengalaman.",
      level: 2
    },
    {
      pola: "……着",
      arti: "Menyatakan keadaan/aksi yang sedang berlangsung",
      contoh: ["他笑着说话。", "门开着呢。", "她站着等。"],
      salah:  ["他着笑说话。", "门着开呢。"],
      keterangan: "着 diletakkan setelah kata kerja, menyatakan status/keadaan.",
      level: 2
    },
  ],

  // ── DIALOGUES ────────────────────────────────────────────────
  dialogues: [
    {
      id: "salam",
      judul: "Salam Perkenalan",
      level: 1,
      giliran: [
        { peran:"A", hanzi:"你好！你叫什么名字？", pinyin:"Nǐ hǎo! Nǐ jiào shénme míngzì?", arti:"Halo! Siapa namamu?" },
        { peran:"B", hanzi:"你好！我叫李明。你呢？", pinyin:"Nǐ hǎo! Wǒ jiào Lǐ Míng. Nǐ ne?", arti:"Halo! Namaku Li Ming. Kamu?" },
        { peran:"A", hanzi:"我叫王芳。很高兴认识你！", pinyin:"Wǒ jiào Wáng Fāng. Hěn gāoxìng rènshi nǐ!", arti:"Namaku Wang Fang. Senang berkenalan denganmu!" },
        { peran:"B", hanzi:"我也很高兴认识你！", pinyin:"Wǒ yě hěn gāoxìng rènshi nǐ!", arti:"Aku juga senang berkenalan denganmu!" },
      ],
      pertanyaan: [
        { soal:"李明的名字是什么？", pilihan:["王芳","李明","王明","李芳"], jawaban:1 },
        { soal:"他们第一次见面吗？", pilihan:["是的","不是","不知道","都不对"], jawaban:0 },
      ]
    },
    {
      id: "restoran",
      judul: "Di Restoran",
      level: 1,
      giliran: [
        { peran:"服务员", hanzi:"您好！您想吃什么？", pinyin:"Nín hǎo! Nín xiǎng chī shénme?", arti:"Halo! Apa yang ingin Anda makan?" },
        { peran:"客人",  hanzi:"我要一碗米饭和一个鸡蛋。", pinyin:"Wǒ yào yī wǎn mǐfàn hé yī gè jīdàn.", arti:"Saya mau semangkuk nasi dan sebutir telur." },
        { peran:"服务员", hanzi:"好的，还需要什么吗？", pinyin:"Hǎo de, hái xūyào shénme ma?", arti:"Baik, ada yang lain?" },
        { peran:"客人",  hanzi:"一杯热水，谢谢。", pinyin:"Yī bēi rè shuǐ, xièxiè.", arti:"Segelas air panas, terima kasih." },
      ],
      pertanyaan: [
        { soal:"客人点了什么？", pilihan:["米饭和鸡蛋","面条和鸡蛋","米饭和猪肉","面包和鸡蛋"], jawaban:0 },
        { soal:"客人还要了什么喝的？", pilihan:["冷水","热水","茶","果汁"], jawaban:1 },
      ]
    },
    {
      id: "belanja",
      judul: "Belanja di Pasar",
      level: 2,
      giliran: [
        { peran:"买家", hanzi:"这个苹果多少钱一斤？", pinyin:"Zhège píngguǒ duōshǎo qián yī jīn?", arti:"Berapa harga apel ini per setengah kilo?" },
        { peran:"卖家", hanzi:"三块钱一斤。你要几斤？", pinyin:"Sān kuài qián yī jīn. Nǐ yào jǐ jīn?", arti:"Tiga yuan per setengah kilo. Mau berapa?" },
        { peran:"买家", hanzi:"我要两斤。便宜一点儿可以吗？", pinyin:"Wǒ yào liǎng jīn. Piányí yīdiǎnr kěyǐ ma?", arti:"Saya mau dua. Bisa lebih murah?" },
        { peran:"卖家", hanzi:"好吧，五块钱两斤。", pinyin:"Hǎo ba, wǔ kuài qián liǎng jīn.", arti:"Baiklah, lima yuan untuk dua." },
      ],
      pertanyaan: [
        { soal:"苹果原来多少钱一斤？", pilihan:["两块","三块","四块","五块"], jawaban:1 },
        { soal:"最后买了多少苹果？", pilihan:["一斤","两斤","三斤","四斤"], jawaban:1 },
      ]
    },
  ],

  // ── READING PASSAGES ─────────────────────────────────────────
  passages: [
    {
      id: "r1",
      judul: "Keluargaku",
      level: 1,
      teks: "我家有四口人：爸爸、妈妈、妹妹和我。我爸爸是老师，他每天去学校上课。我妈妈在医院工作，她是医生。我妹妹今年八岁，她很喜欢画画。我是大学生，我喜欢学习汉语。",
      terjemahan: "Keluargaku ada empat orang: ayah, ibu, adik perempuan, dan aku. Ayahku adalah guru, setiap hari dia pergi ke sekolah mengajar. Ibuku bekerja di rumah sakit, dia adalah dokter. Adikku tahun ini berusia delapan tahun, dia sangat suka menggambar. Aku adalah mahasiswa, aku suka belajar bahasa Mandarin.",
      pertanyaan: [
        { soal:"爸爸是什么工作？", pilihan:["医生","老师","工人","学生"], jawaban:1 },
        { soal:"妹妹今年几岁？", pilihan:["六岁","七岁","八岁","九岁"], jawaban:2 },
        { soal:"妈妈在哪里工作？", pilihan:["学校","工厂","医院","商店"], jawaban:2 },
        { soal:"这篇文章的主要内容是什么？", pilihan:["介绍学校","介绍家庭","介绍城市","介绍工作"], jawaban:1 },
      ]
    },
    {
      id: "r2",
      judul: "Olahraga Favoritku",
      level: 2,
      teks: "我很喜欢运动，特别是打篮球。每个周末，我都和朋友们一起去操场打篮球。打篮球不但可以锻炼身体，还可以结交新朋友。虽然我打得不是很好，但是我非常努力。我的教练说，只要坚持练习，一定会进步的。",
      terjemahan: "Saya sangat suka olahraga, terutama bermain basket. Setiap akhir pekan, saya selalu pergi ke lapangan bermain basket bersama teman-teman. Bermain basket tidak hanya bisa melatih tubuh, tapi juga bisa menambah teman baru. Meskipun saya tidak terlalu pandai bermain, saya sangat berusaha keras. Pelatihku bilang, selama terus berlatih, pasti akan ada kemajuan.",
      pertanyaan: [
        { soal:"他最喜欢什么运动？", pilihan:["足球","篮球","游泳","跑步"], jawaban:1 },
        { soal:"他什么时候打篮球？", pilihan:["每天","每个周末","每个月","每个假期"], jawaban:1 },
        { soal:"打篮球有什么好处？（根据文章）", pilihan:["赚钱","锻炼身体和结交朋友","变聪明","学英语"], jawaban:1 },
        { soal:"这段话的主要意思是什么？", pilihan:["介绍篮球规则","描述一次比赛","分享打篮球的喜爱","批评懒惰的人"], jawaban:2 },
      ]
    }
  ],

  // ── NADA SETS — kelompok suku kata sama, beda nada saja ───────
  //  Dipakai fitur "Fokus Nada" (vocab). Tiap grup berisi 2-4 hanzi
  //  yang pelafalannya sama persis kecuali nadanya.
  nadaSets: [
    { base:"ma",    list:[ {hanzi:"妈", pinyin:"mā", tone:1, arti:"ibu"}, {hanzi:"麻", pinyin:"má", tone:2, arti:"rami/kebas"}, {hanzi:"马", pinyin:"mǎ", tone:3, arti:"kuda"}, {hanzi:"骂", pinyin:"mà", tone:4, arti:"memarahi"} ] },
    { base:"ba",    list:[ {hanzi:"八", pinyin:"bā", tone:1, arti:"delapan"}, {hanzi:"拔", pinyin:"bá", tone:2, arti:"mencabut"}, {hanzi:"把", pinyin:"bǎ", tone:3, arti:"(kata bantu)"}, {hanzi:"爸", pinyin:"bà", tone:4, arti:"ayah"} ] },
    { base:"tang",  list:[ {hanzi:"汤", pinyin:"tāng", tone:1, arti:"sup"}, {hanzi:"糖", pinyin:"táng", tone:2, arti:"gula/permen"}, {hanzi:"躺", pinyin:"tǎng", tone:3, arti:"berbaring"}, {hanzi:"烫", pinyin:"tàng", tone:4, arti:"panas (sentuh)"} ] },
    { base:"wan",   list:[ {hanzi:"弯", pinyin:"wān", tone:1, arti:"melengkung"}, {hanzi:"玩", pinyin:"wán", tone:2, arti:"bermain"}, {hanzi:"晚", pinyin:"wǎn", tone:3, arti:"malam/terlambat"}, {hanzi:"万", pinyin:"wàn", tone:4, arti:"sepuluh ribu"} ] },
    { base:"shi",   list:[ {hanzi:"诗", pinyin:"shī", tone:1, arti:"puisi"}, {hanzi:"十", pinyin:"shí", tone:2, arti:"sepuluh"}, {hanzi:"使", pinyin:"shǐ", tone:3, arti:"menyuruh"}, {hanzi:"是", pinyin:"shì", tone:4, arti:"adalah"} ] },
    { base:"qi",    list:[ {hanzi:"七", pinyin:"qī", tone:1, arti:"tujuh"}, {hanzi:"其", pinyin:"qí", tone:2, arti:"itu/nya"}, {hanzi:"起", pinyin:"qǐ", tone:3, arti:"bangun/mulai"}, {hanzi:"气", pinyin:"qì", tone:4, arti:"udara/marah"} ] },
    { base:"zhu",   list:[ {hanzi:"猪", pinyin:"zhū", tone:1, arti:"babi"}, {hanzi:"竹", pinyin:"zhú", tone:2, arti:"bambu"}, {hanzi:"主", pinyin:"zhǔ", tone:3, arti:"utama/tuan"}, {hanzi:"住", pinyin:"zhù", tone:4, arti:"tinggal"} ] },
    { base:"guo",   list:[ {hanzi:"锅", pinyin:"guō", tone:1, arti:"panci/wajan"}, {hanzi:"国", pinyin:"guó", tone:2, arti:"negara"}, {hanzi:"果", pinyin:"guǒ", tone:3, arti:"buah"}, {hanzi:"过", pinyin:"guò", tone:4, arti:"melewati/pernah"} ] },
    { base:"jiao",  list:[ {hanzi:"交", pinyin:"jiāo", tone:1, arti:"menyerahkan/berteman"}, {hanzi:"嚼", pinyin:"jiáo", tone:2, arti:"mengunyah"}, {hanzi:"脚", pinyin:"jiǎo", tone:3, arti:"kaki"}, {hanzi:"叫", pinyin:"jiào", tone:4, arti:"memanggil/bernama"} ] },
    { base:"gua",   list:[ {hanzi:"瓜", pinyin:"guā", tone:1, arti:"melon"}, {hanzi:"寡", pinyin:"guǎ", tone:3, arti:"janda/sedikit"}, {hanzi:"挂", pinyin:"guà", tone:4, arti:"menggantung"} ] },
    { base:"tou",   list:[ {hanzi:"偷", pinyin:"tōu", tone:1, arti:"mencuri"}, {hanzi:"头", pinyin:"tóu", tone:2, arti:"kepala"}, {hanzi:"透", pinyin:"tòu", tone:4, arti:"tembus"} ] },
    { base:"liang", list:[ {hanzi:"凉", pinyin:"liáng", tone:2, arti:"dingin/sejuk"}, {hanzi:"两", pinyin:"liǎng", tone:3, arti:"dua"}, {hanzi:"亮", pinyin:"liàng", tone:4, arti:"terang"} ] },
    { base:"zhong", list:[ {hanzi:"中", pinyin:"zhōng", tone:1, arti:"tengah"}, {hanzi:"种", pinyin:"zhǒng", tone:3, arti:"jenis/bibit"}, {hanzi:"重", pinyin:"zhòng", tone:4, arti:"berat/penting"} ] },
    { base:"wang",  list:[ {hanzi:"王", pinyin:"wáng", tone:2, arti:"raja (marga)"}, {hanzi:"网", pinyin:"wǎng", tone:3, arti:"jaring/internet"}, {hanzi:"忘", pinyin:"wàng", tone:4, arti:"lupa"} ] },
    { base:"mai",   list:[ {hanzi:"买", pinyin:"mǎi", tone:3, arti:"membeli"}, {hanzi:"卖", pinyin:"mài", tone:4, arti:"menjual"} ] },
    { base:"hua",   list:[ {hanzi:"花", pinyin:"huā", tone:1, arti:"bunga"}, {hanzi:"滑", pinyin:"huá", tone:2, arti:"licin"}, {hanzi:"画", pinyin:"huà", tone:4, arti:"menggambar"} ] },
    { base:"mei",   list:[ {hanzi:"没", pinyin:"méi", tone:2, arti:"tidak ada"}, {hanzi:"美", pinyin:"měi", tone:3, arti:"indah"}, {hanzi:"妹", pinyin:"mèi", tone:4, arti:"adik perempuan"} ] },
    { base:"kan",   list:[ {hanzi:"刊", pinyin:"kān", tone:1, arti:"terbitan"}, {hanzi:"砍", pinyin:"kǎn", tone:3, arti:"menebang"}, {hanzi:"看", pinyin:"kàn", tone:4, arti:"melihat"} ] },
    { base:"xiang", list:[ {hanzi:"香", pinyin:"xiāng", tone:1, arti:"harum"}, {hanzi:"想", pinyin:"xiǎng", tone:3, arti:"ingin/berpikir"}, {hanzi:"象", pinyin:"xiàng", tone:4, arti:"gajah/mirip"} ] },
    { base:"kao",   list:[ {hanzi:"考", pinyin:"kǎo", tone:3, arti:"ujian"}, {hanzi:"靠", pinyin:"kào", tone:4, arti:"bersandar"} ] },
  ],

  // ── EXAM QUESTIONS (HSK STYLE) ───────────────────────────────
  hsk: {
    listening: [
      { audio:"女：你好，请问洗手间在哪儿？\n男：在那边，往右走。", soal:"洗手间在哪里？", pilihan:["在左边","在右边","在前边","在后边"], jawaban:1 },
      { audio:"男：今天天气怎么样？\n女：今天很热，有三十八度。", soal:"今天多少度？", pilihan:["三十六","三十七","三十八","三十九"], jawaban:2 },
    ],
    reading: [
      { teks:"他每天早上六点起床，然后跑步三十分钟。", soal:"他几点起床？", pilihan:["五点","六点","七点","八点"], jawaban:1 },
      { teks:"这家餐厅的菜不好吃，而且价格很贵。", soal:"这家餐厅怎么样？", pilihan:["菜好吃但贵","菜不好吃而且贵","菜好吃而且便宜","菜不好吃但便宜"], jawaban:1 },
    ],
    writing: [
      { gambar:"🌧️", pinyin:"xià yǔ", hanzi:"下雨" },
      { gambar:"🍎", pinyin:"píngguǒ", hanzi:"苹果" },
    ]
  }

};

// ── UTILS ─────────────────────────────────────────────────────
function acak(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function ambilAcak(arr, n = 1) {
  return acak(arr).slice(0, n);
}
 
