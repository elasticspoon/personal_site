#!/usr/bin/env bash

sudo apt update -y
sudo apt-get install build-essential -y
sudo apt-get install libvips -y
sudo apt-get install imagemagick -y

bundle
npm i
