import fs from 'fs';
import wiki from 'wikijs';
import { parseHTML } from './utils/parse.js';
import Arweave from 'arweave';

const jwk = JSON.parse(fs.readFileSync("wallet.json").toString());
const arweave = Arweave.init({
  host: 'arweave.net',
  port: '443',
  protocol: 'https'
})

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
    const html = parseHTML(await content.html(), content.title, content.url());
    const tx = await arweave.createTransaction({
      data: html
    }, jwk)
    tx.addTag('Content-Type', 'text/html');

    try {
      await arweave.transactions.sign(tx, jwk)

      let uploader = await arweave.transactions.getUploader(tx);

      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
      }
      await arweave.transactions.post(tx)

      return tx.id
    } catch (err) {
      console.log(err)
    }
  }
  catch (err) {
    console.error(err)
  }
}

const searchTerms = [
  // Add search terms here
  "Blockchain"
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
  let sentList = [];
  if (fs.existsSync('local/data/sent.txt')) {
    sentList = fs.readFileSync('local/data/sent.txt').toString().split("\n");
  }
  for (let i = 0; i < articles.length; i++) {
    console.log(articles[i])
    if (!sentList.includes(articles[i])) {
      console.log("Found non duplicate article to send: " + articles[i])
      let res = await scrapePage(articles[i]);
      fs.appendFileSync('local/data/sent.txt', articles[i] + "\n");
      fs.appendFileSync('local/data/info.txt', `Title: ${articles[i]} Tx-Id: ${res}` + "\n");
      console.log(res)
      break;
    }
  }
}

main();