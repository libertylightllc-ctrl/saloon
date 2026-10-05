-- Currencies for salons in Europe, the Caucasus and Central Asia, the rest of the Middle East and the Americas
-- (owner, 2026-10-05: "this app is used middle east, eu, central asia, all over america"). Same list as
-- src/lib/currencies.ts: minor-unit decimals for money in words, and rough rates so a new salon's starter services are
-- priced in its own currency (units per AED, 2026; the owner sets real prices in Services).

create or replace function public.currency_decimals(p_currency text) returns int
language sql immutable set search_path = public as $$
  select case when p_currency in ('KWD', 'BHD', 'OMR', 'JOD', 'TND', 'LYD') then 3
              -- The Iraqi dinar and the Lebanese pound have no coins in use: whole units.
              when p_currency in ('JPY', 'VND', 'CLP', 'ISK', 'PYG', 'IQD', 'LBP') then 0
              else 2 end
$$;

create or replace function public.starter_price(p_aed_fils bigint, p_currency text) returns bigint
language plpgsql immutable set search_path = public as $$
declare
  v_rate numeric := case p_currency
    when 'SAR' then 1.02 when 'QAR' then 0.99 when 'KWD' then 0.083 when 'BHD' then 0.102 when 'OMR' then 0.105
    when 'EGP' then 13.5 when 'JOD' then 0.193 when 'MAD' then 2.5 when 'TND' then 0.83 when 'TRY' then 11
    when 'ZAR' then 4.8 when 'NGN' then 420 when 'KES' then 35 when 'GHS' then 3.3 when 'INR' then 23.5
    when 'PKR' then 77 when 'BDT' then 33 when 'LKR' then 81 when 'NPR' then 37 when 'SGD' then 0.35
    when 'MYR' then 1.17 when 'PHP' then 15.5 when 'IDR' then 4400 when 'THB' then 8.9 when 'VND' then 7000
    when 'JPY' then 40 when 'AUD' then 0.42 when 'NZD' then 0.46 when 'GBP' then 0.2 when 'EUR' then 0.235
    when 'CHF' then 0.22 when 'SEK' then 2.6 when 'NOK' then 2.75 when 'DKK' then 1.75 when 'PLN' then 1.0
    when 'USD' then 0.272 when 'CAD' then 0.375 when 'MXN' then 5.1 when 'BRL' then 1.5 when 'COP' then 1100
    when 'CLP' then 260
    -- Added 2026-10-06
    when 'CZK' then 6.1 when 'HUF' then 98 when 'RON' then 1.22 when 'ISK' then 37 when 'UAH' then 11.2
    when 'RSD' then 28.6 when 'ALL' then 25 when 'MKD' then 15.2 when 'BAM' then 0.49 when 'MDL' then 4.8
    when 'GEL' then 0.73 when 'AMD' then 106 when 'AZN' then 0.46 when 'KZT' then 141 when 'UZS' then 3400
    when 'KGS' then 23.7 when 'TJS' then 2.86 when 'TMT' then 0.95 when 'MNT' then 938 when 'RUB' then 23
    when 'IQD' then 356 when 'LBP' then 24300 when 'ILS' then 0.98 when 'DZD' then 36 when 'LYD' then 1.5
    when 'ARS' then 326 when 'PEN' then 0.98 when 'UYU' then 10.9 when 'PYG' then 2120 when 'BOB' then 1.88
    when 'CRC' then 137 when 'GTQ' then 2.1 when 'HNL' then 7.1 when 'NIO' then 10 when 'DOP' then 16.9
    when 'JMD' then 43 when 'TTD' then 1.85 when 'BSD' then 0.272 when 'BBD' then 0.544 when 'BZD' then 0.544
    else 1 end;
  v_major numeric := p_aed_fils / 100.0 * v_rate;
  v_step numeric;
begin
  if coalesce(p_currency, 'AED') = 'AED' or v_major <= 0 then
    return p_aed_fils;
  end if;
  v_step := 10 ^ (floor(log(v_major)) - 1);
  return round(round(v_major / v_step) * v_step * 10 ^ public.currency_decimals(p_currency))::bigint;
end;
$$;
