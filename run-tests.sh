export SKIP_OTEL_TESTS=true
bun test --timeout 5000 --pattern "!(otel)/**/*.test.ts"
