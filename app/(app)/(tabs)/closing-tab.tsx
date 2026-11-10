import { Allowed } from '@/features/auth/Allowed';
import { ClosingScreen } from '@/features/closing/ClosingScreen';

/** The manager's and the front desk's Closing tab (the owner opens the same screen from More). */
export default function ClosingTab() {
  return (
    <Allowed cap="countCash">
      <ClosingScreen asTab />
    </Allowed>
  );
}
