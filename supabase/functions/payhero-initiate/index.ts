import { createClient } from "npm:@supabase/supabase-js@2";
import { supabasePublishableKey, supabaseSecretKey } from "../_shared/supabase-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Sign in to request an M-Pesa payment." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = supabasePublishableKey();
  const serviceKey = supabaseSecretKey();
  const payheroAuthorization = Deno.env.get("PAYHERO_AUTHORIZATION");
  const callbackSecret = Deno.env.get("PAYHERO_CALLBACK_SECRET");
  if (!supabaseUrl || !anonKey || !serviceKey || !payheroAuthorization || !callbackSecret) {
    return json({ error: "PayHero payments are not configured yet." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Your sign in has expired. Sign in again." }, 401);

  let body: { participantId?: unknown; phoneNumber?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof body.participantId !== "string" || typeof body.phoneNumber !== "string") {
    return json({ error: "Enter the share and M-Pesa phone number." }, 400);
  }

  const phoneDigits = body.phoneNumber.replace(/[\s()-]/g, "");
  const kenyaPhone = phoneDigits.match(/^(?:\+?254|0)?([17]\d{8})$/)?.[1];
  if (!kenyaPhone) return json({ error: "Enter a valid Kenyan mobile number, such as 0712345678." }, 400);
  const phoneNumber = `0${kenyaPhone}`;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: participant, error: participantError } = await admin
    .from("expense_participants")
    .select(
      "id,user_id,amount_due_cents,amount_paid_cents,expenses!inner(id,merchant,currency,restaurant_id,restaurants!inner(status,payhero_channel_id))",
    )
    .eq("id", body.participantId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (participantError) return json({ error: "Could not load this bill. Please try again." }, 500);
  if (!participant) return json({ error: "This share is not assigned to your account." }, 403);

  const expense = Array.isArray(participant.expenses) ? participant.expenses[0] : participant.expenses;
  const restaurant = expense && Array.isArray(expense.restaurants) ? expense.restaurants[0] : expense?.restaurants;
  if (!expense?.restaurant_id || restaurant?.status !== "approved") {
    return json({ error: "PayHero is only available for approved restaurant bills." }, 400);
  }
  const channelId = Number(restaurant.payhero_channel_id);
  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    return json({ error: "This restaurant has not finished setting up its PayHero Till or Paybill." }, 409);
  }
  if (expense.currency !== "KES") return json({ error: "PayHero M-Pesa payments are currently available for KES bills." }, 400);

  const amountCents = Number(participant.amount_due_cents) - Number(participant.amount_paid_cents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return json({ error: "This share has no remaining balance." }, 409);
  }
  if (amountCents % 100 !== 0) {
    return json({ error: "M-Pesa STK Push accepts whole-shilling amounts. Ask the restaurant to adjust this bill share." }, 400);
  }

  const { data: pendingPayment, error: pendingError } = await admin
    .from("payments")
    .select("id")
    .eq("participant_id", participant.id)
    .eq("status", "pending")
    .not("payhero_external_reference", "is", null)
    .maybeSingle();
  if (pendingError) return json({ error: "Could not check for an existing payment request." }, 500);
  if (pendingPayment) return json({ error: "A payment prompt is already pending for this share. Wait for its confirmation before trying again." }, 409);

  const externalReference = `PAYRO-${crypto.randomUUID()}`;
  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      expense_id: expense.id,
      participant_id: participant.id,
      payer_id: authData.user.id,
      amount_cents: amountCents,
      currency: "KES",
      provider: "mpesa",
      idempotency_key: crypto.randomUUID(),
      payhero_external_reference: externalReference,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    if (insertError?.code === "23505") {
      return json({ error: "A payment prompt is already pending for this share." }, 409);
    }
    return json({ error: "Could not start the payment. Please try again." }, 500);
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/payhero-callback?token=${encodeURIComponent(callbackSecret)}`;
  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: {
        Authorization: payheroAuthorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents / 100,
        phone_number: phoneNumber,
        channel_id: channelId,
        provider: "m-pesa",
        external_reference: externalReference,
        customer_name: authData.user.user_metadata?.full_name ?? undefined,
        callback_url: callbackUrl,
      }),
    });
  } catch {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    return json({ error: "PayHero could not be reached. No payment prompt was sent." }, 502);
  }

  const result = await providerResponse.json().catch(() => null);
  const checkoutRequestId = result?.CheckoutRequestID ?? result?.checkout_request_id ?? null;
  if (!providerResponse.ok || result?.success === false || !checkoutRequestId) {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    return json({ error: "PayHero did not accept the payment request. Please check the number and try again." }, 502);
  }

  // The callback may arrive before this update, so this only stores PayHero's request ID.
  await admin
    .from("payments")
    .update({ payhero_checkout_request_id: String(checkoutRequestId) })
    .eq("id", payment.id);

  return json({ paymentId: payment.id, status: "pending" }, 202);
});
