import { useMutation } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

/**
 * Deletes the signed-in person's account. The session does the work (so the "deleted" message survives this screen
 * closing when the person is signed out) and ends on the sign-in page with that message.
 */
export function useDeleteAccount() {
  const { deleteAccount } = useSession();
  return useMutation({ mutationFn: deleteAccount });
}
