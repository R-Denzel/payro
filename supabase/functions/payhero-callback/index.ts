import { createClient } from "npm:@supabase/supabase-js@2";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";

type PayHeroCallback = {
  status?: boolean;
  response?: {
    Amount?: number | string;
    CheckoutRequestID?: string;
    ExternalReference?: string;
    MpesaReceiptNumber?: string;
    ResultCode?: number | string;
    Status?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const callbackSecret = Deno.env.get("PAYHERO_CALLBACK_SECRET");
  const suppliedSecret = new URL(req.url).searchParams.get("token");
  if (!callbackSecret || !suppliedSecret || suppliedSecret !== callbackSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = supabaseSecretKey();
  if (!supabaseUrl || !serviceKey) return new Response("Server not configured", { status: 503 });

  let payload: PayHeroCallback;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const response = payload.response;
  const externalReference = response?.ExternalReference;
  if (!externalReference) return new Response("Missing external reference", { status: 400 });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const successful = response?.Status?.toLowerCase() === "success"
    && Number(response.ResultCode) === 0
    && payload.status === true;

  if (!successful) {
    const isCancelled = response?.Status?.toLowerCase() === "cancelled"
      || response?.Status?.toLowerCase() === "canceled";
    await admin
      .from("payments")
      .update({ status: isCancelled ? "cancelled" : "failed" })
      .eq("payhero_external_reference", externalReference)
      .eq("status", "pending");
    return new Response("Callback received", { status: 200 });
  }

  const amount = Number(response.Amount);
  const receipt = response.MpesaReceiptNumber;
  if (!Number.isFinite(amount) || amount <= 0 || !receipt) {
    return new Response("Incomplete successful payment callback", { status: 400 });
  }

  const { data: completed, error } = await admin.rpc("complete_payhero_payment", {
    _external_reference: externalReference,
    _amount_cents: Math.round(amount * 100),
    _receipt: receipt,
    _checkout_request_id: response.CheckoutRequestID ?? null,
  });
  if (error) {
    console.error("Could not complete PayHero payment", error.message);
    return new Response("Payment confirmation could not be saved", { status: 500 });
  }
  if (!completed) return new Response("Payment reference or amount did not match", { status: 409 });

  return new Response("Payment confirmed", { status: 200 });
});
