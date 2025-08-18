## Testing local SDK changes with Bun link

Use Bun's linking to point your agent app at a local build of this SDK (useful for testing a PR branch before publish).

### 1) In the SDK repo (this PR checkout)

```bash
# Bun
bun install
bun run build
bun link

# npm
npm install
npm run build
npm link
```

### 2) In your agent app repo

```bash
# Bun
bun remove @agentuity/sdk || true
bun link @agentuity/sdk

# npm
npm uninstall @agentuity/sdk || true
npm link @agentuity/sdk
```

### 3) Verify the link

```bash
# generic check
ls -l node_modules/@agentuity/sdk

# Bun
bun pm ls | grep "@agentuity/sdk"

# npm
npm ls | grep "@agentuity/sdk"
```

### 4) Iterate

- Make changes in the SDK, then rebuild: `bun run build` or `npm run build`
- Restart your agent app if it doesn't hot-reload. The app will consume the new `dist/` output.

### 5) Deploy

- Run your normal deploy flow for the agent app. It will use the linked SDK.

### 6) Unlink (when done)

```bash
# in your agent app repo
# Bun
bun unlink @agentuity/sdk
# npm
npm unlink @agentuity/sdk

# in the SDK repo to remove global link registration
# Bun
bun unlink
# npm
npm unlink
```

