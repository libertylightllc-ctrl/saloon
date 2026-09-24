/**
 * Static demo data so the look can be judged against the reference images (phase 1, no backend).
 * Mirrors the seed branches in 04-DATA-MODEL §9. Names and service names are data, not UI copy.
 */
import type { Minor } from '@/lib/money';
import type { Mode } from '@/theme';
import type { IconName, StatusKey } from '@/ui';

export interface DemoService {
  id: string;
  name: string;
  category: string;
  priceMinor: Minor;
  durationMin: number;
  recipe?: string;
  /** What checkout says it will deduct. */
  stock?: string;
}

export interface DemoStaff {
  id: string;
  name: string;
  colour: string;
  services: number;
  salesMinor: Minor;
  commissionMinor: Minor;
  state: 'on_shift' | 'with_client' | 'off';
}

export type QueueBadge = 'walk_in' | 'preferred' | 'patch_test' | 'second_no_show' | 'deposit';

export interface DemoQueueItem {
  id: string;
  customer: string | null;
  time: string;
  /** Minutes waiting (waiting) or until start (booked). */
  minutes?: number;
  services: string;
  priceMinor: Minor;
  staff: string | null;
  room?: string;
  status: Extract<StatusKey, 'waiting' | 'booked' | 'in_progress' | 'completed' | 'no_show'>;
  badges: QueueBadge[];
  visits?: number;
}

export interface DemoAttention {
  icon: IconName;
  title: string;
  detail: string;
  action: 'review' | 'renew' | 'order' | 'pay';
  tone: 'warning' | 'error';
}

export interface DemoBranch {
  branch: string;
  owner: string;
  /** VAT off = "Not applied" on the receipt; on = 5% inclusive. */
  vatOn: boolean;
  nextSaleNumber: number;
  services: DemoService[];
  staff: DemoStaff[];
  queue: DemoQueueItem[];
  kpis: {
    expectedCash: Minor;
    expectedDeltaPct: string;
    sales: Minor;
    servicesCount: number;
    salesCount: number;
    done: number;
    waiting: number;
    noShow: number;
    purchases: Minor;
    expenses: Minor;
  };
  attention: DemoAttention[];
  /** Last 7 days, oldest first. */
  revenue7d: Minor[];
  paymentMix: { cash: number; card: number; wallet: number; deposits: number };
  topServices: { name: string; revenueMinor: Minor; count: number }[];
  activity: { who: string; what: string; when: string }[];
}

const aed = (value: number): Minor => Math.round(value * 100);

const gents: DemoBranch = {
  branch: 'Al Barsha Gents',
  owner: 'Tehseem',
  vatOn: false,
  nextSaleNumber: 1043,
  services: [
    {
      id: 's1',
      name: 'Haircut',
      category: 'hair',
      priceMinor: aed(25),
      durationMin: 30,
      recipe: 'Neck strip 1',
      stock: 'Neck strips 1',
    },
    {
      id: 's2',
      name: 'Shave',
      category: 'beard',
      priceMinor: aed(15),
      durationMin: 15,
      recipe: 'Blade 1 · Foam 10 ml',
      stock: 'Blades 1, Shaving Foam 10 ml',
    },
    {
      id: 's3',
      name: 'Beard Trim',
      category: 'beard',
      priceMinor: aed(10),
      durationMin: 15,
      recipe: 'Neck strip 1',
      stock: 'Neck strips 1',
    },
    {
      id: 's4',
      name: 'Beard Color',
      category: 'color',
      priceMinor: aed(45),
      durationMin: 30,
      recipe: 'Beard Color 20 ml · Developer 20 ml',
      stock: 'Beard Color 20 ml, Developer 20 ml',
    },
    {
      id: 's5',
      name: 'Hair Color',
      category: 'color',
      priceMinor: aed(80),
      durationMin: 45,
      recipe: 'Hair Color 40 ml · Developer 40 ml',
      stock: 'Hair Color 40 ml, Developer 40 ml',
    },
    {
      id: 's6',
      name: 'Facial',
      category: 'face',
      priceMinor: aed(60),
      durationMin: 40,
      recipe: 'Tissues 4',
      stock: 'Tissues 4',
    },
    {
      id: 's7',
      name: 'Head Massage',
      category: 'massage',
      priceMinor: aed(35),
      durationMin: 20,
      recipe: 'Hair Oil 15 ml',
      stock: 'Hair Oil 15 ml',
    },
  ],
  staff: [
    {
      id: 'e1',
      name: 'Rafiq',
      colour: '#6C45F2',
      services: 9,
      salesMinor: aed(420),
      commissionMinor: aed(50.4),
      state: 'with_client',
    },
    {
      id: 'e2',
      name: 'Sameer',
      colour: '#F28A2E',
      services: 7,
      salesMinor: aed(380),
      commissionMinor: aed(45.6),
      state: 'on_shift',
    },
    {
      id: 'e3',
      name: 'Imran',
      colour: '#1E90D6',
      services: 5,
      salesMinor: aed(210),
      commissionMinor: aed(21),
      state: 'on_shift',
    },
  ],
  queue: [
    {
      id: 'q1',
      customer: 'Ahmed Khan',
      time: '10:52',
      minutes: 6,
      services: 'Haircut + Beard Trim',
      priceMinor: aed(35),
      staff: 'Rafiq',
      status: 'waiting',
      badges: ['walk_in', 'preferred'],
      visits: 14,
    },
    {
      id: 'q2',
      customer: null,
      time: '10:55',
      minutes: 3,
      services: 'Shave',
      priceMinor: aed(15),
      staff: null,
      status: 'waiting',
      badges: ['walk_in'],
    },
    {
      id: 'q3',
      customer: 'Omar Farooq',
      time: '10:40',
      services: 'Hair Color',
      priceMinor: aed(80),
      staff: 'Sameer',
      status: 'in_progress',
      badges: ['patch_test'],
      visits: 6,
    },
    {
      id: 'q4',
      customer: 'Bilal Ahmed',
      time: '11:30',
      minutes: 25,
      services: 'Haircut',
      priceMinor: aed(25),
      staff: 'Imran',
      status: 'booked',
      badges: [],
      visits: 12,
    },
    {
      id: 'q5',
      customer: 'Yousef Ali',
      time: '12:00',
      minutes: 55,
      services: 'Facial',
      priceMinor: aed(60),
      staff: null,
      status: 'booked',
      badges: ['second_no_show'],
      visits: 3,
    },
    {
      id: 'q6',
      customer: 'Hamza Qureshi',
      time: '09:30',
      services: 'Haircut',
      priceMinor: aed(25),
      staff: 'Rafiq',
      status: 'completed',
      badges: [],
      visits: 21,
    },
  ],
  kpis: {
    expectedCash: aed(1240),
    expectedDeltaPct: '12%',
    sales: aed(1860),
    servicesCount: 38,
    salesCount: 29,
    done: 12,
    waiting: 2,
    noShow: 1,
    purchases: aed(200),
    expenses: aed(110),
  },
  attention: [
    {
      icon: 'calculator',
      title: 'Cash closing · Mon 21 Sep',
      detail: 'Short by AED 5.00 · waiting for approval',
      action: 'review',
      tone: 'warning',
    },
    {
      icon: 'fileText',
      title: 'Pest control certificate',
      detail: 'Expires in 12 days',
      action: 'renew',
      tone: 'warning',
    },
    {
      icon: 'package',
      title: 'Beard Color',
      detail: '2 left · reorder at 5',
      action: 'order',
      tone: 'error',
    },
    {
      icon: 'truck',
      title: 'Gulf Beauty Supplies',
      detail: 'AED 640.00 due tomorrow',
      action: 'pay',
      tone: 'warning',
    },
  ],
  revenue7d: [aed(1420), aed(1610), aed(1380), aed(1950), aed(2240), aed(1720), aed(1860)],
  paymentMix: { cash: 58, card: 34, wallet: 8, deposits: 0 },
  topServices: [
    { name: 'Haircut', revenueMinor: aed(2150), count: 86 },
    { name: 'Beard Color', revenueMinor: aed(990), count: 22 },
    { name: 'Hair Color', revenueMinor: aed(880), count: 11 },
  ],
  activity: [
    { who: 'Faisal', what: 'saved sale #1042 · AED 70.00', when: '2 min ago' },
    { who: 'Sameer', what: 'started Omar Farooq · Hair Color', when: '10:40' },
    { who: 'Faisal', what: 'recorded expense Tea & Food · AED 25.00', when: '10:15' },
  ],
};

const ladies: DemoBranch = {
  branch: 'Jumeirah Ladies Salon & Spa',
  owner: 'Mariam',
  vatOn: true,
  nextSaleNumber: 2319,
  services: [
    {
      id: 'l1',
      name: 'Hair Styling',
      category: 'hair',
      priceMinor: aed(150),
      durationMin: 60,
      recipe: 'Styling cream 10 ml',
      stock: 'Styling cream 10 ml',
    },
    {
      id: 'l2',
      name: 'Blow-dry',
      category: 'hair',
      priceMinor: aed(80),
      durationMin: 45,
      recipe: 'Heat spray 5 ml',
      stock: 'Heat spray 5 ml',
    },
    {
      id: 'l3',
      name: 'Hair Color',
      category: 'color',
      priceMinor: aed(250),
      durationMin: 90,
      recipe: 'Hair Color 60 ml · Developer 60 ml',
      stock: 'Hair Color 60 ml, Developer 60 ml',
    },
    {
      id: 'l4',
      name: 'Manicure',
      category: 'nails',
      priceMinor: aed(70),
      durationMin: 40,
      recipe: 'Polish 2 ml',
      stock: 'Polish 2 ml',
    },
    {
      id: 'l5',
      name: 'Gel Nails',
      category: 'nails',
      priceMinor: aed(120),
      durationMin: 60,
      recipe: 'Gel polish 3 ml',
      stock: 'Gel polish 3 ml',
    },
    {
      id: 'l6',
      name: 'Facial & Eye',
      category: 'facial',
      priceMinor: aed(180),
      durationMin: 60,
      recipe: 'Face mask 1',
      stock: 'Face masks 1',
    },
    {
      id: 'l7',
      name: 'Threading',
      category: 'waxing',
      priceMinor: aed(25),
      durationMin: 15,
      recipe: 'Thread 1',
      stock: 'Thread 1',
    },
    {
      id: 'l8',
      name: 'Bridal Makeup',
      category: 'bridal',
      priceMinor: aed(950),
      durationMin: 120,
      recipe: 'Makeup kit use',
      stock: 'Makeup kit 1',
    },
    {
      id: 'l9',
      name: 'Moroccan Bath',
      category: 'spa',
      priceMinor: aed(220),
      durationMin: 60,
      recipe: 'Black soap 30 g',
      stock: 'Black soap 30 g',
    },
    {
      id: 'l10',
      name: 'Swedish Massage',
      category: 'spa',
      priceMinor: aed(300),
      durationMin: 60,
      recipe: 'Massage oil 20 ml',
      stock: 'Massage oil 20 ml',
    },
  ],
  staff: [
    {
      id: 'm1',
      name: 'Aisha',
      colour: '#F2777A',
      services: 6,
      salesMinor: aed(1180),
      commissionMinor: aed(141.6),
      state: 'on_shift',
    },
    {
      id: 'm2',
      name: 'Priya',
      colour: '#B892DB',
      services: 8,
      salesMinor: aed(760),
      commissionMinor: aed(76),
      state: 'with_client',
    },
    {
      id: 'm3',
      name: 'Leila',
      colour: '#E0A800',
      services: 4,
      salesMinor: aed(1040),
      commissionMinor: aed(124.8),
      state: 'with_client',
    },
    {
      id: 'm4',
      name: 'Grace',
      colour: '#1E90D6',
      services: 3,
      salesMinor: aed(520),
      commissionMinor: aed(52),
      state: 'off',
    },
  ],
  queue: [
    {
      id: 'lq1',
      customer: 'Fatima Al Mansoori',
      time: '10:30',
      services: 'Moroccan Bath',
      priceMinor: aed(220),
      staff: 'Leila',
      room: 'Spa room 1',
      status: 'in_progress',
      badges: [],
      visits: 9,
    },
    {
      id: 'lq2',
      customer: null,
      time: '10:58',
      minutes: 4,
      services: 'Threading',
      priceMinor: aed(25),
      staff: null,
      status: 'waiting',
      badges: ['walk_in'],
    },
    {
      id: 'lq3',
      customer: 'Sara Ahmed',
      time: '11:30',
      minutes: 25,
      services: 'Gel Nails',
      priceMinor: aed(120),
      staff: 'Priya',
      status: 'booked',
      badges: ['preferred'],
      visits: 8,
    },
    {
      id: 'lq4',
      customer: 'Hind Rashid',
      time: '12:00',
      minutes: 55,
      services: 'Hair Color',
      priceMinor: aed(250),
      staff: 'Aisha',
      status: 'booked',
      badges: ['patch_test'],
      visits: 4,
    },
    {
      id: 'lq5',
      customer: 'Noura Saeed',
      time: '13:00',
      minutes: 115,
      services: 'Bridal Makeup',
      priceMinor: aed(950),
      staff: 'Grace',
      status: 'booked',
      badges: ['deposit'],
      visits: 1,
    },
    {
      id: 'lq6',
      customer: 'Reem Khalid',
      time: '09:30',
      services: 'Pedicure',
      priceMinor: aed(90),
      staff: 'Priya',
      status: 'no_show',
      badges: ['second_no_show'],
      visits: 5,
    },
  ],
  kpis: {
    expectedCash: aed(3480),
    expectedDeltaPct: '8%',
    sales: aed(5920),
    servicesCount: 26,
    salesCount: 18,
    done: 9,
    waiting: 1,
    noShow: 1,
    purchases: aed(420),
    expenses: aed(220),
  },
  attention: [
    {
      icon: 'calculator',
      title: 'Cash closing · Mon 21 Sep',
      detail: 'Over by AED 10.00 · waiting for approval',
      action: 'review',
      tone: 'warning',
    },
    {
      icon: 'fileText',
      title: 'Health card · Priya',
      detail: 'Expires in 5 days',
      action: 'renew',
      tone: 'error',
    },
    {
      icon: 'package',
      title: 'Gel polish · Nude',
      detail: '1 left · reorder at 3',
      action: 'order',
      tone: 'error',
    },
    {
      icon: 'truck',
      title: 'Emirates Salon Supply',
      detail: 'AED 1,250.00 overdue by 3 days',
      action: 'pay',
      tone: 'error',
    },
  ],
  revenue7d: [aed(4200), aed(5100), aed(3900), aed(6100), aed(7400), aed(6800), aed(5920)],
  paymentMix: { cash: 32, card: 54, wallet: 10, deposits: 4 },
  topServices: [
    { name: 'Hair Color', revenueMinor: aed(4250), count: 17 },
    { name: 'Gel Nails', revenueMinor: aed(2880), count: 24 },
    { name: 'Moroccan Bath', revenueMinor: aed(2420), count: 11 },
  ],
  activity: [
    { who: 'Noor', what: 'saved sale #2318 · AED 370.00', when: '4 min ago' },
    { who: 'Leila', what: 'started Fatima Al Mansoori · Moroccan Bath', when: '10:30' },
    { who: 'Noor', what: 'took a deposit from Noura Saeed · AED 200.00', when: '09:48' },
  ],
};

export const demoBranches: Record<Mode, DemoBranch> = { gents, ladies };
