alter table public.salon_records drop constraint salon_records_record_type_check;
alter table public.salon_records add constraint salon_records_record_type_check check (record_type in (
  'service','customer','appointment','queue_ticket','sale','purchase','expense',
  'inventory_item','cash_closing','staff_payment','inspection','hygiene_log',
  'compliance_document','document_chain','product_registration','accounting_entry','shop_setting'
));
