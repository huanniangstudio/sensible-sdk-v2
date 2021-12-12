import { SensiblequeryProvider } from "@sensible-contract/providers";
import { LocalWallet } from "@sensible-contract/wallets";
import { Sensible } from "../src/index";

let CREATURE = {
  codehash: "22519e29424dc4b94b9273b6500ebadad7b9ad02",
  genesis: "f3ac15d9e40ff55c79517065f7c02bd6121f592c",
  tokenIndex: "24",
};

let provider = new SensiblequeryProvider();
let wallet = LocalWallet.fromWIF("xxxxx");
let sensible = new Sensible(provider, wallet);
let address = "16dpFB5oUCL9Cj2Mq9fUEJCLLqTzn6bQQg";

async function sell() {
  let { txids } = await sensible.sellNft({
    nft: CREATURE,
    satoshisPrice: 500,
  });
  console.log("sellNft", txids);
}

async function cancelSell() {
  let { txids } = await sensible.cancelSellNft({
    nft: CREATURE,
  });
  console.log("cancelSellNft", txids);
}

async function buy() {
  let { txids } = await sensible.buyNft({
    nft: CREATURE,
  });
  console.log("buy", txids);
}
async function run() {
  try {
    // await sell();
    await cancelSell();
    // await buy();
  } catch (e) {
    console.log(e);
  }
}
run();
