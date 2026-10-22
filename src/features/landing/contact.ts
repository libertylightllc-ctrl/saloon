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

/** "Contact us": WhatsApp, else the support chat. */
export const contactHref: { href: string; external: boolean } = hasWhatsApp
  ? { href: whatsappUrl(), external: true }
  : { href: '/contact', external: false };
