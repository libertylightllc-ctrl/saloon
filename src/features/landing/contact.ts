/**
 * Where "Contact us" goes (website brief 1.7): WhatsApp with a ready message when the owner has set a number
 * (src/config/site.ts); otherwise the built-in support chat (it answers common questions at once and keeps the
 * conversation), with the email address as its own mailto: link.
 */
import { site } from '@/config/site';

export const hasWhatsApp = site.whatsappNumber.replace(/\D/g, '').length >= 8;

export function whatsappUrl(text: string = site.whatsappDefaultText): string {
  return `https://wa.me/${site.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export const mailtoUrl = `mailto:${site.supportEmail}`;

/** "Made in …": the config's place, in the reader's language when it is the usual one. */
export function madeInPlace(t: (key: 'auth.landing.place.dubai') => string): string {
  return site.madeIn === 'Dubai, UAE' ? t('auth.landing.place.dubai') : site.madeIn;
}

/** "Contact us": WhatsApp, else the support chat. */
export const contactHref: { href: string; external: boolean } = hasWhatsApp
  ? { href: whatsappUrl(), external: true }
  : { href: '/contact', external: false };

/** "Book a demo" (website brief 2.5): the owner's calendar link, else WhatsApp with a ready message; none without either. */
export const demoHref: { href: string; external: boolean } | null = site.demoBookingUrl
  ? { href: site.demoBookingUrl, external: true }
  : hasWhatsApp
    ? { href: whatsappUrl("Hi, I'd like a quick demo of Saloqo for my salon."), external: true }
    : null;
