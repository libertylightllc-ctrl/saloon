/**
 * Every failure the user can see maps to one code with a message in `errors.<code>`.
 * RPCs raise `code` or `code: detail`; Supabase Auth and Edge Functions have their own shapes.
 */
export const ERROR_CODES = [
  'not_signed_in', 'not_allowed', 'already_has_business', 'mode_required', 'trn_required', 'invalid_amount',
  'opening_cash_already_set', 'category_required', 'not_found', 'service_unavailable', 'services_required',
  'time_required', 'slot_taken', 'room_required', 'deposit_method_required', 'invalid_status', 'reason_required',
  'lines_required', 'invalid_line', 'invalid_qty', 'invalid_discount', 'invalid_tip', 'invalid_payment',
  'payment_mismatch', 'insufficient_stock', 'period_closed', 'username_taken', 'weak_password', 'invalid_username',
  'name_required', 'invalid_commission', 'wrong_password', 'disabled', 'email_taken', 'no_internet',
  'rate_limited', 'invalid_code', 'unknown_salon', 'confirm_email', 'category_exists', 'unknown_setting',
  'invalid_role', 'server_busy', 'unknown',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const KNOWN = new Set<string>(ERROR_CODES);

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export function errorCode(error: unknown): ErrorCode {
  if (!error) return 'unknown';
  if (error instanceof AppError) return error.code;
  const e = error as { message?: unknown; code?: unknown };
  const message = typeof e.message === 'string' ? e.message : String(error);
  if (/failed to fetch|network request failed|networkerror|fetch failed|load failed/i.test(message)) {
    return 'no_internet';
  }
  // Gateway / auth / database timeouts and 5xx: the request reached a server that was too slow.
  const status = Number((error as { status?: unknown }).status);
  if (
    status >= 500 ||
    e.code === '57014' ||
    /timed out|statement timeout|deadline exceeded|upstream server|bad gateway|gateway timeout/i.test(message)
  ) {
    return 'server_busy';
  }
  if (/invalid login credentials/i.test(message)) return 'wrong_password';
  if (/banned/i.test(message)) return 'disabled';
  if (/already (been )?registered|user already exists/i.test(message)) return 'email_taken';
  if (/rate limit|too many requests/i.test(message)) return 'rate_limited';
  if (/token has expired or is invalid|invalid otp|otp.*expired/i.test(message)) return 'invalid_code';
  if (/password should be|weak password/i.test(message)) return 'weak_password';
  const head = message.split(':')[0]!.trim();
  if (KNOWN.has(head)) return head as ErrorCode;
  if (e.code === '42501') return 'not_allowed';
  return 'unknown';
}

/** The extra detail after "code:" (e.g. the items that are short of stock). */
export function errorDetail(error: unknown): string | undefined {
  if (error instanceof AppError) return error.detail;
  const message = (error as { message?: unknown })?.message;
  if (typeof message !== 'string' || !message.includes(':')) return undefined;
  return message.slice(message.indexOf(':') + 1).trim() || undefined;
}

/** Edge Functions answer {error: code} with a non-2xx status. */
export async function functionError(error: unknown): Promise<AppError> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (context?.json) {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error && KNOWN.has(body.error)) return new AppError(body.error as ErrorCode);
    } catch {
      // fall through
    }
  }
  return new AppError(errorCode(error));
}
