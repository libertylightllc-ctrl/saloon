import { Allowed } from '@/features/auth/Allowed';
import { AdjustmentsScreen } from '@/features/payroll/AdjustmentsScreen';

export default function AdjustmentsRoute() {
  return (
    <Allowed cap="runPayroll">
      <AdjustmentsScreen />
    </Allowed>
  );
}
