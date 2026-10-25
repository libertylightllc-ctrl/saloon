/**
 * Values only the owner has (website brief, 22 Oct 2026), kept in site.json (the website's build reads it too). Every
 * element that uses one is hidden while it is empty: no invented numbers, testimonials or logos — real ones only.
 *
 * - whatsappNumber: international format, digits only, e.g. "9715XXXXXXXX"
 * - demoBookingUrl: optional calendar link; if empty, "Book a demo" opens WhatsApp (or nothing without a number)
 * - demoVideoUrl: YouTube, Vimeo or MP4; the video section is hidden while empty
 * - operatorName: who is responsible for Saloqo, named in "Who we are" of the privacy policy (full update, Phase 5);
 *   while empty the policy names the app only. Never a company form, licence or tax number (the owner's rule).
 * - stats: e.g. { "value": "120+", "label": "salons" } — real numbers only
 * - testimonials: real customers only
 */
import { brand } from './brand';
import values from './site.json';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  salon: string;
  city: string;
  photoUrl?: string;
}

export const site = {
  ...values,
  supportEmail: brand.supportEmail,
  stats: values.stats as { value: string; label: string }[],
  testimonials: values.testimonials as Testimonial[],
};
