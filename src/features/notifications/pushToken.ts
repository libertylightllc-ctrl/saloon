/** The push token this phone registered (kept apart so sign-out can remove it without loading push code). */
let token: string | null = null;

export function registeredPushToken(): string | null {
  return token;
}

export function rememberPushToken(value: string | null) {
  token = value;
}
