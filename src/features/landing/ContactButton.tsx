import { Link } from 'expo-router';

import { Button } from '@/ui';
import type { ButtonProps } from '@/ui/Button';

import { contactHref } from './contact';

/** "Contact us" as a real link (website brief 1.7): WhatsApp when set, else the support chat. */
export function ContactButton({ label, testID, size = 'sm' }: { label: string; testID?: string; size?: ButtonProps['size'] }) {
  if (contactHref.external) {
    return <Button variant="ghost" size={size} icon="messageCircle" label={label} href={contactHref.href} external testID={testID} />;
  }
  return (
    <Link href="/contact" asChild>
      <Button variant="ghost" size={size} icon="messageCircle" label={label} testID={testID} />
    </Link>
  );
}
