import { Allowed } from '@/features/auth/Allowed';
import { StaffFormScreen } from '@/features/staff/StaffFormScreen';

export default function StaffFormRoute() {
  return (
    <Allowed cap="manageStaff">
      <StaffFormScreen />
    </Allowed>
  );
}
