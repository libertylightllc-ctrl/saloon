import { Allowed } from '@/features/auth/Allowed';
import { DocumentScreen } from '@/features/compliance/DocumentScreen';

export default function DocumentRoute() {
  return (
    <Allowed cap="manageCompliance">
      <DocumentScreen />
    </Allowed>
  );
}
