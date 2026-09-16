-- The Stripe checkout/webhook integration was never wired to the live
-- billing UI (customer/billing pages use Razorpay + manual payments via
-- customer_subscriptions, not these tables) and has been removed from
-- the codebase. billing_plans stays: it's the shared plan catalog used
-- by both the old Stripe design and the active customer_subscriptions
-- system.
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS account_subscriptions;
