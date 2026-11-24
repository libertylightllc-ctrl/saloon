/**
 * B6 "Message owner" (owner's brief, Part B): the note to a salon owner whose free period or pilot ends soon, in the
 * language they use the app in (whatever language the console is in), with the salon's name and end date filled in.
 * WhatsApp only when the owner agreed to it (the server gives the number only then), otherwise email.
 */
import type { TFunction } from 'i18next';

import { brand } from '@/config/brand';
import { formatBusinessDate } from '@/lib/dates';
import { DEFAULT_LANGUAGE, i18n, isLanguage, LANGUAGES, loadLanguage, type Language } from '@/lib/i18n';

import type { EndingSalon } from './overviewApi';

export interface OwnerMessage {
  language: Language;
  subject: string;
  text: string;
}

export function ownerMessageText(s: EndingSalon, t: TFunction, language: Language): OwnerMessage {
  const vars = {
    salon: s.name,
    app: brand.appName,
    date: formatBusinessDate(s.ends_on, 'd MMMM yyyy', language),
    path: `${t('more.title')} → ${t('more.rows.plan')}`,
  };
  const hello = s.owner_name ? t('console.comingUp.message.hello', { name: s.owner_name }) : t('console.comingUp.message.helloNoName');
  return {
    language,
    subject: t(`console.comingUp.message.subject.${s.status}`, vars),
    text: [
      hello,
      t(`console.comingUp.message.${s.status}`, vars),
      t('console.comingUp.message.reply'),
      t('console.comingUp.message.signOff', { app: brand.appName }),
    ].join('\n\n'),
  };
}

/** Loads the owner's language first: the website has only the console's language until then. */
export async function ownerMessage(s: EndingSalon): Promise<OwnerMessage> {
  const language = isLanguage(s.language) ? s.language : DEFAULT_LANGUAGE;
  await loadLanguage(language);
  return ownerMessageText(s, i18n.getFixedT(language), language);
}

/** A language by its own name ("العربية"), so it reads the same in any console language. */
export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.nativeName ?? code;

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export const emailUrl = (to: string, subject: string, text: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
