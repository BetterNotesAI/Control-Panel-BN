import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}
