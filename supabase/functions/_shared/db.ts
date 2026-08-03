import { createClient } from 'npm:@supabase/supabase-js@2';

// Service-role client — bypasses RLS. Only ever used server-side inside
// Edge Functions, never shipped to the browser.
export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function verifyPin(pin: unknown): boolean {
  const expected = Deno.env.get('ADMIN_PIN') ?? '';
  return !!expected && String(pin ?? '') === expected;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
