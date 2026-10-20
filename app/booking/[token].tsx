import { useLocalSearchParams } from 'expo-router';

import { MyBookingScreen } from '@/features/booking/MyBookingScreen';

/** saloqo.com/booking/<token>: a customer's own online booking, open to whoever holds the link. */
export default function MyBooking() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <MyBookingScreen token={String(token ?? '')} />;
}
