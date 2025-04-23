# @agentuity/sdk

## 0.0.103

### Patch Changes

- 9f79163: Refactor to support binary streams instead of intermediate JSON protocol (#81)
  - Improved handling of HTTP native protocol
  - Added support for passing in the runId
  - Better handling of stream data and binary content

## [0.0.102] - 2025-04-16

### Fixed

- Fix issue where the child span had the wrong parent on outbound requests for agent-to-agent ([#79](https://github.com/agentuity/sdk-js/pull/79))

## [0.0.101] - 2025-04-18

### Added

- Add agent context to console logger when running inside agent scope ([#77](https://github.com/agentuity/sdk-js/pull/77))

## [0.0.100] - 2025-04-15

### Added

- Add permissions ([5fbda32](https://github.com/agentuity/sdk-js/commit/5fbda32))

### Changed

- Add more otel trace context headers, remove old trace provider ([#72](https://github.com/agentuity/sdk-js/pull/72))
- Automatically base64 encode welcome prompts ([#73](https://github.com/agentuity/sdk-js/pull/73))

### Fixed

- Fix NodeJS issue where the buffer isn't correctly sending the blob but works fine in Bun version (doesn't support a buffer view, switched to blob) ([#74](https://github.com/agentuity/sdk-js/pull/74))
- Debug github workflow git tag issue

## 0.0.99

### Patch Changes

- More debug for github workflow

## 0.0.98

### Patch Changes

- More debug for github release tags

## 0.0.97

### Patch Changes

- 0bd3fff: Attempt to fix issue with github workflow not pushing tag after release

## 0.0.96

### Patch Changes

- a5bafb7: Fix issue with node keyvalue not correctly handling the buffer upload

## 0.0.95

### Patch Changes

- 361ab69: Add more otel trace context headers, remove old trace provider
- 1b9f047: Base64 encode the welcome prompts

## 0.0.94

### Patch Changes

- addda11: Fix regression in otel traces missing for AI SDK by change in opentelemetry-api version change

## 0.0.93

### Patch Changes

- 8220ae0: Add support for agent inspection discovery

## 0.0.92

### Patch Changes

- b41dcc8: Add data and markdown methods to AgentResponse interface and implementation

## 0.0.91

### Patch Changes

- Use new agentuity sdk api
- 3869d0d: Add GitHub workflow for npm package release triggered by version tags

## 0.0.90

### Patch Changes

- Fix Vector delete api

# Changelog

All notable changes to this project will be documented in this file.

## [0.0.89] - 2025-03-25

### Added

- Add the agentName to the log attributes ([#33](https://github.com/agentuity/sdk-js/pull/33))

### Changed

- Console Logger: show max depth for any objects ([#32](https://github.com/agentuity/sdk-js/pull/32))
- When stream is requested but the response isn't a stream, chunk up the response data into chunks and smooth out as if streamed ([#31](https://github.com/agentuity/sdk-js/pull/31))

### Fixed

- Fixed issue with buffer underrun getting sent and issue with json encoding ([#34](https://github.com/agentuity/sdk-js/pull/34))

## [0.0.88] - 2025-03-21

### Patch Changes

- b09c469: Improve loading project when using node or bun directly vs using start script or agentuity dev
- Fix mismatch between local run vs remote run with HTTP headers as property of metadata vs the metadata object

## [0.0.87] - 2025-03-18

### Patch Changes

- Slight improvement in location of when context.logger for agent is created

## [0.0.86] - 2025-03-16

### Patch Changes

- Add support for agentId on context.logger
  Fix issue with underrun on base64 stream

## [0.0.85] - 2025-03-15

### Patch Changes

- Streaming Support including SSE

## [0.0.84] - 2025-03-14

### Added

- Stream IO Input: add new facility to support stream io for input data [#23](https://github.com/agentuity/sdk-js/pull/23)

### Patch Changes

- Release with new transport model

## [0.0.83] - 2025-03-10

### Patch Changes

- Fix devmode logging when devmode environment is set by live

## [0.0.82] - 2025-03-08

### Patch Changes

- KeyValue compression only on upload, not download

## [0.0.81] - 2025-03-06

### Patch Changes

- Add support for compressing keyvalue entries

## [0.0.80] - 2025-03-04

### Patch Changes

- Refactor the types to make it easier to use and fix a number of other small issues

## [0.0.79] - 2025-03-02

### Patch Changes

- Add agent information on root HTTP span

## [0.0.78] - 2025-02-28

### Patch Changes

- Fixed issue with Vector delete

## [0.0.77] - 2025-02-26

### Patch Changes

- Expose public run route for HTTP server for local testing

## [0.0.76] - 2025-02-24

### Patch Changes

- Removed unused package
  AgentRequest metadata is now a getter
  AgentRequest metadata() is not get()
  Fixed issue with local agent-to-agent serialization

## [0.0.75] - 2025-02-22

### Patch Changes

- Improve handling for request text()

## [0.0.74] - 2025-02-20

### Patch Changes

- Fixed issue with local agent-to-agent routing

## [0.0.73] - 2025-02-18

### Patch Changes

- - Fix issue where logs wouldn't show up in console
  - Fix issue where the gray color for debug in log
  - Print debug message when connected to cloud

## [0.0.72] - 2025-02-16

### Patch Changes

- Fix issue with non-otel logging causing issues

## [0.0.71] - 2025-02-14

### Patch Changes

- Make sure we check correctness of incoming HTTP request before continuing

## [0.0.70] - 2025-02-12

### Patch Changes

- fix issue with composite tracer, use a safe JSON stringify

## [0.0.69] - 2025-02-10

### Patch Changes

- A fixes to make sure the logger cannot get into an infinite recursion loop and cleanup some safety around logging

## [0.0.68] - 2025-02-08

### Patch Changes

- Add more work around otel trace propagation

## [0.0.67] - 2025-02-06

### Patch Changes

- Fix error on otel

## [0.0.66] - 2025-02-04

### Patch Changes

- Add an additional key for the object stored in Vector Storage so we have something to display to the user in the console

## [0.0.65] - 2025-02-02

### Patch Changes

- Reworks moving IO out of the configuration and into the API. Reworks agent routing to require an explicit Agent ID

## [0.0.64] - 2025-01-31

### Patch Changes

- Add fetch instrumentation
- Add otel trace propagation
- Monkey patch console to redirect into otel logger
- More improvements on bundling JS
- Handle direct return from agent run in case you don't return correct signature
- Set the span status on completion for agent run
- Add cli version to trace context
- More work on agent-to-agent remote comms

## [0.0.63] - 2025-01-29

### Patch Changes

- Add hostmetrics to otel collection

## [0.0.62] - 2025-01-27

### Patch Changes

- Allow the content type to be set on redirect and make sure we prefer the overriden payload

## [0.0.61] - 2025-01-25

### Patch Changes

- Add the mechanics for agent-to-agent communication

## [0.0.60] - 2025-01-23

### Patch Changes

- Add SDK version to various places and improve local dev

## [0.0.59] - 2025-01-21

### Patch Changes

- Improve error logging. Don't log the same error multiple times.

## [0.0.58] - 2025-01-19

### Patch Changes

- Revert a stupid incorrect change that Cursor made!!!

## [0.0.57] - 2025-01-17

### Patch Changes

- - Fixed issue where the contentType wasnt correctly returning on the assertion
  - Tighten up tsconfig unused import rule and remove unused import
  - Add unique agentId calculation and put in context and trace attributes for better linkage

## [0.0.56] - 2025-01-15

### Patch Changes

- Fixed issue with request payload not getting base64 decoded

## [0.0.55] - 2025-01-13

### Patch Changes

- Switch to use HTTP for otel

## [0.0.54] - 2025-01-11

### Patch Changes

- Expose auth header for OTLP and set more attributes

## [0.0.53] - 2025-01-09

### Patch Changes

- Adds support for bearer authorization and adds additional resource information

## [0.0.52] - 2025-01-07

### Patch Changes

- Add support for a health endpoint

## [0.0.51] - 2025-01-05

### Patch Changes

- Fixing automation around publishing

## [0.0.50] - 2025-01-03

### Patch Changes

- More build and publish changes

## [0.0.49] - 2025-01-01

### Patch Changes

- be86f59: more publish changes

## [0.0.48] - 2024-12-30

### Patch Changes

- Refactor the JS SDK to better support new workflow
