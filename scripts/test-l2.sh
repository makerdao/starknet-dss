#!/bin/bash

yarn wait-on tcp:9000 &&
yarn test:l2
if [ $? -eq 0 ]
then
  kill -9 $(lsof -t -i:9000)
  exit 0
else
  kill -9 $(lsof -t -i:9000)
  exit 1
fi
