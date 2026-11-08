import { DEFAULT_SUBSCRIPTION_PLANS, subscriptionService } from '../lib/services/subscription.service';

export function runSubscriptionEngineTests() {
  console.log('=== TEST SUITE: CLICKDRIVE SUBSCRIPTION MONETIZATION ENGINE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- 1. TIER CAPACITY PLANS ---
  console.log('--- 1. Paliers de Capacité Flotte ---');
  assert(DEFAULT_SUBSCRIPTION_PLANS.length === 4, '4 forfaits standards configurés');

  const starter = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'starter');
  assert(starter !== undefined, 'Forfait Starter existe');
  assert(starter?.max_vehicles === 15, 'Starter max 15 véhicules');
  assert(starter?.price_monthly === 300, 'Starter 300 MAD / mois');

  const pro = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'pro');
  assert(pro?.max_vehicles === 25, 'Pro max 25 véhicules');
  assert(pro?.price_monthly === 400, 'Pro 400 MAD / mois');

  const business = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'business');
  assert(business?.max_vehicles === 35, 'Business max 35 véhicules');
  assert(business?.price_monthly === 500, 'Business 500 MAD / mois');

  const unlimited = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'unlimited');
  assert(unlimited?.max_vehicles === 45, 'Premium max 45 véhicules');
  assert(unlimited?.price_monthly === 600, 'Premium 600 MAD / mois');

  // --- 2. AUTOMATIC TIER DETERMINATION ---
  console.log('\n--- 2. Attribution Automatique de Palier ---');
  assert(subscriptionService.findPlanForCount(5).slug === 'starter', '5 véhicules -> Starter');
  assert(subscriptionService.findPlanForCount(15).slug === 'starter', '15 véhicules -> Starter');
  assert(subscriptionService.findPlanForCount(16).slug === 'pro', '16 véhicules -> Pro');
  assert(subscriptionService.findPlanForCount(25).slug === 'pro', '25 véhicules -> Pro');
  assert(subscriptionService.findPlanForCount(26).slug === 'business', '26 véhicules -> Business');
  assert(subscriptionService.findPlanForCount(35).slug === 'business', '35 véhicules -> Business');
  assert(subscriptionService.findPlanForCount(36).slug === 'unlimited', '36 véhicules -> Premium');
  assert(subscriptionService.findPlanForCount(45).slug === 'unlimited', '45 véhicules -> Premium');

  console.log(`\n========================================`);
  console.log(`RÉSULTAT: ${passed} passés, ${failed} échoués`);
  console.log(`========================================\n`);

  return failed === 0;
}

runSubscriptionEngineTests();
