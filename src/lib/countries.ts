/**
 * Countries a salon can be set up in, with sensible defaults the owner can change in Branch settings: currency,
 * time zone (the first is the default; several for countries that span zones), the sales tax (name, standard rate,
 * whether shop prices include it, what the tax number is called) and the phone prefix. Rates are each country's
 * standard rate at the time of writing; reduced rates for salon services exist in some countries, so the owner
 * confirms the rate at setup. Any other country: pick "Other" and enter currency, time zone and tax yourself.
 */
import type { CurrencyCode } from './currencies';

export interface TaxDefaults {
  /** What people call it: VAT, GST, Sales tax… (free text later). */
  name: string;
  /** Standard rate in basis points (5% = 500); 0 where there is none. */
  rateBps: number;
  /** Shop prices include the tax (most of the world) or it is added at the till (US, Canada, Malaysia). */
  inclusive: boolean;
  /** What the tax registration number is called. */
  idLabel: string;
}

export interface Country {
  code: string;
  name: string;
  currency: CurrencyCode;
  timezones: readonly string[];
  tax: TaxDefaults;
  dial: string;
}

const vat = (rateBps: number, idLabel = 'VAT number'): TaxDefaults => ({ name: 'VAT', rateBps, inclusive: true, idLabel });
const gst = (rateBps: number, idLabel = 'GST number'): TaxDefaults => ({ name: 'GST', rateBps, inclusive: true, idLabel });
const none = (name = 'VAT'): TaxDefaults => ({ name, rateBps: 0, inclusive: true, idLabel: 'Tax number' });

export const COUNTRIES: readonly Country[] = [
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timezones: ['Asia/Dubai'], tax: vat(500, 'TRN'), dial: '+971' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', timezones: ['Asia/Riyadh'], tax: vat(1500, 'VAT number'), dial: '+966' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', timezones: ['Asia/Qatar'], tax: none(), dial: '+974' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', timezones: ['Asia/Kuwait'], tax: none(), dial: '+965' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', timezones: ['Asia/Bahrain'], tax: vat(1000, 'VAT account number'), dial: '+973' },
  { code: 'OM', name: 'Oman', currency: 'OMR', timezones: ['Asia/Muscat'], tax: vat(500, 'VAT number'), dial: '+968' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', timezones: ['Africa/Cairo'], tax: vat(1400, 'Tax number'), dial: '+20' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', timezones: ['Asia/Amman'], tax: { name: 'Sales tax', rateBps: 1600, inclusive: true, idLabel: 'Tax number' }, dial: '+962' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', timezones: ['Africa/Casablanca'], tax: vat(2000, 'ICE / IF number'), dial: '+212' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', timezones: ['Africa/Tunis'], tax: vat(1900, 'Tax ID'), dial: '+216' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', timezones: ['Europe/Istanbul'], tax: vat(2000, 'Tax number'), dial: '+90' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', timezones: ['Africa/Johannesburg'], tax: vat(1500, 'VAT number'), dial: '+27' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', timezones: ['Africa/Lagos'], tax: vat(750, 'TIN'), dial: '+234' },
  { code: 'KE', name: 'Kenya', currency: 'KES', timezones: ['Africa/Nairobi'], tax: vat(1600, 'KRA PIN'), dial: '+254' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', timezones: ['Africa/Accra'], tax: vat(1500, 'TIN'), dial: '+233' },
  { code: 'IN', name: 'India', currency: 'INR', timezones: ['Asia/Kolkata'], tax: gst(1800, 'GSTIN'), dial: '+91' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', timezones: ['Asia/Karachi'], tax: { name: 'Sales tax', rateBps: 1600, inclusive: true, idLabel: 'NTN' }, dial: '+92' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', timezones: ['Asia/Dhaka'], tax: vat(1500, 'BIN'), dial: '+880' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', timezones: ['Asia/Colombo'], tax: vat(1800, 'VAT number'), dial: '+94' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', timezones: ['Asia/Kathmandu'], tax: vat(1300, 'PAN'), dial: '+977' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', timezones: ['Asia/Singapore'], tax: gst(900, 'GST reg. no.'), dial: '+65' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', timezones: ['Asia/Kuala_Lumpur'], tax: { name: 'Service tax', rateBps: 800, inclusive: false, idLabel: 'SST number' }, dial: '+60' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', timezones: ['Asia/Manila'], tax: vat(1200, 'TIN'), dial: '+63' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'], tax: vat(1100, 'NPWP'), dial: '+62' },
  { code: 'TH', name: 'Thailand', currency: 'THB', timezones: ['Asia/Bangkok'], tax: vat(700, 'Tax ID'), dial: '+66' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', timezones: ['Asia/Ho_Chi_Minh'], tax: vat(1000, 'Tax code'), dial: '+84' },
  { code: 'JP', name: 'Japan', currency: 'JPY', timezones: ['Asia/Tokyo'], tax: { name: 'Consumption tax', rateBps: 1000, inclusive: true, idLabel: 'Registration number' }, dial: '+81' },
  { code: 'AU', name: 'Australia', currency: 'AUD', timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin', 'Australia/Hobart'], tax: gst(1000, 'ABN'), dial: '+61' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', timezones: ['Pacific/Auckland'], tax: gst(1500, 'GST number'), dial: '+64' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', timezones: ['Europe/London'], tax: vat(2000), dial: '+44' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', timezones: ['Europe/Dublin'], tax: vat(2300), dial: '+353' },
  { code: 'DE', name: 'Germany', currency: 'EUR', timezones: ['Europe/Berlin'], tax: vat(1900, 'USt-IdNr.'), dial: '+49' },
  { code: 'FR', name: 'France', currency: 'EUR', timezones: ['Europe/Paris'], tax: { name: 'TVA', rateBps: 2000, inclusive: true, idLabel: 'N° TVA' }, dial: '+33' },
  { code: 'ES', name: 'Spain', currency: 'EUR', timezones: ['Europe/Madrid', 'Atlantic/Canary'], tax: { name: 'IVA', rateBps: 2100, inclusive: true, idLabel: 'NIF' }, dial: '+34' },
  { code: 'IT', name: 'Italy', currency: 'EUR', timezones: ['Europe/Rome'], tax: { name: 'IVA', rateBps: 2200, inclusive: true, idLabel: 'Partita IVA' }, dial: '+39' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', timezones: ['Europe/Amsterdam'], tax: { name: 'BTW', rateBps: 2100, inclusive: true, idLabel: 'BTW-id' }, dial: '+31' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', timezones: ['Europe/Brussels'], tax: vat(2100), dial: '+32' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', timezones: ['Europe/Lisbon'], tax: { name: 'IVA', rateBps: 2300, inclusive: true, idLabel: 'NIF' }, dial: '+351' },
  { code: 'AT', name: 'Austria', currency: 'EUR', timezones: ['Europe/Vienna'], tax: vat(2000, 'UID'), dial: '+43' },
  { code: 'GR', name: 'Greece', currency: 'EUR', timezones: ['Europe/Athens'], tax: vat(2400, 'AFM'), dial: '+30' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', timezones: ['Europe/Zurich'], tax: vat(810, 'UID / MWST'), dial: '+41' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', timezones: ['Europe/Stockholm'], tax: { name: 'Moms', rateBps: 2500, inclusive: true, idLabel: 'Momsreg.nr' }, dial: '+46' },
  { code: 'NO', name: 'Norway', currency: 'NOK', timezones: ['Europe/Oslo'], tax: { name: 'MVA', rateBps: 2500, inclusive: true, idLabel: 'Org.nr' }, dial: '+47' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', timezones: ['Europe/Copenhagen'], tax: { name: 'Moms', rateBps: 2500, inclusive: true, idLabel: 'CVR' }, dial: '+45' },
  { code: 'PL', name: 'Poland', currency: 'PLN', timezones: ['Europe/Warsaw'], tax: { name: 'VAT', rateBps: 2300, inclusive: true, idLabel: 'NIP' }, dial: '+48' },
  { code: 'US', name: 'United States', currency: 'USD', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'], tax: { name: 'Sales tax', rateBps: 0, inclusive: false, idLabel: 'Tax ID' }, dial: '+1' },
  { code: 'CA', name: 'Canada', currency: 'CAD', timezones: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns'], tax: { name: 'GST/HST', rateBps: 500, inclusive: false, idLabel: 'GST/HST number' }, dial: '+1' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', timezones: ['America/Mexico_City', 'America/Tijuana', 'America/Cancun'], tax: { name: 'IVA', rateBps: 1600, inclusive: true, idLabel: 'RFC' }, dial: '+52' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', timezones: ['America/Sao_Paulo', 'America/Manaus'], tax: none('Tax'), dial: '+55' },
  { code: 'CO', name: 'Colombia', currency: 'COP', timezones: ['America/Bogota'], tax: { name: 'IVA', rateBps: 1900, inclusive: true, idLabel: 'NIT' }, dial: '+57' },
  { code: 'CL', name: 'Chile', currency: 'CLP', timezones: ['America/Santiago'], tax: { name: 'IVA', rateBps: 1900, inclusive: true, idLabel: 'RUT' }, dial: '+56' },
  // ── Added 2026-10-05 for Europe, the Caucasus and Central Asia, the rest of the Middle East and the Americas ──
  { code: 'FI', name: 'Finland', currency: 'EUR', timezones: ['Europe/Helsinki'], tax: { name: 'ALV', rateBps: 2550, inclusive: true, idLabel: 'Y-tunnus' }, dial: '+358' },
  { code: 'EE', name: 'Estonia', currency: 'EUR', timezones: ['Europe/Tallinn'], tax: { name: 'KM', rateBps: 2400, inclusive: true, idLabel: 'KMKR' }, dial: '+372' },
  { code: 'LV', name: 'Latvia', currency: 'EUR', timezones: ['Europe/Riga'], tax: { name: 'PVN', rateBps: 2100, inclusive: true, idLabel: 'PVN number' }, dial: '+371' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR', timezones: ['Europe/Vilnius'], tax: { name: 'PVM', rateBps: 2100, inclusive: true, idLabel: 'PVM code' }, dial: '+370' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', timezones: ['Europe/Luxembourg'], tax: { name: 'TVA', rateBps: 1700, inclusive: true, idLabel: 'TVA number' }, dial: '+352' },
  { code: 'MT', name: 'Malta', currency: 'EUR', timezones: ['Europe/Malta'], tax: vat(1800), dial: '+356' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR', timezones: ['Asia/Nicosia'], tax: vat(1900), dial: '+357' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR', timezones: ['Europe/Bratislava'], tax: { name: 'DPH', rateBps: 2300, inclusive: true, idLabel: 'IČ DPH' }, dial: '+421' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR', timezones: ['Europe/Ljubljana'], tax: { name: 'DDV', rateBps: 2200, inclusive: true, idLabel: 'ID za DDV' }, dial: '+386' },
  { code: 'HR', name: 'Croatia', currency: 'EUR', timezones: ['Europe/Zagreb'], tax: { name: 'PDV', rateBps: 2500, inclusive: true, idLabel: 'OIB' }, dial: '+385' },
  { code: 'BG', name: 'Bulgaria', currency: 'EUR', timezones: ['Europe/Sofia'], tax: vat(2000), dial: '+359' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK', timezones: ['Europe/Prague'], tax: { name: 'DPH', rateBps: 2100, inclusive: true, idLabel: 'DIČ' }, dial: '+420' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', timezones: ['Europe/Budapest'], tax: { name: 'ÁFA', rateBps: 2700, inclusive: true, idLabel: 'Adószám' }, dial: '+36' },
  { code: 'RO', name: 'Romania', currency: 'RON', timezones: ['Europe/Bucharest'], tax: { name: 'TVA', rateBps: 2100, inclusive: true, idLabel: 'CIF' }, dial: '+40' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', timezones: ['Atlantic/Reykjavik'], tax: { name: 'VSK', rateBps: 2400, inclusive: true, idLabel: 'VSK number' }, dial: '+354' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', timezones: ['Europe/Kyiv'], tax: vat(2000, 'IPN'), dial: '+380' },
  { code: 'RS', name: 'Serbia', currency: 'RSD', timezones: ['Europe/Belgrade'], tax: { name: 'PDV', rateBps: 2000, inclusive: true, idLabel: 'PIB' }, dial: '+381' },
  { code: 'AL', name: 'Albania', currency: 'ALL', timezones: ['Europe/Tirane'], tax: { name: 'TVSH', rateBps: 2000, inclusive: true, idLabel: 'NIPT' }, dial: '+355' },
  { code: 'MK', name: 'North Macedonia', currency: 'MKD', timezones: ['Europe/Skopje'], tax: vat(1800, 'EDB'), dial: '+389' },
  { code: 'BA', name: 'Bosnia and Herzegovina', currency: 'BAM', timezones: ['Europe/Sarajevo'], tax: { name: 'PDV', rateBps: 1700, inclusive: true, idLabel: 'PDV number' }, dial: '+387' },
  { code: 'ME', name: 'Montenegro', currency: 'EUR', timezones: ['Europe/Podgorica'], tax: { name: 'PDV', rateBps: 2100, inclusive: true, idLabel: 'PIB' }, dial: '+382' },
  { code: 'MD', name: 'Moldova', currency: 'MDL', timezones: ['Europe/Chisinau'], tax: { name: 'TVA', rateBps: 2000, inclusive: true, idLabel: 'IDNO' }, dial: '+373' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', timezones: ['Asia/Tbilisi'], tax: vat(1800, 'Tax ID'), dial: '+995' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', timezones: ['Asia/Yerevan'], tax: vat(2000, 'TIN'), dial: '+374' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', timezones: ['Asia/Baku'], tax: { name: 'ƏDV', rateBps: 1800, inclusive: true, idLabel: 'VÖEN' }, dial: '+994' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', timezones: ['Asia/Almaty', 'Asia/Qostanay', 'Asia/Aqtobe', 'Asia/Aqtau', 'Asia/Atyrau', 'Asia/Oral', 'Asia/Qyzylorda'], tax: vat(1600, 'BIN / IIN'), dial: '+7' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', timezones: ['Asia/Tashkent', 'Asia/Samarkand'], tax: vat(1200, 'STIR'), dial: '+998' },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', timezones: ['Asia/Bishkek'], tax: vat(1200, 'INN'), dial: '+996' },
  { code: 'TJ', name: 'Tajikistan', currency: 'TJS', timezones: ['Asia/Dushanbe'], tax: vat(1400, 'INN'), dial: '+992' },
  { code: 'TM', name: 'Turkmenistan', currency: 'TMT', timezones: ['Asia/Ashgabat'], tax: vat(1500, 'INN'), dial: '+993' },
  { code: 'MN', name: 'Mongolia', currency: 'MNT', timezones: ['Asia/Ulaanbaatar', 'Asia/Hovd'], tax: vat(1000, 'TIN'), dial: '+976' },
  { code: 'RU', name: 'Russia', currency: 'RUB', timezones: ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'], tax: vat(2200, 'INN'), dial: '+7' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD', timezones: ['Asia/Baghdad'], tax: none('Sales tax'), dial: '+964' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', timezones: ['Asia/Beirut'], tax: vat(1100, 'VAT number'), dial: '+961' },
  { code: 'IL', name: 'Israel', currency: 'ILS', timezones: ['Asia/Jerusalem'], tax: vat(1800, 'VAT number'), dial: '+972' },
  { code: 'PS', name: 'Palestine', currency: 'ILS', timezones: ['Asia/Hebron', 'Asia/Gaza'], tax: vat(1600, 'Tax number'), dial: '+970' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', timezones: ['Africa/Algiers'], tax: { name: 'TVA', rateBps: 1900, inclusive: true, idLabel: 'NIF' }, dial: '+213' },
  { code: 'LY', name: 'Libya', currency: 'LYD', timezones: ['Africa/Tripoli'], tax: none('Tax'), dial: '+218' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', timezones: ['America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza'], tax: { name: 'IVA', rateBps: 2100, inclusive: true, idLabel: 'CUIT' }, dial: '+54' },
  { code: 'PE', name: 'Peru', currency: 'PEN', timezones: ['America/Lima'], tax: { name: 'IGV', rateBps: 1800, inclusive: true, idLabel: 'RUC' }, dial: '+51' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', timezones: ['America/Guayaquil', 'Pacific/Galapagos'], tax: { name: 'IVA', rateBps: 1500, inclusive: true, idLabel: 'RUC' }, dial: '+593' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', timezones: ['America/Montevideo'], tax: { name: 'IVA', rateBps: 2200, inclusive: true, idLabel: 'RUT' }, dial: '+598' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', timezones: ['America/Asuncion'], tax: { name: 'IVA', rateBps: 1000, inclusive: true, idLabel: 'RUC' }, dial: '+595' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', timezones: ['America/La_Paz'], tax: { name: 'IVA', rateBps: 1300, inclusive: true, idLabel: 'NIT' }, dial: '+591' },
  // Venezuelan salons mostly price in dollars; the owner can switch to bolívares.
  { code: 'VE', name: 'Venezuela', currency: 'USD', timezones: ['America/Caracas'], tax: { name: 'IVA', rateBps: 1600, inclusive: true, idLabel: 'RIF' }, dial: '+58' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', timezones: ['America/Costa_Rica'], tax: { name: 'IVA', rateBps: 1300, inclusive: true, idLabel: 'Cédula jurídica' }, dial: '+506' },
  { code: 'PA', name: 'Panama', currency: 'USD', timezones: ['America/Panama'], tax: { name: 'ITBMS', rateBps: 700, inclusive: true, idLabel: 'RUC' }, dial: '+507' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', timezones: ['America/Guatemala'], tax: { name: 'IVA', rateBps: 1200, inclusive: true, idLabel: 'NIT' }, dial: '+502' },
  { code: 'HN', name: 'Honduras', currency: 'HNL', timezones: ['America/Tegucigalpa'], tax: { name: 'ISV', rateBps: 1500, inclusive: true, idLabel: 'RTN' }, dial: '+504' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', timezones: ['America/El_Salvador'], tax: { name: 'IVA', rateBps: 1300, inclusive: true, idLabel: 'NIT' }, dial: '+503' },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', timezones: ['America/Managua'], tax: { name: 'IVA', rateBps: 1500, inclusive: true, idLabel: 'RUC' }, dial: '+505' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', timezones: ['America/Santo_Domingo'], tax: { name: 'ITBIS', rateBps: 1800, inclusive: true, idLabel: 'RNC' }, dial: '+1' },
  { code: 'PR', name: 'Puerto Rico', currency: 'USD', timezones: ['America/Puerto_Rico'], tax: { name: 'IVU', rateBps: 1150, inclusive: false, idLabel: 'Merchant number' }, dial: '+1' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', timezones: ['America/Jamaica'], tax: { name: 'GCT', rateBps: 1500, inclusive: true, idLabel: 'TRN' }, dial: '+1' },
  { code: 'TT', name: 'Trinidad and Tobago', currency: 'TTD', timezones: ['America/Port_of_Spain'], tax: vat(1250, 'BIR number'), dial: '+1' },
  { code: 'BS', name: 'Bahamas', currency: 'BSD', timezones: ['America/Nassau'], tax: vat(1000, 'TIN'), dial: '+1' },
  { code: 'BB', name: 'Barbados', currency: 'BBD', timezones: ['America/Barbados'], tax: vat(1750, 'VAT number'), dial: '+1' },
  { code: 'BZ', name: 'Belize', currency: 'BZD', timezones: ['America/Belize'], tax: gst(1250, 'TIN'), dial: '+501' },
];

export const DEFAULT_COUNTRY = 'AE';

export function countryOf(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** The country's name in the app language when the platform knows it, else the English name. */
export function countryName(code: string, language: string): string {
  try {
    const names = new Intl.DisplayNames([language], { type: 'region' });
    return names.of(code) ?? countryOf(code)?.name ?? code;
  } catch {
    return countryOf(code)?.name ?? code;
  }
}

/** Features that only exist in the UAE: WPS salary transfers and Montaji cosmetic product registration. */
export const isUae = (code: string | null | undefined) => (code ?? DEFAULT_COUNTRY) === 'AE';

/** "Other": a country not in the list; the owner enters currency, time zone and tax themselves. */
export const OTHER_COUNTRY = 'ZZ';

/** The phone country code as digits ("971"), or '' when unknown. */
export function dialCodeOf(code: string | null | undefined): string {
  return (countryOf(code ?? DEFAULT_COUNTRY)?.dial ?? '').replace(/\D/g, '');
}
