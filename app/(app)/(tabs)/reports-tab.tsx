import { Allowed } from '@/features/auth/Allowed';
import { ReportsScreen } from '@/features/reports/ReportsScreen';

/** The accountant's Reports tab (owners open the same screen from More). */
export default function ReportsTab() {
  return (
    <Allowed cap="viewReports">
      <ReportsScreen asTab />
    </Allowed>
  );
}
