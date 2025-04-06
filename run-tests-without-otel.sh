export SKIP_OTEL_TESTS=true
bun test --timeout 5000 test/apis test/logger test/router test/server
