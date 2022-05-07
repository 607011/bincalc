#!/bin/bash

# .env must define the following variables:
# HOST: the SSH target of the host to deploy to, e.g. username@www.example.com
# DEST_DIR: the path to the directory on the host where to copy the files to

source .env

DIST=dist
mkdir -p ${DIST}

echo "Collecting ..."
while read filename; do
    echo ${filename}
    dir=$(dirname ${filename})
    mkdir -p ${DIST}/${dir}
    cp ${filename} ${DIST}/${filename}
done <files-to-copy.txt

echo "Synching ..."
rsync -avzr dist/* ${HOST}:${DEST_DIR}
