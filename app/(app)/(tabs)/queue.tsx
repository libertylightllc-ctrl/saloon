import { Allowed } from '@/features/auth/Allowed';
import { QueueScreen } from '@/features/queue/QueueScreen';

export default function QueueTab() {
  return (
    <Allowed cap="addToQueue">
      <QueueScreen />
    </Allowed>
  );
}
