export async function onRequest(context) {
  try {
    const target = "https://ecd-resource-hub.hinaamin-khowaja.workers.dev/api/health";
    const response = await fetch(target, {
      method: context.request.method,
      headers: context.request.headers,
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Pages could not reach the API Worker." },
      { status: 502 }
    );
  }
}
