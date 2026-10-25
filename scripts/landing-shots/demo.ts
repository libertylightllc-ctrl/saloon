/**
 * The demo salons behind the website's app pictures (full update, Phase 4): one set in dirhams (UAE salons) and one
 * in dollars (international salons, prices set in dollars, not converted dirhams), each shown in the app's 7
 * languages. Names typed by a salon (services, stock, people) are renamed per language, as a salon there would type
 * them; salon names stay as written. All of it is made up: no real customer data.
 */
export const LANGS = ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
export type Cur = 'aed' | 'usd';

/** English → [ar, hi, ur, es, fr, pt]. */
type Names = Record<string, readonly [string, string, string, string, string, string]>;

export const CATEGORIES: Names = {
  Hair: ['شعر', 'बाल', 'بال', 'Cabello', 'Cheveux', 'Cabelo'],
  Beard: ['لحية', 'दाढ़ी', 'داڑھی', 'Barba', 'Barbe', 'Barba'],
  Colour: ['صبغة', 'रंग', 'رنگ', 'Color', 'Couleur', 'Coloração'],
  Face: ['الوجه', 'चेहरा', 'چہرہ', 'Rostro', 'Visage', 'Rosto'],
  Massage: ['مساج', 'मालिश', 'مالش', 'Masaje', 'Massage', 'Massagem'],
  Nails: ['أظافر', 'नाखून', 'ناخن', 'Uñas', 'Ongles', 'Unhas'],
  Treatments: ['علاجات', 'ट्रीटमेंट', 'ٹریٹمنٹ', 'Tratamientos', 'Soins', 'Tratamentos'],
  'Lashes & brows': ['رموش وحواجب', 'पलकें और भौंहें', 'پلکیں اور بھنویں', 'Pestañas y cejas', 'Cils et sourcils', 'Cílios e sobrancelhas'],
  'Skincare & facials': ['العناية بالبشرة', 'स्किनकेयर', 'جلد کی دیکھ بھال', 'Cuidado facial', 'Soins du visage', 'Cuidados faciais'],
  Waxing: ['الشمع', 'वैक्सिंग', 'ویکسنگ', 'Depilación', 'Épilation', 'Depilação'],
  Facial: ['فيشل', 'फेशियल', 'فیشل', 'Faciales', 'Soins visage', 'Faciais'],
  Makeup: ['مكياج', 'मेकअप', 'میک اپ', 'Maquillaje', 'Maquillage', 'Maquiagem'],
  'Waxing & threading': ['شمع وخيط', 'वैक्सिंग और थ्रेडिंग', 'ویکسنگ اور تھریڈنگ', 'Cera e hilo', 'Cire et fil', 'Cera e linha'],
  'Spa & massage': ['سبا ومساج', 'स्पा और मालिश', 'سپا اور مالش', 'Spa y masaje', 'Spa et massage', 'Spa e massagem'],
  Bridal: ['العروس', 'ब्राइडल', 'دلہن', 'Novias', 'Mariée', 'Noivas'],
};

export const SERVICES: Names = {
  Haircut: ['قص الشعر', 'हेयरकट', 'ہیئر کٹ', 'Corte de pelo', 'Coupe', 'Corte de cabelo'],
  Shave: ['حلاقة', 'शेव', 'شیو', 'Afeitado', 'Rasage', 'Barbear'],
  'Beard Trim': ['تهذيب اللحية', 'दाढ़ी ट्रिम', 'داڑھی ٹرم', 'Arreglo de barba', 'Taille de barbe', 'Aparar barba'],
  'Beard Color': ['صبغ اللحية', 'दाढ़ी रंग', 'داڑھی رنگ', 'Tinte de barba', 'Coloration barbe', 'Coloração de barba'],
  'Hair Color': ['صبغ الشعر', 'हेयर कलर', 'ہیئر کلر', 'Tinte de cabello', 'Coloration', 'Coloração'],
  Facial: ['تنظيف البشرة', 'फेशियल', 'فیشل', 'Limpieza facial', 'Soin du visage', 'Limpeza de pele'],
  'Head Massage': ['مساج الرأس', 'सिर की मालिश', 'سر کی مالش', 'Masaje capilar', 'Massage crânien', 'Massagem capilar'],
  "Men's Haircut": ['قص شعر رجالي', 'पुरुष हेयरकट', 'مردانہ ہیئر کٹ', 'Corte caballero', 'Coupe homme', 'Corte masculino'],
  "Women's Haircut": ['قص شعر نسائي', 'महिला हेयरकट', 'زنانہ ہیئر کٹ', 'Corte dama', 'Coupe femme', 'Corte feminino'],
  'Blow-dry': ['سشوار', 'ब्लो-ड्राई', 'بلو ڈرائی', 'Brushing', 'Brushing', 'Escova'],
  Manicure: ['مانيكير', 'मैनीक्योर', 'مینیکیور', 'Manicura', 'Manucure', 'Manicure'],
  Pedicure: ['باديكير', 'पेडीक्योर', 'پیڈیکیور', 'Pedicura', 'Pédicure', 'Pedicure'],
  'Gel Nails': ['أظافر جل', 'जेल नेल्स', 'جیل نیلز', 'Uñas de gel', 'Ongles en gel', 'Unhas de gel'],
  'Lash Lift': ['رفع الرموش', 'लैश लिफ्ट', 'لیش لفٹ', 'Lifting de pestañas', 'Rehaussement de cils', 'Lifting de cílios'],
  'Brow Shaping & Tint': ['تشكيل وصبغ الحواجب', 'भौंह शेपिंग और टिंट', 'بھنویں شیپ اور ٹنٹ', 'Diseño y tinte de cejas', 'Sourcils : forme et teinte', 'Design e tintura de sobrancelhas'],
  'Classic Facial': ['تنظيف بشرة كلاسيكي', 'क्लासिक फेशियल', 'کلاسک فیشل', 'Facial clásico', 'Soin visage classique', 'Limpeza de pele clássica'],
  'Swedish Massage': ['مساج سويدي', 'स्वीडिश मसाज', 'سویڈش مساج', 'Masaje sueco', 'Massage suédois', 'Massagem sueca'],
  'Deep Tissue Massage': ['مساج الأنسجة العميقة', 'डीप टिशू मसाज', 'ڈیپ ٹشو مساج', 'Masaje profundo', 'Massage profond', 'Massagem profunda'],
  Waxing: ['إزالة الشعر بالشمع', 'वैक्सिंग', 'ویکسنگ', 'Depilación con cera', 'Épilation à la cire', 'Depilação com cera'],
  'Hair Styling': ['تصفيف الشعر', 'हेयर स्टाइलिंग', 'ہیئر اسٹائلنگ', 'Peinado', 'Coiffage', 'Penteado'],
  'Facial & Eye': ['عناية الوجه والعين', 'फेशियल और आई', 'فیشل اور آئی', 'Facial y contorno de ojos', 'Soin visage et yeux', 'Facial e olhos'],
  Threading: ['خيط', 'थ्रेडिंग', 'تھریڈنگ', 'Depilación con hilo', 'Épilation au fil', 'Depilação com linha'],
  'Bridal Makeup': ['مكياج عروس', 'ब्राइडल मेकअप', 'دلہن میک اپ', 'Maquillaje de novia', 'Maquillage de mariée', 'Maquiagem de noiva'],
  'Moroccan Bath': ['حمام مغربي', 'मोरक्कन बाथ', 'مراکشی حمام', 'Baño marroquí', 'Hammam marocain', 'Banho marroquino'],
};

export const ITEMS: Names = {
  'Neck strips': ['أشرطة الرقبة', 'नेक स्ट्रिप्स', 'نیک اسٹرپس', 'Tiras de cuello', 'Bandes de cou', 'Tiras de pescoço'],
  Tissues: ['مناديل', 'टिश्यू', 'ٹشو', 'Pañuelos', 'Mouchoirs', 'Lenços'],
  'Beard Color': ['صبغة لحية', 'दाढ़ी डाई', 'داڑھی ڈائی', 'Tinte para barba', 'Teinture barbe', 'Tinta para barba'],
  'Developer 20 Vol': ['أوكسجين 20', 'डेवलपर 20 वॉल्यूम', 'ڈیولپر 20 والیوم', 'Oxidante 20 vol', 'Oxydant 20 vol', 'Oxidante 20 vol'],
  'Hair Color': ['صبغة شعر', 'हेयर डाई', 'ہیئر ڈائی', 'Tinte', 'Coloration', 'Tinta'],
  'Hair Oil': ['زيت الشعر', 'हेयर ऑयल', 'ہیئر آئل', 'Aceite capilar', 'Huile capillaire', 'Óleo capilar'],
  Blades: ['شفرات', 'ब्लेड', 'بلیڈ', 'Cuchillas', 'Lames', 'Lâminas'],
  'Shaving Foam': ['رغوة الحلاقة', 'शेविंग फोम', 'شیونگ فوم', 'Espuma de afeitar', 'Mousse à raser', 'Espuma de barbear'],
  Gloves: ['قفازات', 'दस्ताने', 'دستانے', 'Guantes', 'Gants', 'Luvas'],
  'Styling cream': ['كريم تصفيف', 'स्टाइलिंग क्रीम', 'اسٹائلنگ کریم', 'Crema de peinado', 'Crème coiffante', 'Creme de pentear'],
  'Heat spray': ['بخاخ حماية حرارية', 'हीट स्प्रे', 'ہیٹ اسپرے', 'Protector térmico', 'Spray thermique', 'Protetor térmico'],
  'Nail polish': ['طلاء أظافر', 'नेल पॉलिश', 'نیل پالش', 'Esmalte', 'Vernis', 'Esmalte'],
  'Gel polish': ['طلاء جل', 'जेल पॉलिश', 'جیل پالش', 'Esmalte de gel', 'Vernis gel', 'Esmalte em gel'],
  'Face masks': ['أقنعة الوجه', 'फेस मास्क', 'فیس ماسک', 'Mascarillas', 'Masques', 'Máscaras faciais'],
  Thread: ['خيط', 'धागा', 'دھاگا', 'Hilo', 'Fil', 'Linha'],
  Wax: ['شمع', 'वैक्स', 'ویکس', 'Cera', 'Cire', 'Cera'],
  'Black soap': ['صابون أسود', 'ब्लैक सोप', 'کالا صابن', 'Jabón negro', 'Savon noir', 'Sabão preto'],
  'Massage oil': ['زيت مساج', 'मसाज ऑयल', 'مساج آئل', 'Aceite de masaje', 'Huile de massage', 'Óleo de massagem'],
};

export const ROOMS: Names = {
  'Spa room 1': ['غرفة السبا 1', 'स्पा रूम 1', 'اسپا روم 1', 'Sala de spa 1', 'Cabine spa 1', 'Sala de spa 1'],
  'Spa room 2': ['غرفة السبا 2', 'स्पा रूम 2', 'اسپا روم 2', 'Sala de spa 2', 'Cabine spa 2', 'Sala de spa 2'],
  'Treatment room 1': ['غرفة العلاج 1', 'ट्रीटमेंट रूम 1', 'ٹریٹمنٹ روم 1', 'Cabina 1', 'Cabine 1', 'Sala 1'],
  'Treatment room 2': ['غرفة العلاج 2', 'ट्रीटमेंट रूम 2', 'ٹریٹمنٹ روم 2', 'Cabina 2', 'Cabine 2', 'Sala 2'],
};

/** People's names: Latin in es/fr/pt, written in the language's own script in ar, hi and ur. */
export const PEOPLE: Names = {
  Imran: ['عمران', 'इमरान', 'عمران', 'Imran', 'Imran', 'Imran'],
  Rafiq: ['رفيق', 'रफ़ीक़', 'رفیق', 'Rafiq', 'Rafiq', 'Rafiq'],
  Sameer: ['سمير', 'समीर', 'سمیر', 'Sameer', 'Sameer', 'Sameer'],
  'Ahmed Khan': ['أحمد خان', 'अहमद ख़ान', 'احمد خان', 'Ahmed Khan', 'Ahmed Khan', 'Ahmed Khan'],
  'Yousef Ali': ['يوسف علي', 'यूसुफ़ अली', 'یوسف علی', 'Yousef Ali', 'Yousef Ali', 'Yousef Ali'],
  'Omar Saeed': ['عمر سعيد', 'उमर सईद', 'عمر سعید', 'Omar Saeed', 'Omar Saeed', 'Omar Saeed'],
  Mariam: ['مريم', 'मरियम', 'مریم', 'Mariam', 'Mariam', 'Mariam'],
  Aisha: ['عائشة', 'आयशा', 'عائشہ', 'Aisha', 'Aisha', 'Aisha'],
  Leila: ['ليلى', 'लैला', 'لیلیٰ', 'Leila', 'Leila', 'Leila'],
  Priya: ['بريا', 'प्रिया', 'پریا', 'Priya', 'Priya', 'Priya'],
  'Fatima Al Mansoori': ['فاطمة المنصوري', 'फ़ातिमा अल मंसूरी', 'فاطمہ المنصوری', 'Fatima Al Mansoori', 'Fatima Al Mansoori', 'Fatima Al Mansoori'],
  'Sara Ahmed': ['سارة أحمد', 'सारा अहमद', 'سارہ احمد', 'Sara Ahmed', 'Sara Ahmed', 'Sara Ahmed'],
  'Noor Hassan': ['نور حسن', 'नूर हसन', 'نور حسن', 'Noor Hassan', 'Noor Hassan', 'Noor Hassan'],
  Omar: ['عمر', 'उमर', 'عمر', 'Omar', 'Omar', 'Omar'],
  Sara: ['سارة', 'सारा', 'سارہ', 'Sara', 'Sara', 'Sara'],
  Layla: ['ليلى', 'लैला', 'لیلیٰ', 'Layla', 'Layla', 'Layla'],
  Nadia: ['نادية', 'नादिया', 'نادیہ', 'Nadia', 'Nadia', 'Nadia'],
  Marcus: ['ماركوس', 'मार्कस', 'مارکس', 'Marcus', 'Marcus', 'Marcus'],
  Leo: ['ليو', 'लियो', 'لیو', 'Leo', 'Léo', 'Léo'],
  Andre: ['أندريه', 'आंद्रे', 'آندرے', 'Andrés', 'André', 'André'],
  'James Carter': ['جيمس كارتر', 'जेम्स कार्टर', 'جیمز کارٹر', 'James Carter', 'James Carter', 'James Carter'],
  'Daniel Kim': ['دانيال كيم', 'डैनियल किम', 'ڈینیئل کم', 'Daniel Kim', 'Daniel Kim', 'Daniel Kim'],
  'Ryan Brooks': ['رايان بروكس', 'रायन ब्रुक्स', 'رائن بروکس', 'Ryan Brooks', 'Ryan Brooks', 'Ryan Brooks'],
  Emma: ['إيما', 'एमा', 'ایما', 'Emma', 'Emma', 'Emma'],
  Sofia: ['صوفيا', 'सोफ़िया', 'صوفیہ', 'Sofía', 'Sofia', 'Sofia'],
  Chloe: ['كلوي', 'क्लोई', 'کلوئی', 'Chloe', 'Chloé', 'Chloe'],
  Maya: ['مايا', 'माया', 'مایا', 'Maya', 'Maya', 'Maya'],
  'Olivia Bennett': ['أوليفيا بينيت', 'ओलिविया बेनेट', 'اولیویا بینیٹ', 'Olivia Bennett', 'Olivia Bennett', 'Olivia Bennett'],
  'Grace Miller': ['غريس ميلر', 'ग्रेस मिलर', 'گریس ملر', 'Grace Miller', 'Grace Miller', 'Grace Miller'],
  'Ava Thompson': ['آفا طومسون', 'एवा थॉम्पसन', 'ایوا تھامسن', 'Ava Thompson', 'Ava Thompson', 'Ava Thompson'],
  Lucas: ['لوكاس', 'लुकास', 'لوکاس', 'Lucas', 'Lucas', 'Lucas'],
  Mia: ['ميا', 'मिया', 'میا', 'Mía', 'Mia', 'Mia'],
  Hannah: ['هانا', 'हन्ना', 'ہانا', 'Hannah', 'Hannah', 'Hannah'],
  Zoe: ['زوي', 'ज़ोई', 'زوئی', 'Zoe', 'Zoé', 'Zoe'],
};

const ORDER: Lang[] = ['ar', 'hi', 'ur', 'es', 'fr', 'pt'];
/** `english` in `lang` (unchanged when the table has no entry). */
export function inLang(table: Names, english: string, lang: Lang): string {
  const row = table[english];
  return lang === 'en' || !row ? english : row[ORDER.indexOf(lang)]!;
}

/** A visit on a salon's queue: a walk-in waiting `wait` minutes, one in the chair for `started` minutes, or a
 *  booking `in` minutes from now. No name = the app's own "Guest". */
export interface Visit {
  name?: string;
  services: string[];
  staff?: string;
  room?: boolean;
  wait?: number;
  started?: number;
  in?: number;
}

export interface Salon {
  mode: 'gents' | 'ladies' | 'unisex' | 'wellness';
  business: string;
  branch: string;
  address: string;
  phone: string;
  owner: string;
  staff: string[];
  visits: Visit[];
  /** Service prices in the salon's currency (minor units); others keep the starter price. */
  prices?: Record<string, number>;
}

export interface CurrencySet {
  country: { country_code: string; currency: string; tax_name: string; tax_rate_bps: number; tax_inclusive?: boolean; tax_id_label?: string };
  salons: Record<'gents' | 'ladies' | 'unisex' | 'wellness', Salon>;
  /** The ladies salon's day (minor units): money in the drawer at the start, today's two sales, yesterday's, a cost
   *  paid from the till, a staff advance and a tip. */
  day: { opening: number; sales: [string, 'cash' | 'card'][]; yesterday: number; expense: number; advance: number; tip: number };
  /** The barber shop's month for the report: sales, and costs by category. */
  month: { sales: number; prices: number[]; costs: [string, number][] };
}

export const SETS: Record<Cur, CurrencySet> = {
  aed: {
    country: { country_code: 'AE', currency: 'AED', tax_name: 'VAT', tax_rate_bps: 500, tax_inclusive: true, tax_id_label: 'TRN' },
    salons: {
      gents: {
        mode: 'gents', business: 'Al Barsha Gents', branch: 'Al Barsha', address: 'Al Barsha 1, Dubai', phone: '+971 4 555 0123', owner: 'Imran',
        staff: ['Imran', 'Rafiq', 'Sameer'],
        visits: [
          { name: 'Ahmed Khan', services: ['Haircut', 'Beard Trim'], staff: 'Rafiq', wait: 4 },
          { services: ['Shave'], wait: 2 },
          { name: 'Yousef Ali', services: ['Haircut'], staff: 'Sameer', started: 12 },
          { name: 'Omar Saeed', services: ['Haircut', 'Head Massage'], staff: 'Imran', in: 40 },
        ],
      },
      ladies: {
        mode: 'ladies', business: 'Jumeirah Ladies Salon & Spa', branch: 'Jumeirah', address: 'Jumeirah Beach Road, Dubai', phone: '+971 4 555 0188', owner: 'Mariam',
        staff: ['Aisha', 'Leila', 'Priya'],
        visits: [
          { services: ['Threading'], wait: 3 },
          { name: 'Fatima Al Mansoori', services: ['Moroccan Bath'], staff: 'Leila', room: true, started: 18 },
          { name: 'Sara Ahmed', services: ['Blow-dry'], staff: 'Aisha', in: 35 },
          { name: 'Noor Hassan', services: ['Gel Nails'], staff: 'Priya', in: 80 },
        ],
      },
      unisex: {
        mode: 'unisex', business: 'Marina Cuts', branch: 'Dubai Marina', address: 'Dubai Marina, Dubai', phone: '+971 4 555 0145', owner: 'Omar',
        staff: [],
        visits: [
          { name: 'Omar', services: ["Men's Haircut"], wait: 6 },
          { name: 'Sara', services: ['Blow-dry'], wait: 3 },
          { services: ['Beard Trim'], wait: 1 },
        ],
      },
      wellness: {
        mode: 'wellness', business: 'Calm Studio', branch: 'Marina', address: 'Dubai Marina, Dubai', phone: '+971 4 555 0167', owner: 'Layla',
        staff: [],
        visits: [
          { name: 'Layla', services: ['Manicure'], wait: 5 },
          { name: 'Nadia', services: ['Lash Lift'], wait: 2 },
          { services: ['Pedicure'], wait: 1 },
        ],
      },
    },
    day: { opening: 250_000, sales: [['Blow-dry', 'cash'], ['Gel Nails', 'card']], yesterday: 18_000, expense: 1_500, advance: 30_000, tip: 2_000 },
    month: {
      sales: 4_825_000,
      prices: [3_500, 4_500, 5_500, 6_000, 8_000, 9_500, 12_000, 15_000],
      costs: [
        ['rent', 1_500_000], ['staff_accommodation', 600_000], ['licences', 240_000], ['electricity', 145_000], ['marketing', 120_000],
        ['staff_welfare', 120_000], ['cleaning', 90_000], ['transport', 80_000], ['tea_food', 62_000], ['repairs', 60_000],
        ['internet_phone', 45_000], ['uniforms', 40_000], ['water', 38_000],
      ],
    },
  },
  usd: {
    country: { country_code: 'US', currency: 'USD', tax_name: 'Sales tax', tax_rate_bps: 0, tax_inclusive: false, tax_id_label: 'Tax ID' },
    salons: {
      gents: {
        mode: 'gents', business: 'Northside Barbers', branch: 'Main Street', address: '214 Main Street', phone: '+1 555 0142', owner: 'Marcus',
        staff: ['Marcus', 'Leo', 'Andre'],
        prices: { Haircut: 3_200, Shave: 3_000, 'Beard Trim': 1_800, 'Beard Color': 2_500, 'Hair Color': 5_500, Facial: 4_000, 'Head Massage': 2_500 },
        visits: [
          { name: 'James Carter', services: ['Haircut', 'Beard Trim'], staff: 'Leo', wait: 4 },
          { services: ['Shave'], wait: 2 },
          { name: 'Daniel Kim', services: ['Haircut'], staff: 'Andre', started: 12 },
          { name: 'Ryan Brooks', services: ['Haircut', 'Head Massage'], staff: 'Marcus', in: 40 },
        ],
      },
      ladies: {
        mode: 'ladies', business: 'Willow Hair & Spa', branch: 'Downtown', address: '58 Willow Avenue', phone: '+1 555 0177', owner: 'Emma',
        staff: ['Sofia', 'Chloe', 'Maya'],
        prices: {
          'Hair Styling': 7_500, 'Blow-dry': 5_000, 'Hair Color': 14_000, Manicure: 3_500, Pedicure: 5_000, 'Gel Nails': 5_500, 'Facial & Eye': 9_000,
          Threading: 1_800, Waxing: 4_000, 'Bridal Makeup': 35_000, 'Moroccan Bath': 12_000, 'Swedish Massage': 11_000,
        },
        visits: [
          { services: ['Threading'], wait: 3 },
          { name: 'Olivia Bennett', services: ['Swedish Massage'], staff: 'Chloe', room: true, started: 18 },
          { name: 'Grace Miller', services: ['Blow-dry'], staff: 'Sofia', in: 35 },
          { name: 'Ava Thompson', services: ['Gel Nails'], staff: 'Maya', in: 80 },
        ],
      },
      unisex: {
        mode: 'unisex', business: 'Studio Nine', branch: 'Studio Nine', address: '9 Harbor Lane', phone: '+1 555 0119', owner: 'Lucas',
        staff: [],
        prices: { "Men's Haircut": 3_500, "Women's Haircut": 6_500, 'Blow-dry': 4_500, 'Hair Color': 9_500, 'Beard Trim': 2_000, Manicure: 3_000, Facial: 7_500 },
        visits: [
          { name: 'Lucas', services: ["Men's Haircut"], wait: 6 },
          { name: 'Mia', services: ['Blow-dry'], wait: 3 },
          { services: ['Beard Trim'], wait: 1 },
        ],
      },
      wellness: {
        mode: 'wellness', business: 'Juniper Wellness Studio', branch: 'Juniper', address: '120 Juniper Road', phone: '+1 555 0163', owner: 'Hannah',
        staff: [],
        prices: {
          Manicure: 3_500, Pedicure: 5_000, 'Gel Nails': 5_500, 'Lash Lift': 8_500, 'Brow Shaping & Tint': 4_500, 'Classic Facial': 9_500,
          'Swedish Massage': 11_000, 'Deep Tissue Massage': 13_000, Waxing: 4_000,
        },
        visits: [
          { name: 'Hannah', services: ['Manicure'], wait: 5 },
          { name: 'Zoe', services: ['Lash Lift'], wait: 2 },
          { services: ['Pedicure'], wait: 1 },
        ],
      },
    },
    day: { opening: 40_000, sales: [['Blow-dry', 'cash'], ['Gel Nails', 'card']], yesterday: 9_000, expense: 1_200, advance: 10_000, tip: 1_000 },
    month: {
      sales: 2_148_000,
      prices: [1_800, 2_500, 3_000, 3_200, 4_000, 5_000, 5_500, 6_500],
      costs: [
        ['rent', 450_000], ['electricity', 62_000], ['marketing', 85_000], ['licences', 30_000], ['cleaning', 40_000],
        ['repairs', 35_000], ['internet_phone', 18_000], ['uniforms', 15_000], ['water', 12_000], ['tea_food', 20_000],
      ],
    },
  },
};

/**
 * A time zone where it is mid-afternoon now, so the pictures show a salon at work (the zone is not shown anywhere;
 * the country, currency and words stay the set's own). Re-run early in a month and the report has few days.
 */
export function afternoonZone(now = new Date()): string {
  const zones = [
    'Pacific/Kiritimati', 'Pacific/Auckland', 'Pacific/Fiji', 'Australia/Sydney', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Bangkok',
    'Asia/Dhaka', 'Asia/Karachi', 'Asia/Dubai', 'Europe/Moscow', 'Europe/Athens', 'Europe/Paris', 'Europe/London', 'Atlantic/Azores',
    'America/Noronha', 'America/Sao_Paulo', 'America/Halifax', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  ];
  const hour = (zone: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return zones.reduce((best, z) => (Math.abs(hour(z) - 16) < Math.abs(hour(best) - 16) ? z : best));
}

/** Today in `zone` (yyyy-mm-dd), `days` from now. */
export function dateIn(zone: string, days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(Date.now() + days * 86_400_000));
}
