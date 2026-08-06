import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Check rate limit for a given client key and bucket.
 * Uses the rate_limits table with a 1-minute sliding window.
 * Returns true if the request is allowed, false if rate limit exceeded.
 */
export async function checkRateLimit(
  clientKey: string,
  bucket: string,
  limitPerMin: number,
): Promise<boolean> {
  const supabase = getAdminClient();
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);

  const { data, error } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('client_key', clientKey)
    .eq('bucket', bucket)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();

  if (error) {
    // If we can't check the rate limit, allow the request (fail open)
    console.error('Rate limit check failed:', error.message);
    return true;
  }

  if (data) {
    if (data.count >= limitPerMin) {
      return false;
    }
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ count: data.count + 1, updated_at: new Date().toISOString() })
      .eq('client_key', clientKey)
      .eq('bucket', bucket)
      .eq('window_start', windowStart.toISOString());

    if (updateError) {
      console.error('Rate limit increment failed:', updateError.message);
    }
    return true;
  }

  // No existing row for this window — insert a new one
  const { error: insertError } = await supabase
    .from('rate_limits')
    .insert({
      client_key: clientKey,
      bucket,
      window_start: windowStart.toISOString(),
      count: 1,
    });

  if (insertError) {
    // Race condition — another request inserted first. Try update.
    if (insertError.code === '23505') {
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('count')
        .eq('client_key', clientKey)
        .eq('bucket', bucket)
        .eq('window_start', windowStart.toISOString())
        .maybeSingle();

      if (existing && existing.count >= limitPerMin) {
        return false;
      }
      await supabase
        .from('rate_limits')
        .update({ count: (existing?.count ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('client_key', clientKey)
        .eq('bucket', bucket)
        .eq('window_start', windowStart.toISOString());
      return true;
    }
    console.error('Rate limit insert failed:', insertError.message);
    return true; // fail open
  }

  return true;
}

/**
 * Read a secret from Deno environment variables.
 */
export function getSecret(name: string): string | undefined {
  return Deno.env.get(name);
}
