import { Allowed } from '@/features/auth/Allowed';
import { ItemFormScreen } from '@/features/inventory/ItemFormScreen';

export default function ItemFormRoute() {
  return (
    <Allowed cap="manageInventory">
      <ItemFormScreen />
    </Allowed>
  );
}
