/**
 * Where "Contact us" goes (website brief 1.7): WhatsApp with a ready message when a platform owner has set a number
 * (Console → Settings → Contact, owner's fix list A4; anyone may read it); otherwise the built-in support chat (it
 * answers common questions at once and keeps the conversation), with the email address as its own mailto: link.
 */
import { useQuery } from '@tanstack/react-query';

import { site } from '@/config/site';
import { supabase } from '@/lib/supabase';

export interface ContactSetting {
  whatsapp_number: string;
  whatsapp_message: string;
}

/** The WhatsApp number and message from the settings (a change shows here within 10 minutes). */
export function useContactSetting() {
  return useQuery({
    queryKey: ['site-contact'],
    queryFn: async (): Promise<ContactSetting> => {
      const { data, error } = await supabase.rpc('site_contact');
      if (error) throw error;
      return data as unknown as ContactSetting;
    },
    staleTime: 10 * 60_000,
  });
}

export const waLink = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

type Href = { href: string; external: boolean };

/**
 * The links that use it: WhatsApp (with the setting's message unless another is given); "Contact us" (WhatsApp, else
 * the support chat); "Book a demo" (website brief 2.5: the owner's calendar link, else WhatsApp with a ready message;
 * none without either). While the setting loads, or with no number, everything WhatsApp stays hidden.
 */
export function useContact(): { hasWhatsApp: boolean; whatsappUrl: (text?: string) => string; contactHref: Href; demoHref: Href | null } {
  const setting = useContactSetting().data;
  const number = setting?.whatsapp_number ?? '';
  const hasWhatsApp = number.replace(/\D/g, '').length >= 8;
  const whatsappUrl = (text = setting?.whatsapp_message ?? '') => waLink(number, text);
  return {
    hasWhatsApp,
    whatsappUrl,
    contactHref: hasWhatsApp ? { href: whatsappUrl(), external: true } : { href: '/contact', external: false },
    demoHref: site.demoBookingUrl
      ? { href: site.demoBookingUrl, external: true }
      : hasWhatsApp
        ? { href: whatsappUrl("Hi, I'd like a quick demo of Saloqo for my salon."), external: true }
        : null,
  };
}

export const mailtoUrl = `mailto:${site.supportEmail}`;

/** "Made in …": the config's place, in the reader's language when it is the usual one. */
export function madeInPlace(t: (key: 'auth.landing.place.dubai') => string): string {
  return site.madeIn === 'Dubai, UAE' ? t('auth.landing.place.dubai') : site.madeIn;
}
