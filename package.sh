#!/bin/bash

# script to package the release

VERSION=$1

if [[ -z $VERSION ]];then
  echo "syntax: $0 <A.B.C>"
  exit 2
fi

BUILD_DIR=/tmp/build-ccui/
SW_NAME=cruise-control-ui

npm install && \
npm run build && \
rm -rf ${BUILD_DIR} && \
mkdir -p ${BUILD_DIR}/${SW_NAME} && \
cp -pr dist ${BUILD_DIR}/${SW_NAME} && \
cd ${BUILD_DIR} && \
tar zcvf ${SW_NAME}-$VERSION.tar.gz ${SW_NAME}

echo "Complete"
ls -l ${BUILD_DIR}/
