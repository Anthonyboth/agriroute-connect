#!/bin/bash
# Script to scan and prepare safe DOM cleanup patches
# Identifies unsafe DOM removals in useEffect cleanups, async callbacks, and portal/dynamic container management
# Creates backups and suggests safe replacements conservatively

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Safe DOM Cleanup Patcher ===${NC}"
echo "Scanning src/ for unsafe DOM operations..."

# Create backup directory
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Track statistics
TOTAL_FILES=0
MODIFIED_FILES=0
TOTAL_REPLACEMENTS=0

# Function to create backup
backup_file() {
  local file="$1"
  local backup_path="$BACKUP_DIR/${file}.bak.safe_remove"
  mkdir -p "$(dirname "$backup_path")"
  cp "$file" "$backup_path"
  echo -e "${YELLOW}Backup created:${NC} $backup_path"
}

# Function to check if line is in useEffect or async context
is_in_unsafe_context() {
  local file="$1"
  local line_num="$2"
  
  # Get context around the line (50 lines before, avoid negative line numbers)
  local start_line=$((line_num > 50 ? line_num - 50 : 1))
  local context=$(sed -n "${start_line},${line_num}p" "$file")
  
  # Check for useEffect, async function, or setTimeout/setInterval
  if echo "$context" | grep -qE "useEffect|async\s+(function|\()|setTimeout|setInterval|\.then\(|portal"; then
    return 0
  fi
  return 1
}

# Function to apply safe replacement
apply_safe_replacement() {
  local file="$1"
  local search_pattern="$2"
  local replacement="$3"
  local context_check="$4"
  
  # Check if file contains the pattern
  if ! grep -q "$search_pattern" "$file"; then
    return 0
  fi
  
  # Get line numbers of matches
  local line_nums=$(grep -n "$search_pattern" "$file" | cut -d: -f1)
  
  for line_num in $line_nums; do
    # Only replace if in unsafe context (useEffect, async, etc.)
    if [ "$context_check" = "true" ] && ! is_in_unsafe_context "$file" "$line_num"; then
      echo -e "${YELLOW}Skipping line $line_num in $file (safe synchronous context)${NC}"
      continue
    fi
    
    # Create backup if this is the first modification to this file
    if [ ! -f "$BACKUP_DIR/${file}.bak.safe_remove" ]; then
      backup_file "$file"
      ((MODIFIED_FILES++))
    fi
    
    # Apply replacement
    echo -e "${GREEN}Applying safe replacement at line $line_num in $file${NC}"
    ((TOTAL_REPLACEMENTS++))
  done
}

# Scan for .appendChild patterns in async/useEffect
echo -e "\n${GREEN}Scanning for .appendChild in async/useEffect contexts...${NC}"
while IFS= read -r file; do
  ((TOTAL_FILES++))
  
  # Check if file contains appendChild in potential async context
  if grep -q "\.appendChild" "$file"; then
    echo -e "${YELLOW}Found .appendChild in:${NC} $file"
    grep -n "\.appendChild" "$file" | while IFS=: read -r line_num content; do
      if is_in_unsafe_context "$file" "$line_num"; then
        echo -e "  ${RED}Line $line_num:${NC} Consider using safeAppendChild()"
        echo -e "  ${content}"
      fi
    done
  fi
done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" \))

# Scan for .removeChild patterns
echo -e "\n${GREEN}Scanning for .removeChild patterns...${NC}"
while IFS= read -r file; do
  if grep -q "\.removeChild\|parentNode\.removeChild" "$file"; then
    echo -e "${YELLOW}Found .removeChild in:${NC} $file"
    grep -n "\.removeChild\|parentNode\.removeChild" "$file" | while IFS=: read -r line_num content; do
      if is_in_unsafe_context "$file" "$line_num"; then
        echo -e "  ${RED}Line $line_num:${NC} Consider using safeRemove()"
        echo -e "  ${content}"
      fi
    done
  fi
done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" \))

# Scan for .remove() patterns (DOM element removal, not array)
echo -e "\n${GREEN}Scanning for DOM .remove() patterns...${NC}"
while IFS= read -r file; do
  # Skip if file contains obvious array operations
  if grep -q "\.remove(" "$file"; then
    echo -e "${YELLOW}Found .remove( in:${NC} $file (manual review needed)"
    grep -n "\.remove(" "$file" | head -5
  fi
done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" \))

# Summary
echo -e "\n${GREEN}=== Scan Summary ===${NC}"
echo "Total files scanned: $TOTAL_FILES"
echo "Files with potential issues: Check output above"
echo "Manual review recommended for all flagged occurrences"
echo ""
echo -e "${YELLOW}Note:${NC} This script identifies potential issues but does NOT automatically"
echo "modify files. Review the output and apply safeRemove() and safeAppendChild()"
echo "from src/utils/domUtils.ts where appropriate."
echo ""
echo "Import the utilities with:"
echo "  import { safeRemove, safeAppendChild, safeClearChildren, isElementAttached } from '@/utils/domUtils';"

if [ "$MODIFIED_FILES" -gt 0 ]; then
  echo -e "\n${GREEN}Backups created in:${NC} $BACKUP_DIR"
fi

exit 0
