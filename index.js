import fs from 'fs';
import wiki from 'wikijs';
import Bundlr from '@bundlr-network/client';
import { parseHTML } from './utils/parse.js';
import { WarpFactory } from 'warp-contracts';
import { selectTokenHolder } from './utils/selectTokenHolder.js';
import Arweave from 'arweave';
import { setTimeout } from "timers/promises";

const jwk = JSON.parse(fs.readFileSync("wallet.json").toString());
const URL = 'https://gateway.redstone.finance/gateway/contracts/deploy'
const arweave = Arweave.init({
  host: 'arweave.net',
  port: '443',
  protocol: 'https'
})
let bundlr = await new Bundlr.default("https://node2.bundlr.network", "arweave", jwk);

const warp = WarpFactory.forMainnet();
const contract = warp.contract("8Y9XTSDkdNVylhuDwdosZhvFFKr1hrhYjf3Vw-mQII0").connect(jwk);
const { cachedValue } = await contract.readState()

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
    const categories = await content.categories()
    const newCats = categories.map(word => word.replace('Category:', ""));
    const tx = await arweave.createTransaction({
      data: html
    }, jwk)
    tx.addTag('Content-Type', 'text/html');

    try {
      await arweave.transactions.sign(tx, jwk)
      const assetId = tx.id
      await arweave.transactions.post(tx)
      console.log(content.title, assetId);
      const res = await createAtomicAsset(assetId, content.title, `${content.title} Wikipedia Page`, 'web-page', 'text/html', newCats);
      return res
    } catch (err) {
      console.log(err)
    }
  }
  catch (err) {
    console.error(err)
  }
}

async function createAtomicAsset(assetId, name, description, assetType, contentType, categories) {
  try {
    const dataAndTags = await createDataAndTags(assetId, name, description, assetType, contentType, categories)
    const atomicId = await dispatchToBundler(dataAndTags)
    await deployToWarp(atomicId, dataAndTags)
    return atomicId
  } catch (e) {
    return Promise.reject('Could not create Atomic Transaction')
  }
}

async function dispatchToBundler({ data, tags }) {
  try {
    const tx = bundlr.createTransaction(data, { tags: tags })
    await tx.sign(jwk)
    const id = tx.id
    await tx.upload()
    return id
  } catch (err) {
    console.error(err)
  }
}

async function deployToWarp(atomicId, { data, tags }) {
  try {
    const tx = await arweave.createTransaction({ data })
    await tags.map(t => tx.addTag(t.name, t.value))

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
    return { id: atomicId }
  } catch (err) {
    console.error(err)
  }
}

async function createDataAndTags(assetId, name, description, assetType, contentType, categories) {
  try {
    const state = cachedValue.state
    const randomContributor = selectTokenHolder(state.tokens, state.totalSupply)
    const timestamp = Date.now().toString()
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
        // UKRAINE/RUSSIA POOL
        { name: 'Contract-Src', value: "TYwOwE2Oy45i9tXJmYGDe_U65-8aQjTTVc1taY22hOI" },
        { name: 'Pool-Id', value: "8Y9XTSDkdNVylhuDwdosZhvFFKr1hrhYjf3Vw-mQII0" },
        { name: 'Title', value: name },
        { name: 'Description', value: description },
        { name: 'Type', value: assetType },
        { name: "Artifact-Series", value: "Alex." },
        { name: 'Artifact-Name', value: `Wiki - ${description}` },
        { name: "Implements", value: "ANS-110" },
        { name: "Topic", value: "Topic:Ukraine" },
        { name: 'Initial-Owner', value: randomContributor },
        { name: 'Date-Created', value: timestamp },
        { name: 'Artifact-Type', value: "Alex-Webpage" },
        { name: 'Keywords', value: JSON.stringify(categories) },
        { name: "Media-Ids", value: JSON.stringify({}) },
        {
          name: 'Init-State', value: JSON.stringify({
            ticker: "ATOMIC-ASSET-" + assetId,
            balances: {
              [randomContributor]: 1
            },
            contentType: contentType,
            description: description,
            lastTransferTimestamp: null,
            lockTime: 0,
            maxSupply: 1,
            title: `Alex Artifact - ${name}`,
            name: `Artifact - ${name}`,
            transferable: true,
            dateCreated: timestamp,
            owner: randomContributor
          })
        }]
    }
  } catch (err) {
    console.error(err)
  }
}

const searchTerms = [
  "Ukraine",
  "ukraine",
  "Russia",
  "russia",
  "Ukraine Invasion",
  "Donetsk",
  "Luhansk",
  "Donbas",
  "Донецьк",
  "Луганськ",
  "Донба́с",
  "Timeline of the 2022 Russian invasion of Ukraine",
  "Russo-Ukrainian War"
]

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

async function main() {

  // build assets
  let articles = [];
  for (let i = 0; i < searchTerms.length; i++) {

    let a = await wiki.default({
      apiUrl: 'https://wikipedia.org/w/api.php',
      origin: null
    }).search(searchTerms[i]);
    articles = articles.concat(a.results);
  }

  articles = articles.filter(onlyUnique);

  console.log(articles);
  fs.writeFileSync('articles.txt', JSON.stringify(articles));
  console.log("Processing articles: " + articles.length);

  for (let i = 0; i < articles.length; i++) {
    setTimeout(6000);
    console.log(articles[i])
    let res = await scrapePage(articles[i]);
  }
}

main();