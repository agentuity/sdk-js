# @agentuity/sdk

## 0.0.84 - 2025-03-14

### Added
- Stream IO Input: add new facility to support stream io for input data [#23](https://github.com/agentuity/sdk-js/pull/23)

### Patch Changes

- Release with new transport model

## 0.0.83

### Patch Changes

- Fix devmode logging when devmode environment is set by live

## 0.0.82

### Patch Changes

- KeyValue compression only on upload, not download

## 0.0.81

### Patch Changes

- Add support for compressing keyvalue entries

## 0.0.80

### Patch Changes

- Refactor the types to make it easier to use and fix a number of other small issues

## 0.0.79

### Patch Changes

- Add agent information on root HTTP span

## 0.0.78

### Patch Changes

- Fixed issue with Vector delete

## 0.0.77

### Patch Changes

- Expose public run route for HTTP server for local testing

## 0.0.76

### Patch Changes

- Removed unused package
  AgentRequest metadata is now a getter
  AgentRequest metadata() is not get()
  Fixed issue with local agent-to-agent serialization

## 0.0.75

### Patch Changes

- Improve handling for request text()

## 0.0.74

### Patch Changes

- Fixed issue with local agent-to-agent routing

## 0.0.73

### Patch Changes

- - Fix issue where logs wouldn't show up in console
  - Fix issue where the gray color for debug in log
  - Print debug message when connected to cloud

## 0.0.72

### Patch Changes

- Fix issue with non-otel logging causing issues

## 0.0.71

### Patch Changes

- Make sure we check correctness of incoming HTTP request before continuing

## 0.0.70

### Patch Changes

- fix issue with composite tracer, use a safe JSON stringify

## 0.0.69

### Patch Changes

- A fixes to make sure the logger cannot get into an infinite recursion loop and cleanup some safety around logging

## 0.0.68

### Patch Changes

- Add more work around otel trace propagation

## 0.0.67

### Patch Changes

- Fix error on otel

## 0.0.66

### Patch Changes

- Add an additional key for the object stored in Vector Storage so we have something to display to the user in the console

## 0.0.65

### Patch Changes

- Reworks moving IO out of the configuration and into the API. Reworks agent routing to require an explicit Agent ID

## 0.0.64

### Patch Changes

- Add fetch instrumentation
- Add otel trace propagation
- Monkey patch console to redirect into otel logger
- More improvements on bundling JS
- Handle direct return from agent run in case you don't return correct signature
- Set the span status on completion for agent run
- Add cli version to trace context
- More work on agent-to-agent remote comms

## 0.0.63

### Patch Changes

- Add hostmetrics to otel collection

## 0.0.62

### Patch Changes

- Allow the content type to be set on redirect and make sure we prefer the overriden payload

## 0.0.61

### Patch Changes

- Add the mechanics for agent-to-agent communication

## 0.0.60

### Patch Changes

- Add SDK version to various places and improve local dev

## 0.0.59

### Patch Changes

- Improve error logging. Don't log the same error multiple times.

## 0.0.58

### Patch Changes

- Revert a stupid incorrect change that Cursor made!!!

## 0.0.57

### Patch Changes

- - Fixed issue where the contentType wasnt correctly returning on the assertion
  - Tighten up tsconfig unused import rule and remove unused import
  - Add unique agentId calculation and put in context and trace attributes for better linkage

## 0.0.56

### Patch Changes

- Fixed issue with request payload not getting base64 decoded

## 0.0.55

### Patch Changes

- Switch to use HTTP for otel

## 0.0.54

### Patch Changes

- Expose auth header for OTLP and set more attributes

## 0.0.53

### Patch Changes

- Adds support for bearer authorization and adds additional resource information

## 0.0.52

### Patch Changes

- Add support for a health endpoint

## 0.0.51

### Patch Changes

- Fixing automation around publishing

## 0.0.50

### Patch Changes

- More build and publish changes

## 0.0.49

### Patch Changes

- be86f59: more publish changes

## 0.0.48

### Patch Changes

- Refactor the JS SDK to better support new workflow
