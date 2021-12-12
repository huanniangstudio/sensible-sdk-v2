import { SensiblequeryProvider } from "@sensible-contract/providers";
import { LocalWallet } from "@sensible-contract/wallets";
import { Sensible } from "../src/index";
async function sleep(time: number) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(0);
    }, time * 1000);
  });
}

let CREATURE = {
  codehash: "22519e29424dc4b94b9273b6500ebadad7b9ad02",
  genesis: "f3ac15d9e40ff55c79517065f7c02bd6121f592c",
  sensibleId:
    "5a66ac39ab572c2116d8ccbf8933c69717b0423eb21784757c0a42df65d6e68400000000",
};

let provider = new SensiblequeryProvider();
let wallet = LocalWallet.fromWIF("xxxxx");
let sensible = new Sensible(provider, wallet);

async function genesis() {
  let { nft, txid } = await sensible.genesisNft({
    totalSupply: "100",
  });
  console.log(nft, txid);
}
async function mint(idx: number) {
  let txid = await sensible.mintNft({
    nft: CREATURE,
    metaData: {
      name: "CREATURE(FAKE)",
      description: "CREATURE " + idx,
    },
  });
  console.log(idx, txid);
}

async function send() {
  let t = await sensible.transferNft({
    nft: Object.assign({}, CREATURE, { tokenIndex: "2" }),
  });
}

async function getNftMetaData() {
  let data = await sensible.getNftMetaData(provider, {
    nft: Object.assign({}, CREATURE, { tokenIndex: "0" }),
  });
  console.log(data);
}

async function getNftList() {
  let list = await sensible.getNftList(provider, {
    nft: CREATURE,
    address: "16dpFB5oUCL9Cj2Mq9fUEJCLLqTzn6bQQg",
  });
  console.log(list);
}
async function run() {
  try {
    // await genesis();
    // for (let i = 20; i < 30; i++) {
    //   await mint(i);
    //   await sleep(2);
    // }
    // getNftMetaData();
    // await send();
    // await getNftList();
  } catch (e) {
    console.log(e);
  }
}
run();
