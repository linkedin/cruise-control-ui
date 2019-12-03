#!/bin/bash

# script to package the release

VERSION=$1

if [[ -z $VERSION ]];then
  echo "syntax: $0 <version#>"
  exit 2
fi

npm install && \
npm run build && \
mkdir /tmp/cruise-control-ui && \
cp -pr dist /tmp/cruise-control-ui/ && \
cd /tmp && \
tar zcvf /tmp/cruise-control-ui-$VERSION.tar.gz cruise-control-ui

echo "Complete"
ls -l /tmp/cruise-control-ui-$VERSION*
