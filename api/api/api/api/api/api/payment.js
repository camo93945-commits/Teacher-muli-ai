import {
  json,
  sb,
  deviceId,
  newDeviceCookie
} from './_lib.js';

export async function POST(req) {
  try {
    const body = await req.json();

    const reference = String(body.reference || '').trim();
    const amount = Number(body.amount || 10);

    if (!reference) {
      return json({
        ok: false,
        error: 'reference_required'
      }, 400);
    }

    if (amount !== 10) {
      return json({
        ok: false,
        error: 'invalid_amount'
      }, 400);
    }

    const id = deviceId(req) ||
      crypto.randomUUID();

    try {
      await sb(
        'tm_payment_requests',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            device_id: id,
            reference,
            amount: 10,
            status: 'PENDING'
          })
        }
      );
    } catch (e) {
      if (e.status === 409) {
        return json({
          ok: false,
          error: 'duplicate_reference'
        }, 409);
      }
      throw e;
    }

    return json(
      {
        ok: true,
        status: 'PENDING'
      },
      200,
      {
        'Set-Cookie': newDeviceCookie(id)
      }
    );

  } catch (e) {
    return json({
      ok: false,
      error:
        e.code === 'SUPABASE_TIMEOUT'
          ? 'supabase_timeout'
          : 'payment_failed',
      detail: e.message
    }, 500);
  }
}
