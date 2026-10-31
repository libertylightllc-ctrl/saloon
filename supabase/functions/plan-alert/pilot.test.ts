/**
 * The new pilot application email (owner's fix list A2): the brief's subject, every field of the form in words, when it
 * came in (Dubai time) and a link straight to Console → Pilot.
 */
import { pilotMessage, type PilotAlert } from './pilot';

const application: PilotAlert = {
  id: 'a1',
  name: 'Omar',
  salon_name: 'Fade Lab',
  emirate: 'ras_al_khaimah',
  area: 'Al Nakheel',
  salon_type: 'barber',
  staff_count: 4,
  whatsapp: '+971 50 123 4567',
  language: 'ar',
  whatsapp_ok: true,
  created_at: '2026-10-31T10:05:00Z',
  admin_emails: ['owner@example.com'],
};

it('names the salon and emirate in the subject and lists every field, the time and the link', () => {
  const { subject, text } = pilotMessage(application);
  expect(subject).toBe('New pilot application: Fade Lab (Ras Al Khaimah)');
  expect(text.split('\n')).toEqual([
    'A salon applied for the Saloqo pilot.',
    '',
    'Salon: Fade Lab',
    'Owner: Omar',
    'Emirate: Ras Al Khaimah',
    'Area: Al Nakheel',
    'Type: Barber shop',
    'Staff: 4',
    'WhatsApp: +971 50 123 4567 (chat: https://wa.me/971501234567)',
    'OK to message on WhatsApp: yes',
    'Language: Arabic',
    'Received: 31 Oct 2026, 14:05 (Dubai time)',
    '',
    'Approve or decline it: https://www.saloqo.com/admin?tab=pilot',
  ]);
});

it('says when the area was left empty or the WhatsApp box was not ticked', () => {
  const { text } = pilotMessage({ ...application, area: ' ', whatsapp_ok: false });
  expect(text).toContain('Area: not given');
  expect(text).toContain('OK to message on WhatsApp: no');
});
