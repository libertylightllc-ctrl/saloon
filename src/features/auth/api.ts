import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppError, errorCode } from '@/lib/errors';
import { detachedClient, supabase } from '@/lib/supabase';

const SALON_CODE_KEY = 'device.salonCode';
/** Owner or staff: the sign-in opens on the same tab next time (after sign-out or a disabled login). */
const SIGN_IN_AS_KEY = 'device.signInAs';

/** Staff never see this: they type salon code + username; Auth stores this internal email. */
export function staffEmail(salonCode: string, username: string): string {
  return `${username.trim().toLowerCase()}@${salonCode.trim().toLowerCase()}.staff.internal`;
}

export async function rememberedSalonCode(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(SALON_CODE_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function rememberedSignInAs(): Promise<'owner' | 'staff'> {
  try {
    return (await AsyncStorage.getItem(SIGN_IN_AS_KEY)) === 'staff' ? 'staff' : 'owner';
  } catch {
    return 'owner';
  }
}

function raise(error: unknown): never {
  throw new AppError(errorCode(error));
}

export async function signInOwner(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) raise(error);
  AsyncStorage.setItem(SIGN_IN_AS_KEY, 'owner').catch(() => undefined);
}

export async function signInStaff(salonCode: string, username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: staffEmail(salonCode, username), password });
  if (error) raise(error);
  AsyncStorage.setItem(SALON_CODE_KEY, salonCode.trim().toLowerCase()).catch(() => undefined);
  AsyncStorage.setItem(SIGN_IN_AS_KEY, 'staff').catch(() => undefined);
}

export async function signUpOwner(name: string, email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: name.trim() } },
  });
  if (error) raise(error);
  // A hosted project with email confirmation on returns no session until the link is clicked.
  if (!data.session) throw new AppError('confirm_email');
}

export async function sendResetCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) raise(error);
}

/**
 * Verify the emailed code and set the new password on a detached client, then sign in normally.
 * The device only becomes signed in once the new password is saved — never half-way.
 */
export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const recovery = detachedClient();
  const { error } = await recovery.auth.verifyOtp({ email: address, token: code.trim(), type: 'recovery' });
  if (error) raise(error);
  const { error: updateError } = await recovery.auth.updateUser({ password });
  await recovery.auth.signOut({ scope: 'local' }).catch(() => undefined);
  if (updateError) raise(updateError);
  await signInOwner(address, password);
}
