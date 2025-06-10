# OpenCode Configuration

## Build/Test/Lint Commands
- **Build**: `npm run build` (uses tsup + tsc for types)
- **Test all**: `npm test` (runs all .test.ts files with bun)
- **Test single**: `bun test test/path/to/file.test.ts`
- **Lint**: `npm run lint` (biome with --write)
- **Format**: `npm run format` (biome format with --write)
- **Type check**: `npm run types` (tsc --emitDeclarationOnly)

## Code Style Guidelines
- **Formatter**: Biome with tabs (width 2), single quotes, semicolons, 80 char line width
- **Imports**: Use explicit imports, organize imports enabled, prefer relative paths for local modules
- **Types**: Strict TypeScript, use `type` for object shapes, `interface` for extensible contracts
- **Naming**: camelCase for variables/functions, PascalCase for classes/types, kebab-case for files
- **Error handling**: Use spans for tracing, `recordException()` for errors, throw meaningful messages
- **Async**: Prefer async/await, use AsyncLocalStorage for context, proper span management
- **Comments**: JSDoc for public APIs, minimal inline comments, focus on "why" not "what"
- **Exports**: Use named exports, barrel exports in index.ts, explicit re-exports
- **Testing**: Bun test framework, describe/it structure, beforeEach for setup, expect assertions