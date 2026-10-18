# Development provider disabled in production

The `development` payment adapter is local-only. In a production build it is
disabled unless `OBH_ENABLE_DEVELOPMENT_PROVIDER=true` is explicitly set.

Do not enable it for real customer-facing payments. It does not contact a payment
network, does not move money, and its checkout only simulates a provider result.

To use it in an approved test environment:

```bash
OBH_ENABLE_DEVELOPMENT_PROVIDER=true
APP_URL=https://your-test-obh-host
```

All payments remain `TEST` and are visibly labeled as simulated.
