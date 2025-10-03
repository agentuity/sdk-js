#!/bin/bash

# Build and copy script for @agentuity/sdk
# Usage: ./build-and-copy.sh <copy-directory>

set -e  # Exit on any error

# Check if target directory is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <copy-directory>"
    echo "Example: $0 /path/to/your/project/node_modules/@agentuity/sdk/dist"
    exit 1
fi

TARGET_DIR="$1"

echo "🔨 Building @agentuity/sdk in current directory..."

# Clean and build
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Clean target project's dist directory
echo "🧹 Cleaning target project's dist directory..."
if [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
    echo "  Removed existing dist directory"
fi

# Create target directory if it doesn't exist
echo "📁 Creating target directory: $TARGET_DIR"
mkdir -p "$TARGET_DIR"

# Copy our newly built dist contents to target directory
echo "📦 Copying newly built dist contents to $TARGET_DIR"
cp -r dist/. "$TARGET_DIR/"

# Copy package.json and LICENSE.md
echo "📄 Copying package.json and LICENSE.md"
cp package.json "$TARGET_DIR/"
cp LICENSE.md "$TARGET_DIR/"

echo "✅ Successfully copied @agentuity/sdk to $TARGET_DIR"
echo "📊 Contents copied:"
ls -la "$TARGET_DIR"
