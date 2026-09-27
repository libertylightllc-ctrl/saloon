import { Allowed } from '@/features/auth/Allowed';
import { MyPayScreen } from '@/features/payroll/MyPayScreen';

export default function PayTab() {
  return (
    <Allowed cap="myPay">
      <MyPayScreen />
    </Allowed>
  );
}
