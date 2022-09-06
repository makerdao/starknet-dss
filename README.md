# starknet-dss
Multi Collateral Dai for StarkNet

# create python env
```
python3 -m venv ~/cairo_venv
source ~/cairo_venv/bin/activate
```
# install dependencies (if you don't know poetry, look [here](https://python-poetry.org/docs/))
```
poetry install
yarn
```

# compile contracts
```
yarn compile
# You can also use yarn compile:l1 to just compile solidity contracts
# or yarn compile:l2 to just compile cairo contracts
```

# deploy to goerli
```
yarn deploy:goerli
```

# run tests
```
yarn test:l1
yarn test:l2 
yarn test:crosschain
```

