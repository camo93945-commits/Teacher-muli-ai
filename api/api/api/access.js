import { json, sb, deviceId } from './_lib.js';

export async function GET(req) {
  try {
    const id = deviceId(req);

    if (!id) {
      return json({
        approved: false,
        status: 'LOCKED',
        accessUntil: '1970-01-01T00:00:00Z',
        pending: false
      });
    }

    const rows = await sb(
      'tm_access?device_id=eq.' +
      encodeURIComponent(id) +
      '&select=status,access_until&limit=1'
    );

    const a = rows[0] || {
      status: 'LOCKED',
      access_until: '1970-01-01T00:00:00Z'
    };

    const approved =
      a.status === 'APPROVED' &&
      new Date(a.access_until) > new Date();

    if (approved) {
      return json({
        approved: true,
        status: 'APPROVED',
        accessUntil: a.access_until,
        pending: false
      });
    }

    const pendingRows = await sb(
      'tm_payment_requests?device_id=eq.' +
      encodeURIComponent(id) +
      '&status=eq.PENDING&select=id&limit=1'
    );

    const pending =
      Array.isArray(pendingRows) && pendingRows.length > 0;

    return json({
      approved: false,
      status: pending ? 'PAYMENT_PENDING' : 'LOCKED',
      accessUntil: a.access_until,
      pending
    });

  } catch (e) {
    return json({
      approved: false,
      status: 'LOCKED',
      pending: false,
      error:
        e.code === 'SUPABASE_TIMEOUT'
          ? 'access_check_timeout'
          : 'access_check_failed',
      detail: e.message
    }, 500);
  }
}
