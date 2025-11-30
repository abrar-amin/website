export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = context.params.path.join('/');

  // Proxy to your backend server
  const backendUrl = `http://34.172.84.37:5000/api/${path}`;

  const response = await fetch(backendUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      'Access-Control-Allow-Origin': '*',
    },
  });
}
