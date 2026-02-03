# Current Intent

> Updated: 2026-02-03

## Active Focus

Improving checkout conversion rate. Current: 2.1%, Target: 3.5%

### Hypothesis
Cart abandonment is high due to:
1. Slow loading payment form (3s+ LCP)
2. No guest checkout option visible
3. Shipping cost surprise at final step

## This Week

- [ ] Lazy load Stripe Elements
- [ ] Add "Guest Checkout" button above login form
- [ ] Show shipping estimate on cart page

## Recent Changes

- ✅ Migrated from Stripe Checkout to Stripe Elements (more control)
- ✅ Added cart persistence across sessions
- ⚠️ Known issue: inventory check slow for carts > 10 items

## Context for AI

When working on checkout:
- Payment logic is in `/composables/usePayment.ts`
- Cart state is in `/stores/cart.ts`  
- The old checkout flow is still at `/pages/checkout-old.vue` (reference only)
- Stripe keys are in env vars, never hardcode

## Questions to Resolve

- Should we show saved cards for logged-in users?
- How to handle partial inventory (some items available)?
- Apple Pay / Google Pay priority?
