import fs from 'fs';
import wiki from 'wikijs';
import Bundlr from '@bundlr-network/client';
import open from 'open';
import { parseHTML } from './utils/parse.js';
import Arweave from 'arweave';

const jwk = JSON.parse(fs.readFileSync("wallet.json").toString());
const URL = 'https://gateway.redstone.finance/gateway/contracts/deploy'
const arweave = Arweave.init({
  host: 'arweave.net',
  port: '443',
  protocol: 'https'
})
let bundlr = await new Bundlr.default("https://node2.bundlr.network", "arweave", jwk);

const getPage = async (query) => {
  let content

  await wiki.default({ apiUrl: 'https://wikipedia.org/w/api.php' })
    .page(query)
    .then(page => page)
    .then(obj => content = obj)

  return content
}

const scrapePage = async (query) => {
  try {
    const content = await getPage(query);
    const html = parseHTML(await content.html(), content.title);
    // createTransaction(html, tags)
    const tx = await arweave.createTransaction({
      data: html
    }, jwk)

    tx.addTag('Content-Type', 'text/html');
    try {
      await arweave.transactions.sign(tx, jwk)
      const assetId = tx.id
      await arweave.transactions.post(tx)
      createAtomicAsset(assetId, content.title, `${content.title} Wikipedia Page`, 'web-page', 'text/html');

    } catch (err) {
      console.log(err)
    }
  }
  catch (err) {
    console.error(err)
  }
}

async function createAtomicAsset(assetId, name, description, assetType, contentType) {
  try {
    const dataAndTags = await createDataAndTags(assetId, name, description, assetType, contentType)
    const atomicId = await dispatchToBundler(dataAndTags)
    await deployToWarp(atomicId, dataAndTags)
    return atomicId
  } catch (e) {
    console.log(e)
    return Promise.reject('Could not create Atomic Transaction')
  }
}

async function dispatchToBundler({ data, tags }) {
  const tx = bundlr.createTransaction(data, { tags: tags })
  await tx.sign(jwk)
  const id = tx.id
  await tx.upload()
  console.log("BUNDLR ATOMIC ID", id)
  return id
}

async function deployToWarp(atomicId, { data, tags }) {
  const tx = await arweave.createTransaction({ data })
  tags.map(t => tx.addTag(t.name, t.value))

  await arweave.transactions.sign(tx, jwk)
  tx.id = atomicId

  const result = await fetch(URL, {
    method: 'POST',
    body: JSON.stringify({ contractTx: tx }),
    headers: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  })
  console.log("ATOMIC ID", tx.id)
  return { id: atomicId }
}

async function createDataAndTags(assetId, name, description, assetType, contentType) {
  return {
    data: JSON.stringify({
      manifest: "arweave/paths",
      version: "0.1.0",
      index: { path: "index.html" },
      paths: { "index.html": { id: assetId } }
    }),
    tags: [
      { name: 'App-Name', value: 'SmartWeaveContract' },
      { name: 'App-Version', value: '0.3.0' },
      { name: 'Content-Type', value: "application/x.arweave-manifest+json" },
      { name: 'Contract-Src', value: "CCobTPEONmH0OaQvGYt47sIif-9F78Y2r1weg3X2owc" },
      { name: 'Title', value: name },
      { name: 'Description', value: description },
      { name: 'Type', value: assetType },
      {
        name: 'Init-State', value: JSON.stringify({
          ticker: "ATOMIC-ASSET-" + assetId,
          balances: {
            [await arweave.wallets.jwkToAddress(jwk)]: 10000
          },
          contentType: contentType,
          description: `DEPLOY ${description}`,
          lastTransferTimestamp: null,
          lockTime: 0,
          maxSupply: 0,
          name: "DEPLOY", // CHANGE THIS
          title: "DEPLOY", // CHANGE THIS
          transferable: true
        })
      }
    ]
  }
}

scrapePage(process.argv[2])