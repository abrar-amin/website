export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Extract the path after /api/
  const path = context.params.path ? context.params.path.join('/') : '';

  const backendUrl = `http://34.172.84.37:5000/api/${path}${url.search}`;

  try {
    const response = await fetch(backendUrl, {
      method: context.request.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: context.request.method !== 'GET' && context.request.method !== 'HEAD'
        ? await context.request.text()
        : undefined,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
