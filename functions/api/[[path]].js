export async function onRequest(context) {
  const workerUrl = "https://ecd-resource-hub.hinaamin-khowaja.workers.dev";

  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(
    incomingUrl.pathname + incomingUrl.search,
    workerUrl
  );

  const response = await fetch(
    new Request(targetUrl, context.request)
  );

  return response;
}
