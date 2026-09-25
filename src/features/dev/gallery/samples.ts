// Dev-only sample content for the component gallery (/dev/gallery, never shipped in production builds).
import { staffColours } from '@/theme';

export const gallerySamples = {
  owner: 'Tehseem',
  service: { name: 'Haircut', recipe: 'Neck strip 1', durationMin: 30 },
  customer: 'Ahmed Khan',
  staff: [
    { id: 's1', name: 'Rafiq', colour: staffColours[0] },
    { id: 's2', name: 'Sameer', colour: staffColours[1] },
    { id: 's3', name: 'Imran', colour: staffColours[2] },
    { id: 's4', name: 'Aisha', colour: staffColours[3] },
  ],
} as const;
