<div align="center">
    <img src="https://raw.githubusercontent.com/agentuity/sdk-js/main/.github/Agentuity.png" alt="Agentuity" width="100"/> <br/>
    <strong>Build Agents, Not Infrastructure</strong> <br/>
<br />
<a href="https://npm.im/@agentuity/sdk"><img alt="NPM version" src="https://img.shields.io/npm/v/%40agentuity%2Fsdk.svg"></a>
<a href="https://github.com/agentuity/sdk-js/blob/main/README.md"><img alt="License" src="https://badgen.now.sh/badge/license/Apache-2.0"></a>
<a href="https://discord.gg/vtn3hgUfuc"><img alt="Join the community on Discord" src="https://img.shields.io/discord/1332974865371758646.svg?style=flat"></a>
</div>
<br />

# Agentuity TypeScript SDK


**Visit [https://agentuity.com](https://agentuity.com) to get started with Agentuity.**




The Agentuity TypeScript SDK is a powerful toolkit for building, deploying, and managing AI agents in Node.js and Bun environments. This SDK provides developers with a comprehensive set of tools to create intelligent, event-driven agents that can process various types of content, communicate with each other, and integrate with external systems.

## Key Features

- **Multi-Agent Architecture**: Build and orchestrate multiple interconnected agents that can communicate and collaborate.
- **Event-Driven Design**: Respond to various triggers including webhooks, cron jobs, SMS, voice, email, and more.
- **Rich Content Handling**: Process and generate multiple content types including JSON, text, markdown, HTML, and binary formats (images, audio, PDFs).
- **Persistent Storage**: Built-in key-value and vector storage capabilities for maintaining state and performing semantic searches.
- **Observability**: Integrated OpenTelemetry support for comprehensive logging, metrics, and tracing.
- **Cross-Runtime Support**: Works seamlessly with both Node.js and Bun runtimes.

## Use Cases

- Building conversational AI systems
- Creating automated workflows with multiple specialized agents
- Developing content processing and generation pipelines
- Implementing intelligent data processing systems
- Building AI-powered APIs and services

## Getting Started

To use this SDK in a real project, you should install the Agentuity CLI.

### Mac OS

```bash
brew tap agentuity/tap && brew install agentuity
```

### Linux or Windows

See the [Agentuity CLI](https://github.com/agenuity/cli) repository for installation instructions and releases.

Once installed, you can create a new project with the following command:

```bash
agentuity new
```


## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v22 or higher)
- [Bun](https://bun.sh/docs/installation) (latest version recommended)
- [TypeScript](https://www.typescriptlang.org/download) (v5 or higher)

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/agenuity/sdk-js.git
cd sdk-js

# Install dependencies using Bun (recommended)
bun install

# Or using npm
npm install
```

### Building the SDK

```bash
# Using Bun (recommended)
bun run build

# Or using npm
npm run build
```

The build output will be in the `dist` directory.

### Testing

Run tests using Bun's built-in test runner:

```
bun test
```

## License

See the [LICENSE](LICENSE.md) file for details.
