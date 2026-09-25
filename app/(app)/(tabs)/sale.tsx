import { Allowed } from '@/features/auth/Allowed';
import { SaleScreen } from '@/features/sale/SaleScreen';

export default function SaleTab() {
  return (
    <Allowed cap="sell">
      <SaleScreen />
    </Allowed>
  );
}
