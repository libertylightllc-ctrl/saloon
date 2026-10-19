/**
 * The salon's logo on its receipts (owner, 2026-10-19). Picked from the phone's photos, shrunk to receipt size (at
 * most 600 × 240, never enlarged) and saved as PNG so a see-through background stays see-through; stored in the
 * public `logos` bucket under the business's folder. Receipts carry it inside their own HTML (a data: link), so a
 * printout or PDF never waits on a download.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { useSession } from '@/features/auth/session';
import { uploadPhoto, type PickedPhoto } from '@/features/moneyout/receipts';
import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MAX = { width: 600, height: 240 };
/** The bucket takes up to 1 MB; a logo is a few KB. A photo that stays big as PNG is saved as JPG instead. */
const PNG_LIMIT = 700 * 1024;

/** The size a picture is shrunk to so it fits the receipt's logo box (kept as is when already small). */
export function fitLogo(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX.width / width, MAX.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Picks a picture from the phone and shrinks it; null when the owner cancels. */
export async function pickLogo(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const size = fitLogo(asset.width || MAX.width, asset.height || MAX.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(size);
  const image = await context.renderAsync();
  let saved = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
  let mimeType = 'image/png';
  if ((saved.base64?.length ?? 0) * 0.75 > PNG_LIMIT) {
    saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
    mimeType = 'image/jpeg';
  }
  if (!saved.base64) throw new AppError('unknown');
  return { uri: saved.uri, base64: saved.base64, mimeType };
}

/** The logo's web address (the bucket is public). */
export function logoUrl(path: string): string {
  return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
}

/** The logo as a data: link, to sit inside a receipt's HTML. */
async function dataUri(path: string): Promise<string> {
  const response = await fetch(logoUrl(path));
  if (!response.ok) throw new Error(`logo ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The logo for a receipt, kept once loaded; null without one, or when it cannot be loaded (the receipt still prints). */
export async function receiptLogo(client: QueryClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    return await client.fetchQuery({ queryKey: ['logo', path], queryFn: () => dataUri(path), staleTime: Infinity });
  } catch {
    return null;
  }
}

/** Puts a picked logo on the branch's receipts, or takes it off (null). Owner. */
export function useSetLogo(businessId: string, branchId: string) {
  const { reload } = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (photo: PickedPhoto | null) => {
      const path = photo ? await uploadPhoto('logos', businessId, branchId, photo) : null;
      // null takes the logo off (the generated types cannot say a function argument may be null).
      const { error } = await supabase.rpc('set_branch_logo', { p_branch: branchId, p_path: path as string });
      if (error) throw error;
      if (path && photo) client.setQueryData(['logo', path], `data:${photo.mimeType};base64,${photo.base64}`);
    },
    onSuccess: () => reload(),
  });
}
