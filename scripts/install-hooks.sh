#!/bin/bash

HOOK_DIR=".git/hooks"
PRE_COMMIT_HOOK="$HOOK_DIR/pre-commit"

# Ensure hooks directory exists
if [ ! -d "$HOOK_DIR" ]; then
    echo "Error: .git directory not found. Are you in the project root?"
    exit 1
fi

# Create the pre-commit hook content
cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash

# Define the target file
SW_FILE="sw.js"

# Check if sw.js exists
if [ ! -f "$SW_FILE" ]; then
    echo "Warning: sw.js not found, skipping version bump."
    exit 0
fi

echo "Running pre-commit hook: Updating Service Worker version..."

# Generate new timestamp version
NEW_VERSION=$(date +%s)

# Use sed to replace the version lines. 
# We use a temp file to be compatible with both GNU (Linux) and BSD (Mac) sed 
# without worrying about the -i extension syntax differences.
sed "s/\/\/ VERSION: [0-9]*/\/\/ VERSION: $NEW_VERSION/" "$SW_FILE" > "${SW_FILE}.tmp" && \
sed "s/const CACHE_NAME = 'orbit-v[0-9]*';/const CACHE_NAME = 'orbit-v$NEW_VERSION';/" "${SW_FILE}.tmp" > "$SW_FILE"

# Remove temp file
rm "${SW_FILE}.tmp"

# Stage the modified file so it's included in the pending commit
git add "$SW_FILE"

echo "Service Worker updated to version $NEW_VERSION"
EOF

# Make it executable
chmod +x "$PRE_COMMIT_HOOK"

echo "Git pre-commit hook installed successfully!"
