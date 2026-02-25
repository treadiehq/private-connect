const KNOWN_SUBDOMAINS = ['api', 'www', 'link', 'app', 'mail', 'admin', 'docs', 'blog', 'help', 'support', 'status', 'doc', 'dashboard'];

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || '';
  const baseDomain = process.env.BASE_DOMAIN || 'privateconnect.co';

  const regex = new RegExp(`^([^.]+)\\.${baseDomain.replace(/\./g, '\\.')}$`);
  const match = host.match(regex);
  if (!match) return;

  const subdomain = match[1];
  if (KNOWN_SUBDOMAINS.includes(subdomain.toLowerCase())) return;

  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl || 'http://localhost:3001';

  const url = getRequestURL(event);
  const path = url.pathname;
  const queryString = url.search || '';
  const targetUrl = `${apiUrl}/shared/${subdomain}${path}${queryString}`;

  const headers: Record<string, string> = {};
  const incomingHeaders = getHeaders(event);
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (value && !['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  const method = event.method;
  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = await readRawBody(event, false);
    if (raw) {
      body = typeof raw === 'string' ? new TextEncoder().encode(raw).buffer : raw;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body ? new Uint8Array(body as ArrayBuffer) : undefined,
      redirect: 'manual',
    });

    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        setResponseHeader(event, key, value);
      }
    }

    setResponseStatus(event, response.status);

    const responseBuffer = await response.arrayBuffer();
    return new Uint8Array(responseBuffer);
  } catch (err: any) {
    setResponseStatus(event, 502);
    return { error: 'Bad Gateway', message: 'Could not reach the API server' };
  }
});
