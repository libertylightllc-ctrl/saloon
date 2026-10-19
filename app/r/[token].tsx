import { useLocalSearchParams } from 'expo-router';

import { ReceiptLinkScreen } from '@/features/sales/ReceiptLinkScreen';

/** saloqo.com/r/<token>: a receipt sent on WhatsApp, open to whoever holds the link. */
export default function ReceiptLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <ReceiptLinkScreen token={String(token ?? '')} />;
}
