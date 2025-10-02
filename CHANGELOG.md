# @agentuity/sdk Changelog

## [0.0.148]

### Patch Changes

- added experimental support for prompts ([#184](https://github.com/agentuity/sdk-js/pull/184))

## [0.0.147]

### Patch Changes

- 96f5561: - Added support for automatic stream compression ([#186](https://github.com/agentuity/sdk-js/pull/186))
  - Added support for direct write to Stream in addition to getWriter()
  - Added property `bytesWritten` to the Stream interface which represents the number of bytes written to the stream
  - Added property `compressed` to the Stream interface which represents if the stream has compression enabled
- 9928a32: Remove the explicit Content-Type header for application/json in send (internal) to allow each service caller to properly set ([#185](https://github.com/agentuity/sdk-js/pull/185))

## [0.0.146]

### Patch Changes

- 5ff39a8: Changes for waitUntil and low-level streams support ([#182](https://github.com/agentuity/sdk-js/pull/182))
- 60cf45a: Stream improvements - adds the ability to getReader() to return a reader for the Stream, immediately schedules tasks sent to context.waitUntil instead of waiting until the response is returned, and adds the ability to return a Stream directly from an Agent handler with automatic 302 redirect ([#181](https://github.com/agentuity/sdk-js/pull/181))
- f4e9154: Add streams as first class context API ([#180](https://github.com/agentuity/sdk-js/pull/180))
- 4611143: Add support for context.waitUntil to be able to run background processing without blocking the response ([#179](https://github.com/agentuity/sdk-js/pull/179))
- a2257f2: Fix fetch function issues with streaming - fixed issue where fetch would error in certain environments with error around keepalive not being defined ([#178](https://github.com/agentuity/sdk-js/pull/178))
- 0cd808f: Fix spelling errors in link and repository information ([#177](https://github.com/agentuity/sdk-js/pull/177))
- 11c64cd: Update changelog formatting for v0.0.145 ([#175](https://github.com/agentuity/sdk-js/pull/175))

## 0.0.145

### Patch Changes

- 25bb67d: Fix malformed From headers in email replies that caused parsing errors in backend ([#174](https://github.com/agentuity/sdk-js/pull/174))

## 0.0.144

### Patch Changes

- Issues between streaming for node and bun and keep alive differences

## 0.0.143

### Patch Changes

- c9e094b: Use traceloop for otel for consistency across Python and TS SDK's

## 0.0.142

### Patch Changes

- Some APIs like object store were timing out after 20s with a large document upload. Remove the premature timeout

## 0.0.141

### Patch Changes

- 7013333: Restructured slack IO and payloads.
- 4654067: Fix email attachment parsing for Slack-formatted filenames
- 654cfc1: Use sessionId instead of runId for AgentContext to better align with how we reference it.

## 0.0.140

### Fixed

- Fix cloud runs for teams agents with improved credential validation and metadata-driven configuration ([#162](https://github.com/agentuity/sdk-js/pull/162))

## 0.0.139

### Patch Changes

- Added teams support ([#161](https://github.com/agentuity/sdk-js/pull/161))

## 0.0.138

### Patch Changes

- Fix the sms error ([#158](https://github.com/agentuity/sdk-js/pull/158))

## 0.0.137

### Patch Changes

- Expose ts and ts_thread in the payload for Slack IO integration ([#157](https://github.com/agentuity/sdk-js/pull/157))

## 0.0.136

### Patch Changes

- The AgentResponse.stream() method now supports both function and generator transformers while maintaining full backward compatibility!

  Original Requirements ✅:

  - Generic object streaming with automatic JSON conversion
  - Runtime type detection between ReadableDataType and objects
  - Auto-conversion to JSON newline format for objects
  - Intelligent content-type detection (application/json for objects)
  - Full backward compatibility

  Function Transformer Enhancement ✅:

  - Optional transformer function as 4th parameter
  - Data transformation and filtering capabilities
  - Type safety with generic types <T, U>
  - Error handling and edge cases

  Generator Transformer Enhancement ✅:

  - Support for generator functions as alternative syntax
  - One-to-one transformation: function\* (item) { yield result; }
  - Filtering support: generators can yield nothing to skip items
  - Same capabilities as regular functions but with generator syntax

    stream<T = unknown, U = T, M = unknown>(
    stream: ReadableStream<T> | AsyncIterable<T>,
    contentType?: string,
    metadata?: M,
    transformer?: ((item: T) => U | null | undefined) | ((item: T) => Generator<U, void, unknown>)
    ): Promise<AgentResponseData>

    // 1. Regular function transformer
    const functionTransformer = (user) => {
    if (!user.active) return null; // Filter
    return { name: user.name, id: user.id }; // Transform
    };
    return resp.stream(userStream, undefined, {}, functionTransformer);

    // 2. Generator function transformer (equivalent to above)
    function\* generatorTransformer(user) {
    if (!user.active) return; // Filter (yield nothing)
    yield { name: user.name, id: user.id }; // Transform
    }
    return resp.stream(userStream, undefined, {}, generatorTransformer);

    // 3. Both work with AsyncIterable too
    return resp.stream(asyncDataSource, undefined, {}, transformer);

  - ✅ 26 test cases covering all functionality
  - ✅ Function transformer scenarios (8 tests)
  - ✅ Generator transformer scenarios (7 tests)
  - ✅ Backward compatibility verified
  - ✅ Error handling tested
  - ✅ Mixed scenarios validated
  - ✅ Both ReadableStream and AsyncIterable support

  1.  Maximum Flexibility: Choose between function or generator syntax
  2.  Developer Choice: Use familiar function syntax or expressive generator syntax
  3.  Consistent Behavior: Both approaches work identically
  4.  Type Safety: Full TypeScript support with generic types
  5.  Performance: Efficient one-to-one transformations
  6.  Backward Compatibility: Existing code continues to work unchanged

  7.  src/types.ts - Enhanced interface with generator support
  8.  src/router/response.ts - Full implementation with generator detection and processing
  9.  test/router/response-stream.test.ts - Comprehensive test coverage

  The Agentuity SDK now provides the most flexible and powerful streaming API that supports object auto-conversion, intelligent content-type detection, data transformation, filtering, and both function and generator transformer syntaxes! 🎉

## [0.0.135] - 2025-08-04

### Added

- Slack IO integration with support for parsing and replying to Slack messages ([#153](https://github.com/agentuity/sdk-js/pull/153))

## [0.0.134] - 2025-07-28

### Added

- Telegram IO integration with support for parsing and replying to Telegram messages ([#151](https://github.com/agentuity/sdk-js/pull/151))

## [0.0.133] - 2025-07-16

### Added

- Enable the ability to use custom email domains for email replies ([#149](https://github.com/agentuity/sdk-js/pull/149))

Contact us if you would like to enable custom email addresses to your organization.

## 0.0.132

### Patch Changes

- 1ef8c9f: DevMode: fallback values for headers, url and method in metadata

## 0.0.131

### Patch Changes

- c1fed39: Improve documentation of vector search parameters and tighten vector search metadata type definition
- 6548924: Add support for bulk delete in vector

## 0.0.130

### Patch Changes

- 8effdad: shortened discord interface from 'discordMessage' to 'discord'

## 0.0.129

### Added

- Add support for Discord IO integration ([#130](https://github.com/agentuity/sdk-js/pull/130))

### Fixed

- Release stream lock in all cases especially error scenarios ([#136](https://github.com/agentuity/sdk-js/pull/136))
- Fix issue with handoff not passing data from previous request ([#139](https://github.com/agentuity/sdk-js/pull/139))

## 0.0.128

### Fixed

- Release stream lock in all cases especially error scenarios ([#136](https://github.com/agentuity/sdk-js/pull/136))

## 0.0.127

### Added

- SMS Twilio IO functionality with support for parsing and replying to SMS messages ([#124](https://github.com/agentuity/sdk-js/pull/124))

## 0.0.126

### Added

- Enhanced ObjectStore API with additional headers and metadata support ([#133](https://github.com/agentuity/sdk-js/pull/133))

### Changed

- Better handling for yield / generators ([#134](https://github.com/agentuity/sdk-js/pull/134))

## 0.0.125

### Patch Changes

- 756ede6: Add support for new object store API
- 21e5b97: Fix description for similarity property for vector search
- 48d45cf: Fix issue with incorrect type for Vector delete API

## 0.0.124

### Patch Changes

- Refactor Bun handler to consolidate logic and make sure all paths go through it ([#128](https://github.com/agentuity/sdk-js/pull/128))

## 0.0.123

### Fixed

- Improved handling of requests for common static files by returning a 404 response without unnecessary error logging
- Enhanced support for multiple path segments and different HTTP methods in server routing ([#126](https://github.com/agentuity/sdk-js/pull/126))

## 0.0.122

### Patch Changes

- 34b7c12: Adds support for large email attachments

## 0.0.121

### Added

- Add support for agents to be able to reply to incoming email ([#118](https://github.com/agentuity/sdk-js/pull/118))

## 0.0.120

### Patch Changes

- bdf2cdc: Add support for inbound email on request

## 0.0.119

### Patch Changes

- Logger message arg accepts number type ([#113](https://github.com/agentuity/sdk-js/pull/113))
- Prevent multiple logs for the same exception ([#115](https://github.com/agentuity/sdk-js/pull/115))

## 0.0.118

### Patch Changes

- Logger enhancements
- 70791ff: Improve error handling

## 0.0.117

### Patch Changes

- Better type handling for metadata where can be any valid JSON object ([#110](https://github.com/agentuity/sdk-js/pull/110))

## 0.0.116

### Patch Changes

- Fixed issue where empty POST body would cause a hang

## 0.0.115

### Added

- Added AGENTUITY_SDK_KEY (#107)

### ⚠️ Breaking Changes

- The environment variable `AGENTUITY_API_KEY` has been renamed to `AGENTUITY_SDK_KEY` for better clarity and consistency. You will need to update your environment variables and code references accordingly.
- When using the Agentuity CLI, it will detect this change and offer to automatically migrate your code references.

## 0.0.114

### Patch Changes

- Fixed issue with Vector get type being wrong

## 0.0.113

### Patch Changes

- cross platform support for headers.toJSON

## 0.0.112

### Patch Changes

- 9c087d2: Add missing console logger methods
- e0d2307: Adds a Bun error handler for unhandled exceptions that are thrown from the agent.

## 0.0.111

### Patch Changes

- 32e8fcb: More fixes related to gzip compression when using keyvalue
  Change the name of the span when doing a remote solution vs remote execution
  Update to use versioned routes for API services

## 0.0.110

### Patch Changes

- In cloud we must bind to all addresses

## 0.0.109

### Patch Changes

- 984f9e8: Add the ability for an agent to return a Response object directly to provide more flexibility to integrate with existing APIs and protocols
- 4225c14: Bind explicitly to ipv4 when creating server

## 0.0.108

### Patch Changes

- Fixed issue when the keyvalue returns a gzip encoded value

## 0.0.107

### Patch Changes

- Fix issue with chunking and streaming text not matching in some cases

## 0.0.106

### Patch Changes

- Fix attempting to read the stream more than once
- c3c4e9c: Breaking change: Refactor the data API to have async methods instead of static properties so we can fully take advantage of the new streaming capabilities

## 0.0.106-next.1

### Patch Changes

- Fix attempting to read the stream more than once

## 0.0.106-next.0

### Patch Changes

- 24a34bc: Breaking change: Refactor the data API to have async methods instead of static properties so we can fully take advantage of the new streaming capabilities

## 0.0.105

### Patch Changes

- f6e04cf: Add support for remote agent handoff ([#85](https://github.com/agentuity/sdk-js/pull/85))

## 0.0.104

### Patch Changes

- e32f0d8: Add support for remote agent-to-agent invocation ([#83](https://github.com/agentuity/sdk-js/pull/83))

All notable changes to this project will be documented in this file.

## [0.0.103] - 2025-04-23

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

## [0.0.99] - 2025-04-14

### Patch Changes

- More debug for github workflow

## [0.0.98] - 2025-04-14

### Patch Changes

- More debug for github release tags

## [0.0.97] - 2025-04-14

### Patch Changes

- 0bd3fff: Attempt to fix issue with github workflow not pushing tag after release

## [0.0.96] - 2025-04-14

### Patch Changes

- a5bafb7: Fix issue with node keyvalue not correctly handling the buffer upload

## [0.0.95] - 2025-04-14

### Patch Changes

- 361ab69: Add more otel trace context headers, remove old trace provider
- 1b9f047: Base64 encode the welcome prompts

## [0.0.94] - 2025-03-31

### Patch Changes

- addda11: Fix regression in otel traces missing for AI SDK by change in opentelemetry-api version change

## [0.0.93] - 2025-03-31

### Patch Changes

- 8220ae0: Add support for agent inspection discovery

## [0.0.92] - 2025-03-31

### Patch Changes

- b41dcc8: Add data and markdown methods to AgentResponse interface and implementation

## [0.0.91] - 2025-03-31

### Patch Changes

- Use new agentuity sdk api
- 3869d0d: Add GitHub workflow for npm package release triggered by version tags

## [0.0.90] - 2025-03-27

### Patch Changes

- Fix Vector delete api

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

[0.0.148]: https://github.com/agentuity/sdk-js/compare/v0.0.147...v0.0.148
[0.0.147]: https://github.com/agentuity/sdk-js/compare/v0.0.146...v0.0.147
[0.0.146]: https://github.com/agentuity/sdk-js/compare/v0.0.145...v0.0.146
