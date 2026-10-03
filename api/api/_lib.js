function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function supabase() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function sb(path, opts = {}, timeoutMs = 8000) {
  const { url, key } = supabase();

  if (!url || !key) {
    throw Object.assign(
      new Error("Supabase environment variables are not configured"),
      { code: "ENV_MISSING" }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url + "/rest/v1/" + path, {
      ...opts,
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });

    const text = await r.text();
    let data;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!r.ok) {
      throw Object.assign(
        new Error("Supabase request failed"),
        { status: r.status, detail: data }
      );
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw Object.assign(
        new Error("Supabase request timed out"),
        { code: "SUPABASE_TIMEOUT" }
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function deviceId(req) {
  const c = req.headers.get("cookie") || "";
  const m = c.match(/(?:^|;\s*)tm_device=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function newDeviceCookie(id) {
  return `tm_device=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

export { json, supabase, sb, deviceId, newDeviceCookie };
