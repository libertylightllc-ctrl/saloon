import { Allowed } from '@/features/auth/Allowed';
import { BillFormScreen } from '@/features/moneyout/BillFormScreen';

export default function NewBill() {
  return (
    <Allowed cap="addPurchase">
      <BillFormScreen />
    </Allowed>
  );
}
