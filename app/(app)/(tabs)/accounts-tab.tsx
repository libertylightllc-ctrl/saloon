import { Allowed } from '@/features/auth/Allowed';
import { AccountsScreen } from '@/features/accounts/AccountsScreen';

/** The accountant's Accounting tab (owners open the same screen from More). */
export default function AccountsTab() {
  return (
    <Allowed cap="viewAccounting">
      <AccountsScreen asTab />
    </Allowed>
  );
}
