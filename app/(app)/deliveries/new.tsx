import { Allowed } from '@/features/auth/Allowed';
import { ReceiveDeliveryScreen } from '@/features/deliveries/ReceiveDeliveryScreen';

export default function ReceiveDelivery() {
  return (
    <Allowed cap="receiveDelivery">
      <ReceiveDeliveryScreen />
    </Allowed>
  );
}
