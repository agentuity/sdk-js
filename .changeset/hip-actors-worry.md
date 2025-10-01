---
"@agentuity/sdk": patch
---

- Added support for automatic stream compression
- Added support for direct write to Stream in addition to getWriter()
- Added property `bytesWritten` to the Stream interface which represents the number of bytes written to the stream
- Added property `compressed` to the Stream interface which represents if the stream has compression enabled
