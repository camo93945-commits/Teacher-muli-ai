import { json, sb } from './_lib.js';

export async function GET() {
  try {
    const data = await sb('tm_payment_requests?select=id&limit=1');

    return json({
      ok: true,
      supabaseUrl: process.env.SUPABASE_URL,
      serviceKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      paymentTableReachable: true,
      rowCountSample: Array.isArray(data) ? data.length : 0
    });
  } catch (e) {
    return json({
      ok: false,
      supabaseUrl: process.env.SUPABASE_URL,
      serviceKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      paymentTableReachable: false,
      error: e.code === 'SUPABASE_TIMEOUT'
        ? 'supabase_timeout'
        : e.message,
      detail: e.detail || null
    }, 500);
  }
}
