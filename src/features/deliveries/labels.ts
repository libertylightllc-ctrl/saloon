import type { TFunction } from 'i18next';

import type { StatusKey } from '@/ui';

import type { DeliveryStatus } from './api';

const PILL: Record<DeliveryStatus, StatusKey> = { waiting: 'waiting', priced: 'completed', cancelled: 'cancelled' };

/** A delivery's pill: waiting for prices (amber), priced (green), cancelled (grey). */
export const deliveryPill = (status: DeliveryStatus, t: TFunction) => ({ status: PILL[status], label: t(`deliveries.status.${status}`) });
