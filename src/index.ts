import { AbstractWallet } from "@sensible-contract/abstract-wallet";
import * as bsv from "@sensible-contract/bsv";
import { BN } from "@sensible-contract/bsv";
import {
  createNftGenesisTx,
  createNftMetaDataTx,
  createNftMintTx,
  createNftTransferTx,
  createNftUnlockCheckContractTx,
  getNftGenesisInfo,
  getNftInput,
  NftMetaData,
  NftSigner,
} from "@sensible-contract/nft-js";
import { NFT_UNLOCK_CONTRACT_TYPE } from "@sensible-contract/nft-js/lib/contract-factory/nftUnlockContractCheck";
import { SensiblequeryProvider } from "@sensible-contract/providers";
import { P2PKH_UNLOCK_SIZE } from "@sensible-contract/sdk-core";
import {
  createTokenGenesisTx,
  createTokenIssueTx,
  createTokenTransferCheckContractTx,
  createTokenTransferTx,
  getCodehashAndGensisByTx,
  getTokenInputs,
  TokenSigner,
} from "@sensible-contract/token-js";
import { TOKEN_TRANSFER_TYPE } from "@sensible-contract/token-js/lib/contract-factory/tokenTransferCheck";
import { TxComposer } from "@sensible-contract/tx-composer";
import { toDecimalUnit } from "@sensible-contract/web3-utils";
import {
  createBidTx,
  createNftAuctionContractTx,
  createNftForAuctionContractTx,
  createWithdrawTx,
  getNftAuctionInput,
  WitnessOracle,
} from "nft-auction-js";
const Signature = bsv.crypto.Signature;
export const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID;
type TokenAmount = {
  amount: string;
  decimal: number;
  uiAmount: string;
};

type Token = {
  codehash: string;
  genesis: string;
  sensibleId?: string;
};
async function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(0);
    }, time * 1000);
  });
}
function toTokenAmount(
  balance: string,
  pendingBalance: string,
  decimal: number
) {
  let bnAmount = BN.fromString(balance, 10).add(
    BN.fromString(pendingBalance, 10)
  );

  let tokenAmount: TokenAmount = {
    amount: bnAmount.toString(10),
    decimal,
    uiAmount: toDecimalUnit(bnAmount.toString(10), decimal),
  };
  return tokenAmount;
}

let defaultTokenSigner = new TokenSigner({});
async function getTokenSigner(token: Token) {
  return defaultTokenSigner;
}

type NFT = {
  codehash: string;
  genesis: string;
  sensibleId?: string;
  tokenIndex?: string;
};
let defaultNftSigner = new NftSigner({});
async function getNftSigner(nft: NFT) {
  return defaultNftSigner;
}

export class Sensible {
  public wallet: AbstractWallet;
  public provider: SensiblequeryProvider;
  constructor(provider: SensiblequeryProvider, wallet: AbstractWallet) {
    this.provider = provider;
    this.wallet = wallet;
  }

  async getBsvBalance() {
    let address = await this.wallet.getAddress();
    let balance = await this.provider.getBalance(address);
    return balance;
  }

  async getTokenBalance(codehash: string, genesis: string) {
    let address = await this.wallet.getAddress();
    let { balance, pendingBalance, decimal, utxoCount } =
      await this.provider.getTokenBalance(codehash, genesis, address);
    return toTokenAmount(balance, pendingBalance, decimal);
  }

  async getTokenSummarys({ cursor, size }: { cursor: number; size: number }) {
    let address = await this.wallet.getAddress();
    let _res = await this.provider.getTokenList(address);
    return _res.list.map((v) => {
      return {
        codehash: v.codehash,
        genesis: v.genesis,
        sensibleId: v.sensibleId,
        symbol: v.symbol,
        tokenAmount: toTokenAmount(v.balance, v.pendingBalance, v.decimal),
      };
    });
  }

  private async mergeBsv() {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
        sighashType,
      });
    });
    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.sign(sigResults);

    await this.provider.broadcast(txComposer.getRawHex());
    return {
      utxo: {
        txId: txComposer.getTxId(),
        outputIndex: 0,
        satoshis: txComposer.getOutput(0).satoshis,
        address: address,
      },
      rawTransaction: txComposer.getRawHex(),
    };
  }

  async transferBsv(to: string, amount: number) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
        sighashType,
      });
    });
    txComposer.appendP2PKHOutput({
      address: new bsv.Address(to),
      satoshis: amount,
    });
    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    await this.provider.broadcast(txComposer.getRawHex());
    return txComposer.getTxId();
  }

  async transferBsvArray(arr: { to: string; amount: number }[]) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
        sighashType,
      });
    });
    arr.forEach((v) => {
      txComposer.appendP2PKHOutput({
        address: new bsv.Address(v.to),
        satoshis: v.amount,
      });
    });

    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.sign(sigResults);

    await this.provider.broadcast(txComposer.getRawHex());
    return txComposer.getTxId();
  }

  async transferAllBsv(to: string) {
    const txComposer = new TxComposer();
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);
    let amount = 0;
    utxos.forEach((v, index) => {
      txComposer.appendP2PKHInput({
        address: new bsv.Address(v.address),
        txId: v.txId,
        outputIndex: v.outputIndex,
        satoshis: v.satoshis,
      });
      txComposer.addInputInfo({
        inputIndex: index,
        sighashType,
      });
      amount += v.satoshis;
    });
    let outputIndex = txComposer.appendP2PKHOutput({
      address: new bsv.Address(to),
      satoshis: amount,
    });

    const unlockSize = txComposer.getTx().inputs.length * P2PKH_UNLOCK_SIZE;
    let fee = Math.ceil(
      (txComposer.getTx().toBuffer().length + unlockSize) * txComposer.feeRate
    );
    txComposer.getOutput(outputIndex).satoshis -= fee;

    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    return await this.provider.broadcast(txComposer.getRawHex());
  }

  async transferToken(
    token: Token,
    receivers: {
      address: string;
      amount: string;
    }[]
  ) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let { utxos } = await this.mergeToken(token);

    let tokenUtxos = await this.provider.getTokenUtxos(
      token.codehash,
      token.genesis,
      address,
      { cursor: 0, size: 20 }
    );
    let tokenInputs = await getTokenInputs(this.provider, {
      tokenSigner,
      tokenUtxos,
      codehash: token.codehash,
      genesis: token.genesis,
    });
    let tokenOutputs = receivers;
    let changeAmount = tokenInputs
      .reduce((pre, cur) => pre.add(cur.tokenAmount), BN.Zero)
      .sub(
        receivers.reduce(
          (pre, cur) => pre.add(BN.fromString(cur.amount, 10)),
          BN.Zero
        )
      );

    if (changeAmount.gt(BN.Zero)) {
      tokenOutputs.push({
        address,
        amount: changeAmount.toString(10),
      });
    }
    let ret0 = await createTokenTransferCheckContractTx({
      tokenTransferType: TOKEN_TRANSFER_TYPE.IN_3_OUT_100,
      tokenInputCount: tokenInputs.length,
      tokenOutputs,
      tokenID: tokenInputs[0].tokenID,
      codehash: token.codehash,
      utxos,
    });
    let sigResults0 = await this.wallet.signTransaction(
      ret0.txComposer.getRawHex(),
      ret0.txComposer.getInputInfos()
    );
    ret0.txComposer.unlock(sigResults0);

    utxos = [
      {
        txId: ret0.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: ret0.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];

    let ret1 = await createTokenTransferTx({
      tokenSigner,
      tokenInputs,
      tokenOutputs,
      transferCheckContract: ret0.transferCheckContract,
      transferCheckTxComposer: ret0.txComposer,
      utxos,
    });

    let sigResults1 = await this.wallet.signTransaction(
      ret1.txComposer.getRawHex(),
      ret1.txComposer.getInputInfos()
    );
    ret1.txComposer.unlock(sigResults1);

    let txid_0 = await this.provider.broadcast(ret0.txComposer.getRawHex());
    let txid_1 = await this.provider.broadcast(ret1.txComposer.getRawHex());
    console.log("transfer broadcast", txid_1);
    return ret1.txComposer.getTxId();
  }

  async mergeToken(token: Token) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let utxos = await this.provider.getUtxos(address);

    //check bsv utxos count
    if (utxos.length > 3) {
      let _res = await this.mergeBsv();
      utxos = [_res.utxo];
    }

    for (let i = 0; i < 100; i++) {
      let { utxoCount } = await this.provider.getTokenBalance(
        token.codehash,
        token.genesis,
        address
      );
      if (utxoCount <= 3) break;

      let tokenUtxos = await this.provider.getTokenUtxos(
        token.codehash,
        token.genesis,
        address,
        { cursor: 0, size: 20 }
      );
      let tokenInputs = await getTokenInputs(this.provider, {
        tokenSigner,
        tokenUtxos,
        codehash: token.codehash,
        genesis: token.genesis,
      });
      let tokenOutputs = [
        {
          address,
          amount: tokenInputs
            .reduce((pre, cur) => pre.add(cur.tokenAmount), BN.Zero)
            .toString(10),
        },
      ];
      let ret0 = await createTokenTransferCheckContractTx({
        tokenTransferType: TOKEN_TRANSFER_TYPE.IN_20_OUT_3,
        tokenInputCount: tokenInputs.length,
        tokenOutputs,
        tokenID: tokenInputs[0].tokenID,
        codehash: token.codehash,
        utxos,
      });
      let sigResults0 = await this.wallet.signTransaction(
        ret0.txComposer.getRawHex(),
        ret0.txComposer.getInputInfos()
      );
      ret0.txComposer.unlock(sigResults0);

      utxos = [
        {
          txId: ret0.txComposer.getTxId(),
          outputIndex: 1,
          satoshis: ret0.txComposer.getOutput(1).satoshis,
          address: address,
        },
      ];

      let ret1 = await createTokenTransferTx({
        tokenSigner,
        tokenInputs,
        tokenOutputs,
        transferCheckContract: ret0.transferCheckContract,
        transferCheckTxComposer: ret0.txComposer,
        utxos,
      });

      let sigResults1 = await this.wallet.signTransaction(
        ret1.txComposer.getRawHex(),
        ret1.txComposer.getInputInfos()
      );
      ret1.txComposer.unlock(sigResults1);

      let txid_0 = await this.provider.broadcast(ret0.txComposer.getRawHex());
      let txid_1 = await this.provider.broadcast(ret1.txComposer.getRawHex());
      console.log("merge broadcast", txid_1);
      await sleep(2);
      utxos = [
        {
          txId: ret1.txComposer.getTxId(),
          outputIndex: 1,
          satoshis: ret1.txComposer.getOutput(1).satoshis,
          address,
        },
      ];
    }

    return {
      utxos,
    };
  }

  async genesisToken({
    tokenSigner,
    tokenName,
    tokenSymbol,
    decimalNum,
  }: {
    tokenSigner?: TokenSigner;
    tokenName: string;
    tokenSymbol: string;
    decimalNum: number;
  }) {
    if (!tokenSigner) tokenSigner = defaultTokenSigner;
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);
    let { txComposer } = await createTokenGenesisTx(this.provider, {
      tokenSigner,
      tokenName,
      tokenSymbol,
      utxos,
      genesisPublicKey: publicKey,
      decimalNum,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let token = getCodehashAndGensisByTx(tokenSigner, txComposer.getRawHex());
    let txid = await this.provider.broadcast(txComposer.getRawHex());
    return {
      txid,
      token,
    };
  }

  async issueToken({
    token,
    tokenAmount,
    receiverAddress,
    allowIncreaseIssues = false,
  }: {
    token: Token;
    tokenAmount: string;
    receiverAddress?: string;
    allowIncreaseIssues?: boolean;
  }) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);
    let { txComposer } = await createTokenIssueTx(this.provider, {
      tokenSigner,
      codehash: token.codehash,
      genesis: token.genesis,
      sensibleId: token.sensibleId,
      genesisPublicKey: publicKey,
      utxos,
      allowIncreaseIssues,
      receiverAddress,
      tokenAmount,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let txid = await this.provider.broadcast(txComposer.getRawHex());
    return txid;
  }

  async genesisNft({
    nftSigner,
    totalSupply,
  }: {
    nftSigner?: NftSigner;
    totalSupply: string;
  }) {
    if (!nftSigner) nftSigner = defaultNftSigner;
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);
    let { txComposer } = await createNftGenesisTx({
      nftSigner,
      utxos,
      genesisPublicKey: publicKey,
      totalSupply,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let nft = getNftGenesisInfo(nftSigner, txComposer.getRawHex());
    let txid = await this.provider.broadcast(txComposer.getRawHex());
    return {
      txid,
      nft,
    };
  }

  async mintNft({
    nft,
    receiverAddress,
    metaData,
  }: {
    nft: NFT;
    metaData: NftMetaData;
    receiverAddress?: string;
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let nftMetaDataRet = await createNftMetaDataTx({
      utxos,
      metaData,
    });

    let sigResults0 = await this.wallet.signTransaction(
      nftMetaDataRet.txComposer.getRawHex(),
      nftMetaDataRet.txComposer.getInputInfos()
    );
    nftMetaDataRet.txComposer.unlock(sigResults0);

    utxos = [
      {
        txId: nftMetaDataRet.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: nftMetaDataRet.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];
    let { txComposer } = await createNftMintTx(this.provider, {
      nftSigner,
      codehash: nft.codehash,
      genesis: nft.genesis,
      sensibleId: nft.sensibleId,
      genesisPublicKey: publicKey,
      utxos,
      receiverAddress,
      metaTxId: nftMetaDataRet.txComposer.getTxId(),
      metaOutputIndex: 0,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);
    let txid_0 = await this.provider.broadcast(
      nftMetaDataRet.txComposer.getRawHex()
    );
    let txid = await this.provider.broadcast(txComposer.getRawHex());
    return txid;
  }

  async getNftMetaData(provider: SensiblequeryProvider, { nft }: { nft: NFT }) {
    let nftUtxo = await provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    if (!nftUtxo) {
      throw new Error("no such nft");
    }
    console.log(nftUtxo.metaTxId);
    let rawhex = await provider.getRawTxData(nftUtxo.metaTxId);
    let tx = new bsv.Transaction(rawhex);
    let jsondata =
      tx.outputs[nftUtxo.metaOutputIndex].script.chunks[2].buf.toString();
    let data = JSON.parse(jsondata);
    return data;
  }

  async transferNft({
    nft,
    receiverAddress,
  }: {
    nft: NFT;
    receiverAddress?: string;
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let nftUtxoDetail = await this.provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    let nftUtxo = {
      txId: nftUtxoDetail.txid,
      outputIndex: nftUtxoDetail.vout,
      tokenAddress: nftUtxoDetail.address,
      tokenIndex: nftUtxoDetail.tokenIndex,
    };
    let nftInput = await getNftInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      nftUtxo,
    });
    let { txComposer } = await createNftTransferTx({
      nftSigner,
      nftInput,
      utxos,
      receiverAddress,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    let txid = await this.provider.broadcast(txComposer.getRawHex());
    return txid;
  }

  async getNftList(
    provider: SensiblequeryProvider,
    { nft, address }: { nft: NFT; address: string }
  ) {
    let nfts = await provider.getNftUtxoDatas(
      nft.codehash,
      nft.genesis,
      address,
      { cursor: 0, size: 10 }
    );
    console.log(nfts);
  }

  //invalid
  private async transferNftWithOtherFee({
    nft,
    feeAddress,
    receiverAddress,
  }: {
    nft: NFT;
    feeAddress: string;
    receiverAddress: string;
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(feeAddress);

    console.log("from", address, receiverAddress);

    let nftUtxoDetail = await this.provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    let nftUtxo = {
      txId: nftUtxoDetail.txid,
      outputIndex: nftUtxoDetail.vout,
      tokenAddress: nftUtxoDetail.address,
      tokenIndex: nftUtxoDetail.tokenIndex,
    };
    let nftInput = await getNftInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      nftUtxo,
    });
    let { txComposer } = await createNftTransferTx({
      nftSigner,
      nftInput,
      utxos,
      receiverAddress,
    });
    let inputInfos = txComposer.getInputInfos();
    let info = inputInfos.splice(0, 1);
    console.log(info);
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      info
    );

    return { txComposer, sigResults, inputInfos };
  }

  async startNftAuction({
    nft,
    startBsvPrice,
    endTimeStamp,
  }: {
    nft: NFT;
    startBsvPrice: number;
    endTimeStamp: number;
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    let nftUtxoDetail = await this.provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    let nftUtxo = {
      txId: nftUtxoDetail.txid,
      outputIndex: nftUtxoDetail.vout,
      tokenAddress: nftUtxoDetail.address,
      tokenIndex: nftUtxoDetail.tokenIndex,
    };
    let nftInput = await getNftInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      nftUtxo,
    });

    let { auctionContractHash, txComposer } = await createNftAuctionContractTx(
      this.provider,
      {
        nftSigner,
        witnessOracle: new WitnessOracle(),
        nftInput,
        senderAddress: address,
        startBsvPrice,
        endTimeStamp,
        utxos,
      }
    );
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    let txid = await this.provider.broadcast(txComposer.getRawHex());
    console.log("create auction ", txid);

    await sleep(2);

    let { nftForAuctionAddress } = await createNftForAuctionContractTx(
      this.provider,
      {
        nftInput,
        auctionContractHash,
        utxos,
      }
    );

    await this.transferNft({ nft, receiverAddress: nftForAuctionAddress });
  }

  async bidInNftAuction({
    nft,
    nftAuctionUtxo,
    bsvBidPrice,
  }: {
    nft: NFT;
    nftAuctionUtxo: { txId: string; outputIndex: number };
    bsvBidPrice: number;
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    // let nftAuctionUtxo = {
    //   txId: "",
    //   outputIndex: 0,
    // };
    let nftAuctionInput = await getNftAuctionInput(this.provider, {
      nftAuctionUtxo,
    });
    let { txComposer } = await createBidTx({
      nftSigner,
      witnessOracle: new WitnessOracle(),
      nftAuctionInput,
      bsvBidPrice,
      bidderAddress: address,
      utxos,
    });

    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    let txid = await this.provider.broadcast(txComposer.getRawHex());
    console.log("bid success", txid);
  }

  async withdrawInNftAuction({
    nft,
    nftAuctionUtxo,
  }: {
    nft: NFT;
    nftAuctionUtxo: { txId: string; outputIndex: number };
  }) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    let nftUtxoDetail = await this.provider.getNftUtxoDetail(
      nft.codehash,
      nft.genesis,
      nft.tokenIndex
    );
    let nftUtxo = {
      txId: nftUtxoDetail.txid,
      outputIndex: nftUtxoDetail.vout,
      tokenAddress: nftUtxoDetail.address,
      tokenIndex: nftUtxoDetail.tokenIndex,
    };
    let nftInput = await getNftInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      nftUtxo,
    });

    // let nftAuctionUtxo = await this.provider.getNftAuctionUtxo();
    // let nftAuctionUtxo = {
    //   txId: "",
    //   outputIndex: 0,
    // };

    let nftAuctionInput = await getNftAuctionInput(this.provider, {
      nftAuctionUtxo,
    });

    let nftForAuctionRet = await createNftForAuctionContractTx(this.provider, {
      nftInput,
      auctionContractHash: bsv.crypto.Hash.sha256ripemd160(
        nftAuctionInput.lockingScript.toBuffer()
      ).toString("hex"),
      utxos,
    });

    let sigResults0 = await this.wallet.signTransaction(
      nftForAuctionRet.txComposer.getRawHex(),
      nftForAuctionRet.txComposer.getInputInfos()
    );
    nftForAuctionRet.txComposer.unlock(sigResults0);

    utxos = [
      {
        txId: nftForAuctionRet.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: nftForAuctionRet.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];

    let unlockCheckRet = await createNftUnlockCheckContractTx({
      nftUnlockType: NFT_UNLOCK_CONTRACT_TYPE.OUT_6,
      codehash: nftInput.codehash,
      nftID: nftInput.nftID,
      utxos,
    });

    let sigResults1 = await this.wallet.signTransaction(
      unlockCheckRet.txComposer.getRawHex(),
      unlockCheckRet.txComposer.getInputInfos()
    );
    unlockCheckRet.txComposer.unlock(sigResults1);

    utxos = [
      {
        txId: unlockCheckRet.txComposer.getTxId(),
        outputIndex: 1,
        satoshis: unlockCheckRet.txComposer.getOutput(1).satoshis,
        address: address,
      },
    ];

    let { txComposer } = await createWithdrawTx({
      nftSigner,
      witnessOracle: new WitnessOracle(),
      nftInput,
      nftAuctionInput,
      nftForAuctionContract: nftForAuctionRet.nftForAuctionContract,
      nftForAuctionTxComposer: nftForAuctionRet.txComposer,
      nftUnlockCheckContract: unlockCheckRet.unlockCheckContract,
      nftUnlockCheckTxComposer: unlockCheckRet.txComposer,
      utxos,
    });

    let sigResults2 = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults2);

    await this.provider.broadcast(nftForAuctionRet.txComposer.getRawHex());
    await sleep(2);
    await this.provider.broadcast(unlockCheckRet.txComposer.getRawHex());
    await sleep(2);
    let txid = await this.provider.broadcast(txComposer.getRawHex());
    console.log("withdraw ", txid);
  }
}
