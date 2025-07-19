#!/usr/bin/env bash

# Get current date in YYYY/MM/DD format
DATE_DIR=$(date +"%Y/%m/%d")
DATE_FILE=$(date +"%Y-%m-%d")

# Create the directory if it doesn't exist
mkdir -p "_posts/${DATE_DIR}"

# Define the file path
FILE_PATH="_posts/${DATE_DIR}/${DATE_FILE}-TIL.md"

# Check if file already exists
if [ -f "$FILE_PATH" ]; then
  echo "Error: TIL post for today already exists at $FILE_PATH"
  exit 1
fi

# Get summary from first argument if provided
SUMMARY="${1:-}"

# Create the file with front matter
cat >"$FILE_PATH" <<EOL
---
layout: post
title: "TIL"
summary: "${SUMMARY}"
cover-img: /assets/img/thumbnails/til.jpg
thumbnail-img: /assets/img/thumbnails/til.jpg
share-img: /assets/img/thumbnails/til.jpg
readtime: false
toc: false
til: true
tags:
  - TIL
---

EOL

echo "Created new TIL post at $FILE_PATH"
