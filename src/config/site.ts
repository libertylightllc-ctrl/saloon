/**
 * Values only the owner has (website brief, 22 Oct 2026). Every element that uses one is hidden while it is empty:
 * no invented numbers, testimonials or logos — real ones only.
 */
import { brand } from './brand';

export const site = {
  /** International format, digits only, e.g. "9715XXXXXXXX". */
  whatsappNumber: '',
  whatsappDefaultText: "Hi Saloqo, I'd like to know more about the app for my salon.",
  /** Optional calendar link; if empty, "Book a demo" opens WhatsApp (or email). */
  demoBookingUrl: '',
  /** YouTube, Vimeo or MP4; the video section is hidden while empty. */
  demoVideoUrl: '',
  /** e.g. "Saloqo FZ-LLC". */
  legalName: '',
  /** Postal address. */
  legalAddress: '',
  supportEmail: brand.supportEmail,
  social: { instagram: '', tiktok: '', youtube: '', linkedin: '', facebook: '' },
  madeIn: 'Dubai, UAE',
  /** e.g. { value: "120+", label: "salons" } — real numbers only. */
  stats: [] as { value: string; label: string }[],
  /** Real customers only. */
  testimonials: [] as { quote: string; name: string; role: string; salon: string; city: string; photoUrl?: string }[],
};
