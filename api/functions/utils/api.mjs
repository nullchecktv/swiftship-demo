const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ORIGIN || '*',
};

export const formatResponse = (statusCode, body) => {
  return {
    statusCode,
    body: typeof body === 'string' ? JSON.stringify({ message: body }) : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  };
};

export const formatEmptyResponse = () => {
  return {
    statusCode: 204,
    headers: corsHeaders
  };
};

export const parseBody = (event) => {
  try {
    if (!event?.body) return {};
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return null;
  }
};

export const buildRequest = (event) => {
  const { rawPath, rawQueryString, headers, body, isBase64Encoded, requestContext } = event;
  const baseUrl = `https://${requestContext.domainName}`;
  const url = rawQueryString ? `${baseUrl}${rawPath}?${rawQueryString}` : `${baseUrl}${rawPath}`;
  const method = event.requestContext.http.method;

  let init = { method, headers };
  if (body) {
    init.body = isBase64Encoded ? Buffer.from(body, 'base64') : body;
  }

  return { request: new Request(url, init), baseUrl };
};
