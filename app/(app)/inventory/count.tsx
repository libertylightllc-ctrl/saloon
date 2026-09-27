import { Allowed } from '@/features/auth/Allowed';
import { CountScreen } from '@/features/inventory/CountScreen';

export default function CountRoute() {
  return (
    <Allowed cap="countStock">
      <CountScreen />
    </Allowed>
  );
}
