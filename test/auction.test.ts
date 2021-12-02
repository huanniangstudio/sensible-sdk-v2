import { SensiblequeryProvider } from "@sensible-contract/providers";
import { Wallet } from "@sensible-contract/wallet";
import { Sensible } from "../src/index";

let CREATURE = {
  codehash: "22519e29424dc4b94b9273b6500ebadad7b9ad02",
  genesis: "f3ac15d9e40ff55c79517065f7c02bd6121f592c",
  tokenIndex: "16",
};

let provider = new SensiblequeryProvider();
let wallet = Wallet.fromWIF("xxx");
let sensible = new Sensible(provider, wallet);

async function startNftAuction() {
  await sensible.startNftAuction({
    nft: CREATURE,
    startBsvPrice: 500,
    endTimeStamp: Date.now() + 10 * 60 * 1000,
  });
}

async function bid() {
  await sensible.bidInNftAuction({
    nft: CREATURE,
    nftAuctionUtxo: {
      txId: "c8d0d04d30378e4d299cb35076040c58bb7c08155e8c7ffdb07f342e7e6d79b3",
      outputIndex: 0,
    },
    bsvBidPrice: 10001,
  });
}

async function withdraw() {
  await sensible.withdrawInNftAuction({
    nft: CREATURE,
    nftAuctionUtxo: {
      txId: "8562b5e3f5e7e1b05c7fb2640ed0da455b18d18466dd9254776b514e25bab8b3",
      outputIndex: 0,
    },
  });
}
async function run() {
  try {
    // await startNftAuction();
    // await bid();
    // await withdraw();
  } catch (e) {
    console.log(e);
  }
}
run();
