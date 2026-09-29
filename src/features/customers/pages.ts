/** The customer list, a page at a time, for salons with thousands of customers. */
import { useInfiniteQuery } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { supabase } from '@/lib/supabase';

import type { Customer } from './api';

export const CUSTOMER_PAGE = 50;

export function useCustomerPages(businessId: string, search: string) {
  const term = search.trim();
  return useInfiniteQuery({
    queryKey: [...keys.customers(businessId), 'pages', term],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Customer[]> => {
      let query = supabase.from('customers').select('*').eq('business_id', businessId);
      if (term) {
        const like = `%${term.replace(/[%_,()]/g, ' ')}%`;
        query = query.or(`name.ilike.${like},phone.ilike.${like}`);
      }
      const { data, error } = await query
        .order('last_visit_at', { ascending: false, nullsFirst: false })
        .order('name')
        .order('id')
        .range(pageParam, pageParam + CUSTOMER_PAGE - 1);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) => (last.length < CUSTOMER_PAGE ? undefined : pages.length * CUSTOMER_PAGE),
  });
}
