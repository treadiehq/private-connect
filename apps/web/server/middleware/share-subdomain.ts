const KNOWN_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'dashboard', 'hub', 'docs', 'blog',
  'help', 'support', 'status', 'mail', 'ftp', 'ssh', 'git', 'cdn',
  'static', 'assets', 'media', 'images', 'files', 'download', 'upload',
  'auth', 'login', 'logout', 'signup', 'register', 'account', 'settings',
  'billing', 'pricing', 'about', 'contact', 'terms', 'faq', 'changelog', 'roadmap', 'team', 'team-members', 'team-leader', 'privacy', 'legal',
  'doc', 'link', 'privateconnect', 'connect', 'cli'
];

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
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readRawBody(event) || undefined;
  }

  try {
    const response = await $fetch.raw(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
      responseType: 'arrayBuffer',
      timeout: 65000,
    });

    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        setResponseHeader(event, key, value);
      }
    }

    setResponseStatus(event, response.status);
    return response._data;
  } catch (err: any) {
    if (err?.response) {
      setResponseStatus(event, err.response.status || 502);
      return err.response._data || { error: 'Bad Gateway' };
    }
    setResponseStatus(event, 502);
    return { error: 'Bad Gateway', message: 'Could not reach the API server' };
  }
});
