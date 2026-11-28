import { handleApi } from "../../worker/index.js";

export async function onRequest(context) {
  try {
    return await handleApi(context.request, context.env);
  } catch (error) {
    console.error("ECD Resource Hub health route failed:", error);
    return Response.json(
      { ok: false, error: "Pages API health check failed." },
      { status: 500 }
    );
  }
}
