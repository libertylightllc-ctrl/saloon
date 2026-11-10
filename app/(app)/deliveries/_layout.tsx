import { AllowedStack } from '@/features/auth/Allowed';

export default function DeliveriesLayout() {
  return <AllowedStack cap={['receiveDelivery', 'priceDelivery']} />;
}
