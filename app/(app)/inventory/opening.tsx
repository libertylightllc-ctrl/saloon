import { Allowed } from '@/features/auth/Allowed';
import { OpeningStockScreen } from '@/features/inventory/OpeningStockScreen';

export default function OpeningStockRoute() {
  return (
    <Allowed cap="manageInventory">
      <OpeningStockScreen />
    </Allowed>
  );
}
