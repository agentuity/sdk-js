# @agentuity/sdk

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
