import { Allowed } from '@/features/auth/Allowed';
import { CustomersScreen } from '@/features/customers/CustomersScreen';

export default function CustomersTab() {
  return (
    <Allowed cap="viewCustomers">
      <CustomersScreen />
    </Allowed>
  );
}
