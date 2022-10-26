import fs from 'fs';
import wiki from 'wikijs';
import Bundlr from '@bundlr-network/client';
import { parseHTML } from './utils/parse.js';
import { WarpFactory } from 'warp-contracts';
import { selectTokenHolder } from './utils/selectTokenHolder.js';
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
  console.log(query)
  try {
    const content = await getPage(query);
    console.log(content.title)
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
    // console.log("ATOMIC ID", tx.id)
    return { id: atomicId }
  } catch (err) {
    console.error(err)
  }
}

async function createDataAndTags(assetId, name, description, assetType, contentType, categories) {
  try {

    const warp = WarpFactory.forMainnet();
    const contract = warp.contract("t6AAwEvvR-dbp_1FrSfJQsruLraJCobKl9qsJh9yb2M").connect(jwk);
    const { cachedValue } = await contract.readState()


    const state = cachedValue.state
    const randomContributor = selectTokenHolder(state.tokens, state.totalSupply)
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
        { name: 'Contract-Src', value: "eLUFzkrDnqXRdmBZtSgz1Bgy8nKC8ED3DoC__PaBJj8" },
        { name: 'Pool-Id', value: "Ah1NYwK2VpLa_Mi-DBiq6O6qoVgGo_i8UGLY3oERIlU" },
        // { name: 'Pool-Id', value: "CCobTPEONmH0OaQvGYt47sIif-9F78Y2r1weg3X2owc" },
        { name: 'Title', value: name },
        { name: 'Artefact-Name', value: `Wiki - ${assetId}` },
        { name: 'Created-At', value: Date.now().toString() },
        { name: 'Description', value: description },
        { name: 'Type', value: assetType },
        { name: 'Keywords', value: JSON.stringify(categories) },
        {
          name: 'Init-State', value: JSON.stringify({
            ticker: "ATOMIC-ASSET-" + assetId,
            balances: {
              [randomContributor]: 1
            },
            contentType: contentType,
            description: `DEPLOY ${description}`,
            lastTransferTimestamp: null,
            lockTime: 0,
            maxSupply: 1,
            name: "DEPLOY", // CHANGE THIS
            title: "DEPLOY", // CHANGE THIS
            transferable: true
          })
        }
      ]
    }
  } catch (err) {
    console.error(err)
  }
}

const assets = [
  // '2022_Russian_invasion_of_Ukraine',
  'Russo-Ukrainian_War',
  'Battle_of_Avdiivka_(2022)',
  'Battle_of_Romny',
  'Battle_of_Hlukhiv',
  // '2022_Snake_Island_campaign',
  // 'Battle_of_Antonov_Airport'
]

await Promise.all(assets.map(asset => {
  return new Promise(resolve => {
    setTimeout(() => resolve(), 2000)
    resolve(scrapePage(asset))
  })
}))
// await Promise.all(assets.map(asset => {
//   setTimeout(async () => {
//     try {
//       const res = await scrapePage(asset)
//       return res
//     }
//     catch (err) {
//       console.error(err)
//     }
//   }, 2000)
// }))


// scrapePage(process.argv[2])