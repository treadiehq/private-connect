export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl || 'http://localhost:3001';

  const slug = event.context.params?.slug || '';
  const targetPath = `/w/${slug}`;

  const query = getQuery(event);
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  const fullPath = queryString ? `${targetPath}?${queryString}` : targetPath;

  const headers: Record<string, string> = {};
  const incomingHeaders = getHeaders(event);
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (value && !['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  const method = event.method;
  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = Buffer.from(await readRawBody(event) || '');
  }

  try {
    const response = await $fetch.raw(`${apiUrl}${fullPath}`, {
      method,
      headers,
      body,
      redirect: 'manual',
      // @ts-expect-error - responseType raw returns buffer
      responseType: 'arrayBuffer',
    });

    const status = response.status;

    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        setResponseHeader(event, key, value);
      }
    }

    setResponseStatus(event, status);
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
