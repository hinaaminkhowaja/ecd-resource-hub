import { handleApi } from "../../worker/index.js";

export async function onRequest(context) {
  try {
    return await handleApi(context.request, context.env);
  } catch (error) {
    console.error("ECD Resource Hub Pages API failed:", error);
    return new Response(JSON.stringify({
      error: "The service could not complete this request."
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}
