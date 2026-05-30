import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Returns a Stripe client, or null if STRIPE_SECRET_KEY is not set. */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}
