/**
 * The booking page's own look (website brief 5.1, 2026-10-23): a cover photo at the top and the salon's Instagram.
 * Owner, saved at once. The photo is shrunk to the page's width (at most 1200 × 800, never enlarged), saved as JPG and
 * kept in the public `logos` bucket like the receipt logo.
 */
import { useMutation } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { useSession } from '@/features/auth/session';
import { uploadPhoto, type PickedPhoto } from '@/features/moneyout/receipts';
import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MAX = { width: 1200, height: 800 };

/** The size a cover photo is shrunk to (kept as is when already small). */
export function fitCover(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX.width / width, MAX.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Picks a photo from the phone and shrinks it; null when the owner cancels. */
export async function pickCover(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(fitCover(asset.width || MAX.width, asset.height || MAX.height));
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new AppError('unknown');
  return { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
}

/** Puts a picked photo at the top of the booking page, or takes it off (null). */
export function useSetCover(businessId: string, branchId: string) {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (photo: PickedPhoto | null) => {
      const path = photo ? await uploadPhoto('logos', businessId, `cover-${branchId}`, photo) : null;
      // null takes the photo off (the generated types cannot say a function argument may be null).
      const { error } = await supabase.rpc('set_branch_cover', { p_branch: branchId, p_path: path as string });
      if (error) throw error;
    },
    onSuccess: () => reload(),
  });
}

/** Saves the salon's Instagram (a handle or a profile link; kept as the handle; blank removes it). */
export function useSetInstagram(branchId: string) {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await supabase.rpc('set_branch_instagram', { p_branch: branchId, p_instagram: value });
      if (error) throw error;
      return data;
    },
    onSuccess: () => reload(),
  });
}

/** The profile's address. */
export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`;
