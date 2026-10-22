import { analytics } from "@heycatch/sdk";

// Module scope, static import, no guards -- per HeyCatch's install guide,
// init is idempotent/no-op during SSR, and anything else here delays or
// skips tracking on some pages. The key is publishable (hck_pk_...), safe
// to inline per their own docs -- same category as a Stripe publishable
// key, not a secret.
analytics.init({
  projectKey: "hck_pk_tOsQs0Zq89tBJ9db21r7Efyk5LmE_u5T",
  install: {
    framework: "nextjs",
    frameworkVersion: "15",
    agent: "claude-code",
  },
});
