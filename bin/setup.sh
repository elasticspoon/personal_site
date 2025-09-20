#!/usr/bin/env bash

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  sudo apt update -y
  sudo apt-get install build-essential -y
  sudo apt-get install libvips -y
  sudo apt-get install imagemagick -y
fi

bundle
npm i
