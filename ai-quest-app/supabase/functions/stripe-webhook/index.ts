// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (request) => {
  const signature = request.headers.get('Stripe-Signature');

  if (!signature) {
    return new Response('No signature provided', { status: 400 });
  }

  try {
    const body = await request.text();
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string;

    // Verify the webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        endpointSecret,
        undefined,
        cryptoProvider
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // We passed the Supabase user ID in the client_reference_id field during checkout
      const userId = session.client_reference_id;

      if (userId) {
        // Initialize Supabase admin client to bypass RLS and update user metadata
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        console.log(`Processing upgrade for user: ${userId}`);

        // Update the user's app_metadata (secure, not user-modifiable) to set is_pro to true
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { app_metadata: { is_pro: true, pro_since: new Date().toISOString() } }
        );

        if (error) {
          console.error(`Error updating user to PRO: ${error.message}`);
          return new Response(`Error updating user: ${error.message}`, { status: 500 });
        }

        console.log(`Successfully upgraded user ${userId} to PRO.`);
      } else {
        console.warn('Checkout completed but no client_reference_id (userId) was found.');
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(`Unexpected error: ${err.message}`);
    return new Response(`Server Error`, { status: 500 });
  }
})
