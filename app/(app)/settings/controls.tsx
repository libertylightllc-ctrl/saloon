import { Allowed } from '@/features/auth/Allowed';
import { ControlsScreen } from '@/features/controls/ControlsScreen';

export default function ControlsRoute() {
  return (
    <Allowed cap="manageControls">
      <ControlsScreen />
    </Allowed>
  );
}
