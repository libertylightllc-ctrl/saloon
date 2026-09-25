import { Gate } from '@/features/auth/Gate';
import { SetupWizard } from '@/features/setup/SetupWizard';

export default function Setup() {
  return (
    <Gate area="setup">
      <SetupWizard />
    </Gate>
  );
}
