# Wikipedia to Arweave

Upload Wikipedia pages to Arweave.

## Installation

Install dependencies with `yarn` or `npm i`.

## Usage

Add Arweave `wallet.json` to root directory. Be sure it is registered by `.gitignore`.

In `index.js`, add your search terms in the `searchTerms` array.
eg - 
```
const searchTerms = [
  "Blockchain",
  "Cryptocurrency"
]
```

Run `yarn upload` or `npm run upload` to archive.

The article name and Arweave transaction ID will be added to `local/data/info.txt` for tracking.
## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)