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
let TC1 = {
  codehash: "777e4dd291059c9f7a0fd563f7204576dcceb791",
  genesis: "acc86db7316112d91664d0525fa05915f8ce52c6",
};

let provider = new SensiblequeryProvider();
let wallet = LocalWallet.fromWIF("xxxxx");
let sensible = new Sensible(provider, wallet);
let address = "16dpFB5oUCL9Cj2Mq9fUEJCLLqTzn6bQQg";

async function lock(matureTime: number) {
  let { txids, pledgeAddress } = await sensible.lockTokenToPledge({
    token: TC1,
    amount: "500",
    matureTime,
  });
  console.log("lockTokenToPledge", pledgeAddress, txids);
  return pledgeAddress;
}

async function unlock(pledgeAddress: string, matureTime: number) {
  let { txids } = await sensible.unlockTokenFromPledge({
    token: TC1,
    matureTime,
    pledgeAddress,
  });
  console.log("unlockTokenFromPledge", txids);
}

async function run() {
  try {
    let matureTime = Date.now() + 1000 * 60;
    let pledgeAddress = await lock(matureTime);
    // console.log(pledgeAddress, matureTime);
    await sleep(60);
    await unlock(pledgeAddress, matureTime);
  } catch (e) {
    console.log(e);
  }
}
run();
