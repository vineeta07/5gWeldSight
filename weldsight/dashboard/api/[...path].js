export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const apiPath = url.pathname; // e.g. /api/health
  const backendUrl = `https://weldsight-api-6g.loca.lt${apiPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Bypass-Tunnel-Reminder', 'true');
  headers.delete('host');

  try {
    const resp = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      duplex: 'half',
    });

    const responseHeaders = new Headers(resp.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Backend unreachable', detail: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
