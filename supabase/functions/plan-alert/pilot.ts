// The email for a new pilot application (owner's fix list A2): "New pilot application: <salon> (<emirate>)", every field
// of the website's form in words, when it came in (Dubai time) and a link straight to Console → Pilot. No imports, so
// the app's tests can check it too (pilot.test.ts).

export interface PilotAlert {
  id: string;
  name: string;
  salon_name: string;
  emirate: string;
  area: string | null;
  salon_type: string;
  staff_count: number;
  whatsapp: string;
  language: string;
  whatsapp_ok: boolean;
  created_at: string;
  admin_emails: string[] | null;
}

const SITE = 'https://www.saloqo.com';

/** The form's values in words (the same as the console's English). */
const EMIRATES: Record<string, string> = {
  abu_dhabi: 'Abu Dhabi',
  dubai: 'Dubai',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  umm_al_quwain: 'Umm Al Quwain',
  ras_al_khaimah: 'Ras Al Khaimah',
  fujairah: 'Fujairah',
};
const TYPES: Record<string, string> = {
  barber: 'Barber shop',
  ladies: 'Ladies salon',
  unisex: 'Unisex salon',
  spa: 'Spa',
  beauty: 'Nail and beauty studio',
};
const LANGUAGES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  hi: 'Hindi',
  ur: 'Urdu',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
};

/** "31 Oct 2026, 14:05" in Dubai. */
const received = (at: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(at));

export function pilotMessage(a: PilotAlert): { subject: string; text: string } {
  const emirate = EMIRATES[a.emirate] ?? a.emirate;
  return {
    subject: `New pilot application: ${a.salon_name} (${emirate})`,
    text: [
      'A salon applied for the Saloqo pilot.',
      '',
      `Salon: ${a.salon_name}`,
      `Owner: ${a.name}`,
      `Emirate: ${emirate}`,
      `Area: ${a.area?.trim() || 'not given'}`,
      `Type: ${TYPES[a.salon_type] ?? a.salon_type}`,
      `Staff: ${a.staff_count}`,
      `WhatsApp: ${a.whatsapp} (chat: https://wa.me/${a.whatsapp.replace(/\D/g, '')})`,
      `OK to message on WhatsApp: ${a.whatsapp_ok ? 'yes' : 'no'}`,
      `Language: ${LANGUAGES[a.language] ?? a.language}`,
      `Received: ${received(a.created_at)} (Dubai time)`,
      '',
      `Approve or decline it: ${SITE}/admin?tab=pilot`,
    ].join('\n'),
  };
}
