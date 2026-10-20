import { useLocalSearchParams } from 'expo-router';

import { BookingScreen } from '@/features/booking/BookingScreen';

/** saloqo.com/b/<link>: a salon's online booking page, open to everyone. */
export default function BookingLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BookingScreen slug={String(slug ?? '').toLowerCase()} />;
}
