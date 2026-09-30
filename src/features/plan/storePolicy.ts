import { Platform } from 'react-native';

/**
 * Apple and Google require their own in-app purchase for subscriptions bought inside a store app, and forbid
 * pointing to another way to pay. So the phone apps only show whether the plan is on; prices and asking for a plan
 * are on the website (docs/DECISIONS.md, 2026-09-30).
 */
export const canOfferPlans = Platform.OS === 'web';
