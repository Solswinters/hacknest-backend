#!/bin/bash

# Autocommit Script
# Commits each changed file individually to build up commit history
# Usage: ./scripts/autocommit.sh [commit-message-prefix]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Get commit message prefix (optional)
PREFIX="${1:-feat}"

echo -e "${BLUE}🔍 Scanning for changed files...${NC}\n"

# Get list of changed files (staged and unstaged)
CHANGED_FILES=$(git diff --name-only HEAD)
UNTRACKED_FILES=$(git ls-files --others --exclude-standard)

# Combine into array
ALL_FILES=()
while IFS= read -r file; do
    [[ -n "$file" ]] && ALL_FILES+=("$file")
done < <(echo "$CHANGED_FILES"; echo "$UNTRACKED_FILES")

# Check if there are any changes
if [ ${#ALL_FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}✓ No changes to commit${NC}"
    exit 0
fi

echo -e "${GREEN}Found ${#ALL_FILES[@]} file(s) with changes:${NC}"
for file in "${ALL_FILES[@]}"; do
    echo -e "  ${BLUE}•${NC} $file"
done
echo ""

# Ask for confirmation
read -p "Commit these files individually? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted${NC}"
    exit 0
fi

echo ""

# Counter for commits
COMMIT_COUNT=0

# Commit each file individually
for file in "${ALL_FILES[@]}"; do
    # Skip if file doesn't exist (might have been deleted)
    if [ ! -e "$file" ] && ! git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
        echo -e "${YELLOW}⊘ Skipping deleted: $file${NC}"
        continue
    fi
    
    # Generate commit message based on file type and changes
    FILENAME=$(basename "$file")
    DIR=$(dirname "$file")
    EXT="${FILENAME##*.}"
    
    # Determine commit type based on file
    if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
        # File is tracked - it's a modification
        if [[ "$file" == "docs/"* ]] || [[ "$EXT" == "md" ]]; then
            TYPE="docs"
            ACTION="Update"
        elif [[ "$file" == "test/"* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *".test."* ]]; then
            TYPE="test"
            ACTION="Update"
        elif [[ "$file" == "src/"* ]]; then
            TYPE="feat"
            ACTION="Update"
        elif [[ "$file" == "package.json" ]] || [[ "$file" == "package-lock.json" ]]; then
            TYPE="chore"
            ACTION="Update"
        elif [[ "$file" == "README.md" ]]; then
            TYPE="docs"
            ACTION="Update"
        else
            TYPE="chore"
            ACTION="Update"
        fi
    else
        # File is untracked - it's new
        if [[ "$file" == "docs/"* ]] || [[ "$EXT" == "md" ]]; then
            TYPE="docs"
            ACTION="Add"
        elif [[ "$file" == "test/"* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *".test."* ]]; then
            TYPE="test"
            ACTION="Add"
        elif [[ "$file" == "src/"* ]]; then
            TYPE="feat"
            ACTION="Add"
        else
            TYPE="chore"
            ACTION="Add"
        fi
    fi
    
    # Create descriptive commit message
    if [[ "$DIR" == "." ]]; then
        COMMIT_MSG="$TYPE: $ACTION $FILENAME"
    else
        COMMIT_MSG="$TYPE: $ACTION $file"
    fi
    
    # Stage the file
    git add "$file"
    
    # Commit
    if git commit -m "$COMMIT_MSG" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Committed: ${BLUE}$file${NC}"
        echo -e "  Message: ${YELLOW}$COMMIT_MSG${NC}"
        ((COMMIT_COUNT++))
    else
        echo -e "${RED}✗${NC} Failed to commit: $file"
    fi
    echo ""
done

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Done! Created $COMMIT_COUNT commit(s)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "To push: ${BLUE}git push${NC}"
echo -e "To view: ${BLUE}git log --oneline${NC}"
echo ""

