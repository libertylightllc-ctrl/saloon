import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { brand } from '@/config/brand';
import { track } from '@/lib/analytics';
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

export type SignUpOutcome = 'signed_in' | 'check_email' | 'already_registered';

/**
 * What a sign-up led to. With email confirmation on (hosted) there is no session until the link is clicked; an address
 * that already has an account gets no email and a stand-in user with no identities (Supabase hides that the address
 * exists), so we say so instead of "check your email".
 */
export function signUpOutcome(data: { session: unknown; user: { identities?: unknown[] | null } | null }): SignUpOutcome {
  if (data.session) return 'signed_in';
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return 'already_registered';
  return 'check_email';
}

/**
 * `contact`: the optional mobile / WhatsApp number ("+971501234567") and the WhatsApp OK (website brief 3.3); the
 * database keeps them for the owner when the account is created (owner_contacts). `pilotCode`: a pilot code typed at
 * sign-up, used when the salon is created (a wrong one changes nothing; it can be typed again in Plan & billing).
 */
export async function signUpOwner(
  name: string,
  email: string,
  password: string,
  contact?: { phone: string; whatsappOk: boolean },
  pilotCode?: string,
): Promise<SignUpOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        display_name: name.trim(),
        ...(contact?.phone ? { phone: contact.phone, whatsapp_ok: contact.whatsappOk } : {}),
        // Used by the database when the salon is created (full update, Phase 6: start_free_period).
        ...(pilotCode?.trim() ? { pilot_code: pilotCode.trim().toUpperCase() } : {}),
      },
    },
  });
  // With "Confirm email" off Supabase says so outright (owner's fix list C2/C4): the same "already has an account".
  if (error && (error.code === 'user_already_exists' || /already registered/i.test(error.message))) return 'already_registered';
  if (error) raise(error);
  const outcome = signUpOutcome(data);
  // No confirmation wall (owner's fix list C2): signed straight in, and the link to confirm the address is on its way.
  if (outcome === 'signed_in') sendConfirmLink(email).catch(() => undefined);
  return outcome;
}

/**
 * "Confirm your email" (owner's fix list C2): a sign-in link to the owner's inbox (Supabase's "Magic Link" email, worded
 * "Confirm your email for Saloqo"). Opening it signs them in on that browser, and the app counts the address as
 * confirmed (confirm_my_email). It comes back to the website: on the web to this same site, from the phone apps to
 * the live site, where the record is made; the app sees it at its next check.
 */
export async function sendConfirmLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false, emailRedirectTo: Platform.OS === 'web' ? `${window.location.origin}/` : `${brand.website}/` },
  });
  if (error) raise(error);
}

/**
 * Whether an open salon's owner already gave this number (owner's fix list C4), asked before the account is made. Yes
 * or no only, and limited by the database; anything going wrong means no, so sign-up is never stopped by it.
 */
export async function phoneHasSalon(phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('phone_has_salon', { p_phone: phone });
  return !error && data === true;
}

export interface EmailConfirmation {
  confirmed: boolean;
  /** Confirmed by this sign-in (an emailed link or a reset code). */
  newly: boolean;
}

/**
 * Whether the signed-in address is confirmed (owner's fix list C2). A sign-in that came through the inbox (the emailed
 * link) confirms it there and then, so this is asked after every sign-in, on whatever screen.
 */
export async function askEmailConfirmed(): Promise<EmailConfirmation> {
  const { data, error } = await supabase.rpc('confirm_my_email');
  if (error) throw error;
  const result = data as unknown as EmailConfirmation;
  if (result.newly) track('email_confirmed');
  return result;
}

/** Sends the confirmation email again (Supabase limits how often). */
export async function resendSignUpEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
  if (error) raise(error);
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
  // The code came to the inbox, so the address is confirmed (owner's fix list C2). If it was not before, whoever made
  // the account may not be the inbox's owner: once the new password is saved, every other device is signed out.
  const { data: confirmed } = await recovery.rpc('confirm_my_email');
  const { error: updateError } = await recovery.auth.updateUser({ password });
  if (!updateError && (confirmed as { newly?: boolean } | null)?.newly) {
    await recovery.auth.signOut({ scope: 'others' }).catch(() => undefined);
  }
  await recovery.auth.signOut({ scope: 'local' }).catch(() => undefined);
  if (updateError) raise(updateError);
  await signInOwner(address, password);
}
