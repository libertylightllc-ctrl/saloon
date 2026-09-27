/**
 * Compliance: the register (template slots + the owner's own records), documents with versions and evidence,
 * the daily hygiene log and WPS status. Evidence lives in the private `documents` bucket.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { uploadPhoto, type PickedPhoto } from '@/features/moneyout/receipts';
import type { BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type DocStatus = 'valid' | 'due_soon' | 'expired' | 'missing_date' | 'evidence_missing' | 'missing';
export type HolderType = 'company' | 'premises' | 'employee';

export interface Slot {
  slot_key: string;
  doc_type: string;
  holder_type: HolderType;
  branch_id: string | null;
  employee_id: string | null;
  holder_name: string;
  required: boolean;
  document_id: string | null;
  number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  renewal_cost_minor: number | null;
  reminder_days: number | null;
  evidence_path: string | null;
  version: number | null;
  status: DocStatus;
  days_left: number | null;
}

export interface HygieneLog {
  id: string;
  business_date: string;
  checklist: Record<string, boolean>;
  note: string | null;
  evidence_path: string | null;
  members: { display_name: string } | null;
}

export const HYGIENE_ITEMS = ['tools_sterilised', 'towels_changed', 'surfaces_cleaned', 'floors_mopped', 'waste_disposed'] as const;

export function useCompliance(businessId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...keys.compliance(businessId), 'status'],
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await supabase.rpc('compliance_status', { p_business: businessId });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        holder_type: s.holder_type as HolderType,
        status: s.status as DocStatus,
        renewal_cost_minor: s.renewal_cost_minor === null ? null : Number(s.renewal_cost_minor),
      }));
    },
  });
}

/** Every version of one slot, newest first. */
export function useVersions(businessId: string, slot: Pick<Slot, 'doc_type' | 'employee_id' | 'branch_id' | 'holder_type'> | null) {
  return useQuery({
    enabled: Boolean(slot),
    queryKey: [...keys.compliance(businessId), 'versions', slot?.doc_type, slot?.employee_id, slot?.branch_id],
    queryFn: async () => {
      let q = supabase
        .from('compliance_documents')
        .select('id, number, issued_on, expires_on, version, active, evidence_path, created_at')
        .eq('business_id', businessId)
        .eq('doc_type', slot!.doc_type);
      q = slot!.employee_id ? q.eq('employee_id', slot!.employee_id) : q.is('employee_id', null).eq('branch_id', slot!.branch_id!);
      const { data, error } = await q.order('version', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useHygieneLogs(branchId: string) {
  return useQuery({
    queryKey: [...keys.hygiene(branchId)],
    queryFn: async (): Promise<HygieneLog[]> => {
      const { data, error } = await supabase
        .from('hygiene_logs')
        .select('id, business_date, checklist, note, evidence_path, members!hygiene_logs_signed_by_fkey(display_name)')
        .eq('branch_id', branchId)
        .order('business_date', { ascending: false })
        .limit(14);
      if (error) throw error;
      return data as unknown as HygieneLog[];
    },
  });
}

export function useWpsStatus(businessId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...keys.compliance(businessId), 'wps'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wps_status', { p_business: businessId });
      if (error) throw error;
      return data as unknown as { period: string | null; required: number; proven: number; target_pct: number };
    },
  });
}

function useInvalidateCompliance(businessId: string, branchId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.compliance(businessId), keys.hygiene(branchId), keys.dashboard(branchId)]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export interface DocumentInput {
  branch_id: string | null;
  employee_id: string | null;
  doc_type: string;
  holder_type: HolderType;
  number: string | null;
  issued_on: BusinessDate | null;
  expires_on: BusinessDate | null;
  renewal_cost_minor: number | null;
  reminder_days: number;
}

export function useSaveDocument(businessId: string, branchId: string) {
  const done = useInvalidateCompliance(businessId, branchId);
  return useMutation({
    mutationFn: async (input: DocumentInput & { photo?: PickedPhoto | null }) => {
      const { photo, ...doc } = input;
      const { data, error } = await supabase.rpc('save_document', { p: asJson({ ...doc, business_id: businessId }) });
      if (error) throw error;
      const id = data as string;
      if (photo) {
        const path = await uploadPhoto('documents', `${businessId}/compliance`, id, photo);
        const { error: e2 } = await supabase.rpc('attach_document_evidence', { p_document: id, p_path: path });
        if (e2) throw e2;
      }
      return id;
    },
    onSuccess: done,
  });
}

export function useAttachEvidence(businessId: string, branchId: string) {
  const done = useInvalidateCompliance(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { document_id: string; photo: PickedPhoto }) => {
      const path = await uploadPhoto('documents', `${businessId}/compliance`, input.document_id, input.photo);
      const { error } = await supabase.rpc('attach_document_evidence', { p_document: input.document_id, p_path: path });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useSignHygiene(businessId: string, branchId: string) {
  const done = useInvalidateCompliance(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { checklist: Record<string, boolean>; note: string | null; photo: PickedPhoto | null; date: BusinessDate }) => {
      const path = input.photo ? await uploadPhoto('documents', `${businessId}/hygiene`, input.date, input.photo) : null;
      const { error } = await supabase.rpc('sign_hygiene_log', {
        p: asJson({ branch_id: branchId, checklist: input.checklist, note: input.note, evidence_path: path }),
      });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
