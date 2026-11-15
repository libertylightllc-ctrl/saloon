/** The customer list, a page at a time, for salons with thousands of customers. */
import { useInfiniteQuery } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { supabase } from '@/lib/supabase';

import { customerSearch, type Customer } from './api';

export const CUSTOMER_PAGE = 50;

export function useCustomerPages(businessId: string, search: string, enabled = true) {
  const term = search.trim();
  return useInfiniteQuery({
    enabled,
    queryKey: [...keys.customers(businessId), 'pages', term],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Customer[]> => {
      let query = supabase.from('customers').select('*').eq('business_id', businessId);
      if (term) {
        const find = customerSearch(term);
        query = 'digits' in find ? query.ilike('phone_digits', find.digits) : query.or(find.or);
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
