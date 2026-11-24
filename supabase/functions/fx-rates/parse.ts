/** ExchangeRate-API's open endpoint (https://open.er-api.com/v6/latest/USD): how many of each currency one US dollar buys. */
export interface RatesReply {
  result?: string;
  base_code?: string;
  time_last_update_unix?: number;
  rates?: Record<string, unknown>;
}

/**
 * The day (UTC, as the service counts it) and the rates, or null when the reply is not a full table: not a success,
 * not per US dollar, or fewer than 20 currencies. Anything that is not a positive number is left out.
 */
export function parseRates(reply: RatesReply): { day: string; rates: Record<string, number> } | null {
  if (reply.result !== 'success' || reply.base_code !== 'USD' || !reply.rates || !reply.time_last_update_unix) return null;
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(reply.rates)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  if (rates.USD !== 1 || Object.keys(rates).length < 20) return null;
  return { day: new Date(reply.time_last_update_unix * 1000).toISOString().slice(0, 10), rates };
}
