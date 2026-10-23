# PayHero setup for restaurant payments

This integration requests an M-Pesa STK Push from an approved restaurant bill and marks the share paid only after PayHero calls the callback function. The collection uses the restaurant's PayHero `channel_id`, so settlement should go to that channel's Till or Paybill.

## Before enabling live payments

PayHero's public API documentation requires a registered `channel_id` for each collection, but does not clearly document whether one Payro PayHero account can register channels belonging to many different restaurant businesses. Confirm this with PayHero before using live restaurant channels. Also ask PayHero which webhook verification method they recommend; their published callback example does not document a request signature.

## Database

1. Confirm the base schema, app functions, and restaurant portal schema are already installed.
2. Run `01_restaurant_session_bills.sql` so published restaurant bills are allocated as whole KES shares.
3. Run `03_payhero_restaurant_payments.sql` to add restaurant channel IDs and PayHero transaction references, restrict self-reported restaurant M-Pesa payments, and add the atomic callback confirmation function.
4. After PayHero verifies the restaurant channel, set that restaurant's channel ID in `public.restaurants.payhero_channel_id`. Do not let a restaurant select another merchant's channel.

The channel assignment looks like this; replace both values with the verified channel ID and restaurant UUID:

```sql
update public.restaurants
set payhero_channel_id = 133
where id = '00000000-0000-0000-0000-000000000000'
  and status = 'approved';
```

## Edge Function secrets and deployment

In Supabase Dashboard → Edge Functions → Secrets, add:

- `PAYHERO_AUTHORIZATION`: the PayHero API key in the request-header form, for example `Basic <your token>`.
- `PAYHERO_CALLBACK_SECRET`: a long random secret unique to this project. Do not put it in the frontend or commit it.

Supabase supplies the project URL and API keys to Edge Functions. Deploy both functions from the repository root after linking the Supabase CLI to the Payro project:

```sh
supabase functions deploy payhero-initiate
supabase functions deploy payhero-callback
```

The initiate function requires a signed-in user and verifies that the share belongs to them. The callback function uses the callback secret, external reference, amount, receipt, and an atomic database function before confirming a payment. Pending requests do not count toward the restaurant bill total.

## Current payment limits

PayHero's M-Pesa STK Push endpoint expects integer KES amounts. Restaurant bill totals must therefore be whole shillings; when an equal split does not divide evenly, a few guests receive a one-shilling difference so every share remains payable.
