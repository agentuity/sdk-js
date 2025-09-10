# Agentuity SDK - Agent Instructions

## Build/Test/Lint Commands
- **Build**: `npm run build` (runs tsup + types generation)
- **Test**: `npm test` (runs all tests) | `bun test <file>` (single test)
- **Lint**: `npm run lint` (Biome linter with auto-fix)
- **Format**: `npm run format` (Biome formatter)

## Architecture & Structure
- **Entry Point**: `src/index.ts` exports server, logger, types, APIs
- **Core APIs**: `src/apis/` (email, discord, keyvalue, vector, objectstore)
- **Server**: `src/server/` (server.ts, bun.ts, node.ts, agents.ts)
- **Router**: `src/router/` (request/response handling, streaming)
- **I/O Handlers**: `src/io/` (Discord, Slack, Email, SMS, Telegram)
- **Infrastructure**: `src/logger/`, `src/otel/` (OpenTelemetry)
- **Tests**: Mirror source structure in `test/`

## Code Style Guidelines
- **Runtime**: Node.js ≥22, Bun support, ESM modules
- **Types**: Strict TypeScript, prefer `unknown` over `any`
- **Imports**: Use relative imports, organize imports enabled
- **Formatting**: Tabs (2-width), 80 char line length, single quotes
- **Conventions**: camelCase variables, PascalCase classes/interfaces
- **Error Handling**: Use proper Error types, avoid throwing strings
- **Linting**: Biome with recommended rules, template literals over concatenation


## More detailed docs
- [Creating new IO](./docs/adding-new-io.md)
- [Local SDK testing](./docs/testing-local-sdk.md)