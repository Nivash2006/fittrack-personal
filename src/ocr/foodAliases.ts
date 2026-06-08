/**
 * FitTrack Personal — Food Alias Dictionary
 *
 * Maps OCR-detected text variants, misspellings, transliterations,
 * and common aliases to canonical food names in FOOD_DATABASE.
 * Used by the meal recognizer to improve OCR hit rate.
 *
 * Canonical name → must be a substring match of a name in FOOD_DATABASE.
 * Aliases include:
 *   - OCR misreads / typos (e.g., "ldli" for "idli")
 *   - Tamil romanisations & transliterations
 *   - Common abbreviations (e.g., "pb masala" for paneer butter masala)
 *   - Regional spelling variants
 *   - Generic synonyms used in menu scans
 */

export const FOOD_ALIASES: Record<string, string[]> = {
  // ─── Tamil Nadu / South Indian Breakfast ─────────────────────────────────

  idli: [
    'idly',
    'idlee',
    'iddli',
    'ldli',            // OCR swap l→d
    'idl1',            // OCR 1≈l
    'इडली',
    'இட்லி',
  ],

  dosa: [
    'dosai',
    'd0sa',            // OCR 0≈o
    'dhosa',
    'dosha',
    'thosai',
    'tosa',
    'தோசை',
  ],

  'masala dosa': [
    'masala dosai',
    'msala dosa',
    'masaladosa',
    'masala thosai',
    'masala d0sa',
  ],

  'rava dosa': [
    'rava dosai',
    'sooji dosa',
    'suji dosa',
    'semolina dosa',
    'rawa dosa',
    'rava d0sa',
  ],

  'ragi dosa': [
    'ragi dosai',
    'nachni dosa',
    'finger millet dosa',
  ],

  'onion uttapam': [
    'uttapam',
    'utthapam',
    'uthappam',
    'uttappam',
    'oothapam',
    'onion uthappam',
    'ut1apam',         // OCR 1≈t
  ],

  sambar: [
    'sambhar',
    'saambar',
    'samber',
    'sambaar',
    'சாம்பார்',
    's4mbar',          // OCR 4≈a
  ],

  rasam: [
    'rasaam',
    'charu',
    'saaru',
    'pepper water',
    'tomato rasam',
    'saaru',
    'ras4m',
  ],

  'ven pongal': [
    'pongal',
    'khichdi pongal',
    'kichadi',
    'ven ponga1',
    'venpongal',
    'khara pongal',
    'பொங்கல்',
  ],

  'sweet pongal': [
    'sakkarai pongal',
    'chakkara pongal',
    'sweet ponga1',
    'sakkarai ponga1',
    'sarkarai pongal',
  ],

  'idiyappam': [
    'string hoppers',
    'noolputtu',
    'idiappam',
    'idyappam',
    'nool puttu',
    'sevai',
    'idiyappam',
    'string hopper',
  ],

  appam: [
    'aappam',
    'aapam',
    'palappam',
    'hoppers',
    'hopper',
    'ap9am',           // OCR 9≈p
  ],

  puttu: [
    'puttoo',
    'rice puttu',
    'kuzha puttu',
    'putttu',
    'puth',
  ],

  upma: [
    'uppuma',
    'upuma',
    'rava upma',
    'sooji upma',
    'uppumavu',
    'oopma',
    'u9ma',
  ],

  'poha': [
    'pohe',
    'aval',
    'avalakki',
    'flattened rice',
    'beaten rice',
    'chivda',
    'p0ha',
  ],

  pesarattu: [
    'moong dal dosa',
    'green gram dosa',
    'pesarat',
    'pesaratu',
    'pesa rattu',
  ],

  // ─── Tamil Nadu Curries & Gravies ─────────────────────────────────────────

  kootu: [
    'koottu',
    'kootu curry',
    'kutu',
    'k00tu',
  ],

  poriyal: [
    'poriayal',
    'poryal',
    'stir fry veg',
    'sabzi',
    'thoran',
    'fry',
  ],

  'curd rice': [
    'thayir sadam',
    'dahi chawal',
    'curd sadam',
    'dahirice',
    'thayir sadham',
    'mosaranna',
    'dahi rice',
  ],

  'lemon rice': [
    'elumichai sadam',
    'chitranna',
    'nimmakaya annam',
    'lemon sadam',
    'elumichai sadham',
  ],

  'tamarind rice': [
    'puliyodharai',
    'puliyodarai',
    'tamarind sadam',
    'puli sadham',
    'pulihora',
    'puliyogare',
  ],

  // ─── Ragi ─────────────────────────────────────────────────────────────────

  'ragi mudde': [
    'ragi kali',
    'ragi ball',
    'finger millet ball',
    'kelvaragu kali',
    'ragi sankati',
    'nachni mudde',
    'ragi mud',
  ],

  // ─── Parotta & Kothu ──────────────────────────────────────────────────────

  parotta: [
    'porotta',
    'parotha',
    'paratha',        // common confusion
    'barotta',
    'pr0tta',
    'layered bread',
    'flaky bread',
    'சப்பாத்தி',     // people sometimes call parotta this
  ],

  'kothu parotta': [
    'kothu porotta',
    'kothu',
    'kothu roti',
    'kotthu parotta',
    'kothu parrota',
    'k0thu parotta',
  ],

  'parotta with chicken salna': [
    'chicken salna',
    'salna',
    'parotta chicken',
    'parotta chicken gravy',
    'chicken salana',
    'chicken gravy parotta',
  ],

  'parotta with veg salna': [
    'veg salna',
    'vegetable salna',
    'parotta veg',
    'veg gravy parotta',
    'parotta vegetable',
  ],

  // ─── Non-Veg TN Specials ──────────────────────────────────────────────────

  'chicken chettinad': [
    'chettinad chicken',
    'chettinad curry',
    'nattu kozhi',
    'natu koli',
    'chicken kuzhambu',
    'kari kuzhambu',
  ],

  'mutton kuzhambu': [
    'mutton curry',
    'aatu kari kuzhambu',
    'lamb curry',
    'mutton gravy',
    'aatukari',
    'muttton curry',
  ],

  'fish fry': [
    'meen varuval',
    'fish varuval',
    'meen fry',
    'fish varuwal',
    'fish fry',
    'fried fish',
    'nethili fry',
  ],

  // ─── Vada ─────────────────────────────────────────────────────────────────

  'medhu vadai': [
    'medu vada',
    'medu vadai',
    'ulundu vadai',
    'urad dal vada',
    'meduvada',
    'donut vada',
    'medhu vada',
  ],

  'masala vadai': [
    'masala vada',
    'paruppu vadai',
    'dal vada',
    'masala vadai',
    'chana dal vada',
  ],

  bajji: [
    'bonda',
    'pakora',
    'pakoda',
    'bhajji',
    'bhajia',
    'bajia',
    'bajji',
    'b4jji',
  ],

  // ─── Biryani ──────────────────────────────────────────────────────────────

  biryani: [
    'biriani',
    'biriyani',
    'briyani',
    'biryaani',
    'biriyana',
    'b1ryani',        // OCR 1≈i
    'briyaani',
    'biraiyan',
  ],

  'ambur biryani': [
    'ambur biriyani',
    'ambur briyani',
    'seeraga samba biryani',
    'seragasamba biriyani',
    'amboor biryani',
  ],

  // ─── Snacks ──────────────────────────────────────────────────────────────

  murukku: [
    'muruuku',
    'muruku',
    'chakli',
    'murukki',
    'murukoo',
    'rice chakli',
    'm0rukku',
  ],

  mixture: [
    'chevdo',
    'namkeen',
    'chivda',
    'farsan',
    'south indian mixture',
    'snack mix',
  ],

  thattai: [
    'thattai murukku',
    'thatai',
    'tattai',
    'disc murukku',
    'thaatai',
  ],

  seedai: [
    'seeada',
    'seadai',
    'rice seedai',
    'nel seedai',
    'round seedai',
    'sidi',
  ],

  // ─── Sweets ──────────────────────────────────────────────────────────────

  'semiya payasam': [
    'vermicelli payasam',
    'semiya kheer',
    'sevai payasam',
    'seviyan kheer',
    'semiya kheer',
    'semiya payasam',
  ],

  'pal payasam': [
    'rice kheer',
    'rice payasam',
    'milk payasam',
    'paal payasam',
    'arisi payasam',
  ],

  kesari: [
    'rava kesari',
    'sooji halwa',
    'suji halwa',
    'sheera',
    'kesari bath',
    'k3sari',
  ],

  adhirasam: [
    'athirasam',
    'adhirasam',
    'adirasam',
    'adhirasam sweet',
    'rice jaggery sweet',
  ],

  // ─── North Indian Bread ───────────────────────────────────────────────────

  chapati: [
    'chapathi',
    'chapatti',
    'chapathi',
    'chappati',
    'roti chapati',
    'phulka',
    'flat bread',
    'ch4pati',
  ],

  roti: [
    'rotti',
    'rotee',
    'indian bread',
    'whole wheat roti',
    'r0ti',
    'rotis',
  ],

  naan: [
    'nan',
    'naaan',
    'naan bread',
    'garlic naan',
    'tandoori naan',
    'n4an',
  ],

  poori: [
    'puri',
    'poory',
    'puri bread',
    'fried bread',
    'poori bread',
    'p0ori',
  ],

  'aloo paratha': [
    'potato paratha',
    'aloo parotha',
    'aloo paratha',
    'stuffed paratha',
    'a100 paratha',
  ],

  // ─── Dals & Legumes ───────────────────────────────────────────────────────

  'toor dal': [
    'tuvar dal',
    'arhar dal',
    'pigeon pea dal',
    'toor dhal',
    'split pigeon pea',
    'toovar dal',
  ],

  'moong dal': [
    'mung dal',
    'green gram dal',
    'moong dhal',
    'pesara pappu',
    'moong lentil',
    'm0ong dal',
  ],

  'masoor dal': [
    'red lentil',
    'masur dal',
    'red dal',
    'masoor dhal',
    'm4soor dal',
  ],

  'chana dal': [
    'split chickpea',
    'bengal gram dal',
    'channa dal',
    'chane ki dal',
    'ch4na dal',
  ],

  rajma: [
    'kidney beans',
    'rajmah',
    'red beans curry',
    'rajma curry',
    'rajma chawal',
    'r4jma',
  ],

  chole: [
    'chhole',
    'chana masala',
    'chickpea curry',
    'chole masala',
    'chana curry',
    'kala chana',
    'ch0le',
  ],

  // ─── North Indian Curries ─────────────────────────────────────────────────

  'paneer butter masala': [
    'pb masala',
    'paneer makhani',
    'butter paneer',
    'paneer curry',
    'panner butter masala',
    'pneer butter masala',
  ],

  'palak paneer': [
    'spinach paneer',
    'spinach cottage cheese',
    'pa1ak paneer',
    'palak panner',
    'saag paneer',
  ],

  'aloo gobi': [
    'potato cauliflower',
    'gobhi aloo',
    'aloo gobhi',
    'a100 gobi',
    'potato gobi',
  ],

  'baingan bharta': [
    'brinjal bharta',
    'eggplant bharta',
    'smoky eggplant',
    'bhanta bharta',
    'baingan',
  ],

  'chicken curry': [
    'kozhi curry',
    'chicken gravy',
    'kodi curry',
    'chicken masala',
    'ch1cken curry',
    'chickan curry',
  ],

  'butter chicken': [
    'murgh makhani',
    'butter murgh',
    'makhani chicken',
    'butter chikken',
    'b utterchhicken',
  ],

  'tandoori chicken': [
    'tanduri chicken',
    'tandoor chicken',
    'tand00ri chicken',
    'tandoori murgh',
    'clay oven chicken',
  ],

  'egg curry': [
    'mutta kuzhambu',
    'muttai kuzhambu',
    'egg gravy',
    'anda curry',
    'egg masala',
    'egg karri',
  ],

  // ─── Eggs ────────────────────────────────────────────────────────────────

  'boiled egg': [
    'hard boiled egg',
    'muttai',
    'anda',
    'egg',
    'b0iled egg',
    'hard egg',
    'andam',
  ],

  omelette: [
    'omelet',
    'omlette',
    'omlett',
    '0melette',
    'egg omelette',
    'egg omelet',
    'om3lette',
  ],

  'egg bhurji': [
    'scrambled egg',
    'anda bhurji',
    'egg scramble',
    'bhurji egg',
    'egg bhuri',
    'masala egg',
  ],

  // ─── Rice ────────────────────────────────────────────────────────────────

  'white rice': [
    'cooked rice',
    'steamed rice',
    'plain rice',
    'sadam',
    'sadham',
    'anna',
    'boiled rice',
    'wh1te rice',
    'chawal',
  ],

  'brown rice': [
    'whole grain rice',
    'br0wn rice',
    'unpolished rice',
  ],

  'jeera rice': [
    'cumin rice',
    'jira rice',
    'zeera rice',
    'jeera chawal',
    'cumin chawal',
  ],

  // ─── Fruits ──────────────────────────────────────────────────────────────

  banana: [
    'plantain',
    'vaazhai pazham',
    'bananaa',
    'kela',
    'nendram',
    'b4nana',
    'banan',
  ],

  apple: [
    'aple',
    'app1e',
    'appl',
    'green apple',
    'red apple',
    'apple fruit',
  ],

  mango: [
    'mangoe',
    'aam',
    'mangoo',
    'manga',
    'maampazhm',
    'm4ngo',
    'alphonso',
    'raw mango',
  ],

  papaya: [
    'papaia',
    'pappaya',
    'pawpaw',
    'paw paw',
    'papaaya',
    'papita',
    'p4paya',
  ],

  orange: [
    'narangi',
    'kichili',
    'kittale',
    'or4nge',
    'citrus',
    'mandarin',
    'tangerine',
  ],

  grapes: [
    'grape',
    'munthiri',
    'angoor',
    'gr4pes',
    'black grapes',
    'green grapes',
  ],

  watermelon: [
    'tarbooz',
    'water melon',
    'w4termelon',
    'tharboosani',
    'pazham',
  ],

  // ─── Dairy ───────────────────────────────────────────────────────────────

  'whole milk': [
    'full cream milk',
    'cow milk',
    'buffalo milk',
    'milk',
    'pa1',
    'paal',
    'dudh',
  ],

  'curd': [
    'yogurt',
    'yoghurt',
    'dahi',
    'thayir',
    'curd yogurt',
    'plain curd',
    'c0rd',
  ],

  'buttermilk': [
    'neer mor',
    'chaas',
    'moru',
    'b uttermilk',
    'thinned curd',
    'diluted curd',
    'moor',
  ],

  lassi: [
    'sweet lassi',
    'mango lassi',
    'l4ssi',
    'lassy',
    'yogurt drink',
    'dahi drink',
  ],

  paneer: [
    'cottage cheese',
    'panner',
    'paner',
    'panear',
    'p4neer',
    'chenna',
  ],

  'cheese slice': [
    'cheese',
    'processed cheese',
    'ch3ese',
    'ch33se',
    'cheese single',
    'amul cheese',
  ],

  // ─── Protein Sources ─────────────────────────────────────────────────────

  'chicken breast': [
    'grilled chicken',
    'chicken breast grilled',
    'boneless chicken',
    'ch1cken breast',
    'white meat chicken',
  ],

  'fish': [
    'meen',
    'fish fillet',
    'steamed fish',
    'f1sh',
    'rohu',
    'katla',
    'tilapia',
  ],

  prawns: [
    'shrimp',
    'chemmeen',
    'jhinga',
    'prawn',
    'pr4wns',
    'kolambi',
    'scampi',
  ],

  'whey protein': [
    'protein powder',
    'protein shake',
    'whey',
    'protein scoop',
    'pr0tein powder',
    'isolate protein',
  ],

  'soya chunks': [
    'soy chunks',
    'meal maker',
    'textured soy protein',
    'tsp',
    'nutrela',
    'soya nuggets',
  ],

  // ─── Grains & Cereals ─────────────────────────────────────────────────────

  oats: [
    'oatmeal',
    'rolled oats',
    'quaker',
    'porridge',
    '0ats',
    'oat',
    'oat meal',
  ],

  cornflakes: [
    'corn flakes',
    'cereal',
    'c0rnflakes',
    'corn fl4kes',
    'kelloggs',
    'breakfast cereal',
  ],

  'white bread': [
    'bread',
    'sandwich bread',
    'bread slice',
    'wh1te bread',
    'pav',
    'toast',
    'white toast',
  ],

  'wheat bread': [
    'brown bread',
    'whole wheat bread',
    'multigrain bread',
    'wh34t bread',
    'wholegrain bread',
    'atta bread',
  ],

  muesli: [
    'granola',
    'mu3sli',
    'museli',
    'mueseli',
    'mixed cereal',
  ],

  // ─── Nuts & Oils ─────────────────────────────────────────────────────────

  almonds: [
    'badam',
    '4lmonds',
    'almond',
    'b4dam',
    'raw almond',
    'roasted almond',
  ],

  cashews: [
    'kaju',
    'cashew nut',
    'c4shews',
    'cashew',
    'raw cashew',
    'roasted cashew',
  ],

  peanuts: [
    'groundnuts',
    'mungfali',
    'kadalai',
    'p3anuts',
    'monkey nuts',
    'raw peanuts',
  ],

  walnuts: [
    'walnut',
    'akharot',
    'w4lnuts',
    'walnut halves',
    'brain nut',
  ],

  ghee: [
    'clarified butter',
    'desi ghee',
    'gh33',
    'neyy',
    'ney',
    'gi',
  ],

  'coconut oil': [
    'copra oil',
    'c0conut oil',
    'thengai ennai',
    'coconut cooking oil',
  ],

  sugar: [
    'white sugar',
    'refined sugar',
    'cheeni',
    'sukkar',
    'sak4r',
    'sugar crystals',
  ],

  jaggery: [
    'gur',
    'vellam',
    'bellam',
    'j4ggery',
    'palm jaggery',
    'cane jaggery',
    'brown sugar block',
  ],

  honey: [
    'natural honey',
    'h0ney',
    'h3ney',
    'bee honey',
    'raw honey',
    'wild honey',
  ],

  // ─── Beverages ────────────────────────────────────────────────────────────

  'filter coffee': [
    'degree coffee',
    'decoction coffee',
    'thambi coffee',
    'madras coffee',
    'south indian coffee',
    'fil ter coffee',
    'kaapi',
    'kapi',
  ],

  'tea': [
    'chai',
    'cutting chai',
    'masala chai',
    't3a',
    'milk tea',
    'te4',
    'teh',
  ],

  'black tea': [
    'plain tea',
    'sugarfree tea',
    'black t3a',
    'no sugar tea',
    'herbal tea',
    'green tea',
  ],

  'black coffee': [
    'americano',
    'espresso',
    'plain coffee',
    'bl4ck coffee',
    'no milk coffee',
    'sugarfree coffee',
  ],

  'tender coconut water': [
    'coconut water',
    'tender coconut',
    'ilaneer',
    'elaneer',
    'young coconut',
    'nariyal pani',
  ],

  jigarthanda: [
    'jigar thanda',
    'jighar thanda',
    'jigarthanda drink',
    'madurai jigarthanda',
  ],

  'fresh lime soda': [
    'lime soda',
    'lemon soda',
    'nimbu soda',
    'lime juice soda',
    'fresh lime',
    'sweet lime soda',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve an OCR-detected word to its canonical food name alias.
 * Returns the canonical name if found, otherwise returns the input lowercased.
 *
 * @example
 *   resolveAlias('idly')   // → 'idli'
 *   resolveAlias('dosai')  // → 'dosa'
 *   resolveAlias('pizza')  // → 'pizza'  (no alias, passthrough)
 */
export function resolveAlias(word: string): string {
  const lower = word.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(FOOD_ALIASES)) {
    if (canonical === lower || aliases.some(a => a === lower)) {
      return canonical;
    }
  }
  return lower;
}

/**
 * Expand a phrase by resolving each word through the alias dictionary.
 * Returns the expanded phrase for better food database matching.
 *
 * Multi-word aliases are also checked: sliding windows of 2–3 tokens are
 * tested against the alias map so that "kothu porotta" → "kothu parotta".
 *
 * @example
 *   expandPhrase('idly sambar')      // → 'idli sambar'
 *   expandPhrase('kothu porotta')    // → 'kothu parotta'
 */
export function expandPhrase(phrase: string): string {
  const tokens = phrase.trim().toLowerCase().split(/\s+/);

  // 1. Try 3-token windows first, then 2-token windows, then single tokens.
  const used = new Array<boolean>(tokens.length).fill(false);
  const result: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    let matched = false;

    // Try 3-gram
    if (i + 2 < tokens.length) {
      const trigram = tokens.slice(i, i + 3).join(' ');
      const resolved3 = resolveAlias(trigram);
      if (resolved3 !== trigram) {
        result.push(resolved3);
        used[i] = used[i + 1] = used[i + 2] = true;
        i += 3;
        matched = true;
      }
    }

    if (!matched && i + 1 < tokens.length) {
      // Try 2-gram
      const bigram = tokens.slice(i, i + 2).join(' ');
      const resolved2 = resolveAlias(bigram);
      if (resolved2 !== bigram) {
        result.push(resolved2);
        used[i] = used[i + 1] = true;
        i += 2;
        matched = true;
      }
    }

    if (!matched) {
      result.push(resolveAlias(tokens[i]));
      i += 1;
    }
  }

  return result.join(' ');
}
