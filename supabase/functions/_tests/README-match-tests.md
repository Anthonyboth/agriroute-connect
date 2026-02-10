# Match Feed Integration Tests

## How to Run

```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Run tests
deno test --allow-all supabase/functions/_tests/match-feed.test.ts
```

## What is tested (Scenarios A-G)

| Scenario | Description |
|----------|-------------|
| A | Driver sees only in-scope freights (city match, status=OPEN) |
| B | Provider sees only compatible services (type + radius ≤300km) |
| C | Deduplication: 2nd call excludes exposed items (match_exposures TTL) |
| D | ACCEPTED exposure permanently removes item from feed |
| E | RLS isolation: cross-user/cross-role access blocked |
| F | Company (TRANSPORTADORA) feed via edge function |
| G | Debug logs: coherent stats, capped samples, no PII, RLS |

## Seed Data

- **Cities**: Goiânia/GO, Anápolis/GO (~55km), Uberlândia/MG (~340km)
- **Users**: driver1 (Goiânia), driver2 (Uberlândia), provider1 (Goiânia), company1, producer1
- **Freights**: 4 (in-scope, wrong-type, outside-radius, cancelled)
- **Services**: 4 (in-scope, wrong-type, outside-radius, completed)

Seed is idempotent and cleanup runs at the end.
