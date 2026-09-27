/**
 * Receipt photos for expenses and supplier bills. The photo goes to the private `receipts` bucket under
 * the business's folder, then attach_receipt() links it to the row (once — it is never replaced).
 * Photos are shown through short-lived signed links.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import { keys } from '@/features/live/useLiveSync';
import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type ReceiptKind = 'expense' | 'bill';

export interface PickedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
const MAX_BYTES = 5 * 1024 * 1024;

/** Camera (phones) or photo library; null when the person cancels. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AppError('camera_denied');
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  const mimeType = asset.mimeType && EXT[asset.mimeType] ? asset.mimeType : 'image/jpeg';
  if (asset.base64.length * 0.75 > MAX_BYTES) throw new AppError('photo_too_large');
  return { uri: asset.uri, base64: asset.base64, mimeType };
}

export function useAttachReceipt(kind: ReceiptKind, businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId, photo }: { rowId: string; photo: PickedPhoto }) => {
      const folder = kind === 'expense' ? 'expenses' : 'bills';
      const path = `${businessId}/${folder}/${rowId}-${Crypto.randomUUID().slice(0, 8)}.${EXT[photo.mimeType]}`;
      const bytes = Uint8Array.from(atob(photo.base64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, bytes, { contentType: photo.mimeType, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.rpc('attach_receipt', { p_kind: kind, p_id: rowId, p_path: path });
      if (error) throw error;
      return path;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.moneyOut(businessId) }),
  });
}

/** A signed link that works for an hour; refreshed before it runs out. */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    enabled: Boolean(path),
    queryKey: ['receipt', path],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
