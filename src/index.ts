import { Wallet } from "@sensible-contract/abstract-wallet";
import * as bsv from "@sensible-contract/bsv";
import { BN } from "@sensible-contract/bsv";
import {
  createBidTx,
  createNftAuctionContractTx,
  createNftForAuctionContractTx,
  createWithdrawTx,
  getNftAuctionInput,
  getNftAuctionUtxo,
  WitnessOracle,
} from "@sensible-contract/nft-auction-js";
import {
  createNftGenesisTx,
  createNftMetaDataTx,
  createNftMintTx,
  createNftTransferTx,
  createNftUnlockCheckContractTx,
  getNftGenesisInfo,
  getNftGenesisInput,
  getNftInput,
  NftMetaData,
  NftSigner,
} from "@sensible-contract/nft-js";
import { NFT_UNLOCK_CONTRACT_TYPE } from "@sensible-contract/nft-js/lib/contract-factory/nftUnlockContractCheck";
import {
  createBuyNftTx,
  createCancelSellNftTx,
  createNftSellContractTx,
  getSellInput,
} from "@sensible-contract/nft-sell-js";
import { SensiblequeryProvider } from "@sensible-contract/providers";
import { P2PKH_UNLOCK_SIZE } from "@sensible-contract/sdk-core";
import {
  createTokenGenesisTx,
  createTokenIssueTx,
  createTokenTransferCheckContractTx,
  createTokenTransferTx,
  createTokenUnlockCheckContractTx,
  getTokenGenesisInfo,
  getTokenGenesisInput,
  getTokenInputs,
  TokenSigner,
} from "@sensible-contract/token-js";
import {
  TokenTransferCheckFactory,
  TOKEN_TRANSFER_TYPE,
} from "@sensible-contract/token-js/lib/contract-factory/tokenTransferCheck";
import { TOKEN_UNLOCK_TYPE } from "@sensible-contract/token-js/lib/contract-factory/tokenUnlockContractCheck";
import {
  createTokenLockContractTx,
  createUnlockTx,
  getLockTokenAddress,
  WitnessOracle as PledgeWitnessOracle,
} from "@sensible-contract/token-lock-js";
import { TxComposer } from "@sensible-contract/tx-composer";
import { toDecimalUnit } from "./utils";
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

type Utxo = {
  txId: string;
  outputIndex: number;
  satoshis: number;
  address: string;
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

type TxOptions = {
  onlyEstimateFee?: boolean;
  noBroadcast?: boolean;
};

const DEFAULT_TX_OPTIONS: TxOptions = {
  onlyEstimateFee: false,
  noBroadcast: false,
};

let defaultNftSigner = new NftSigner({});
async function getNftSigner(nft: NFT) {
  return defaultNftSigner;
}

export class Sensible {
  public wallet: Wallet;
  public provider: SensiblequeryProvider;
  constructor(provider: SensiblequeryProvider, wallet: Wallet) {
    this.provider = provider;
    this.wallet = wallet;
  }

  //bsv
  async getBsvBalance() {
    let address = await this.wallet.getAddress();
    let balance = await this.provider.getBalance(address);
    return balance;
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
      });
    });
    txComposer.appendChangeOutput(new bsv.Address(address));
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

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

  async transferBsvArray(
    arr: { to: string; amount: number }[],
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
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
    txComposer.unlock(sigResults);

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
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

  //token
  async genesisToken(
    {
      tokenSigner,
      tokenName,
      tokenSymbol,
      decimalNum,
    }: {
      tokenSigner?: TokenSigner;
      tokenName: string;
      tokenSymbol: string;
      decimalNum: number;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    if (!tokenSigner) tokenSigner = defaultTokenSigner;
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createTokenGenesisTx.estimateFee({ utxoMaxCount: utxos.length });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";
    let { txComposer } = await createTokenGenesisTx({
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
    let token = getTokenGenesisInfo(tokenSigner, txComposer.getRawHex());

    if (options.noBroadcast) {
      return { token, rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { token, txid };
    }
  }

  async issueToken(
    {
      token,
      tokenAmount,
      receiverAddress,
      allowIncreaseIssues = false,
    }: {
      token: Token;
      tokenAmount: string;
      receiverAddress?: string;
      allowIncreaseIssues?: boolean;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let { genesisInput, genesisContract } = await getTokenGenesisInput(
      this.provider,
      { sensibleId: token.sensibleId }
    );

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createTokenIssueTx.estimateFee({
      genesisInput,
      allowIncreaseIssues,
      utxoMaxCount: utxos.length,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let { txComposer } = await createTokenIssueTx({
      tokenSigner,
      genesisInput,
      genesisContract,
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

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
  }

  async transferToken(
    token: Token,
    receivers: {
      address: string;
      amount: string;
    }[],
    options: TxOptions = DEFAULT_TX_OPTIONS
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

    let tokenTransferType = TokenTransferCheckFactory.getOptimumType(
      tokenInputs.length,
      tokenOutputs.length
    );

    let fee1 = createTokenTransferCheckContractTx.estimateFee({
      tokenTransferType,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createTokenTransferTx.estimateFee({
      tokenInputs,
      tokenOutputs,
      tokenTransferType,
      utxoMaxCount: 1,
    });
    let fee = fee1 + fee2;
    if (options.onlyEstimateFee) return { fee };
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let ret0 = await createTokenTransferCheckContractTx({
      tokenTransferType,
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

    if (options.noBroadcast) {
      return {
        rawtxs: [ret0.txComposer.getRawHex(), ret1.txComposer.getRawHex()],
      };
    } else {
      let txid0 = await this.provider.broadcast(ret0.txComposer.getRawHex());
      let txid1 = await this.provider.broadcast(ret1.txComposer.getRawHex());
      return {
        txids: [txid0, txid1],
      };
    }
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

    //merge up 100 times.
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

  async getTokenBalance(token: Token) {
    let address = await this.wallet.getAddress();
    let { balance, pendingBalance, decimal, utxoCount } =
      await this.provider.getTokenBalance(
        token.codehash,
        token.genesis,
        address
      );
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
  //nft
  async genesisNft(
    {
      nftSigner,
      totalSupply,
    }: {
      nftSigner?: NftSigner;
      totalSupply: string;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    if (!nftSigner) nftSigner = defaultNftSigner;
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createNftGenesisTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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

    if (options.noBroadcast) {
      return { nft, rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { nft, txid };
    }
  }

  async mintNft(
    {
      nft,
      receiverAddress,
      metaData,
    }: {
      nft: NFT;
      metaData: NftMetaData;
      receiverAddress?: string;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    let utxos = await this.provider.getUtxos(address);

    let { genesisInput, genesisContract } = await getNftGenesisInput(
      this.provider,
      {
        codehash: nft.codehash,
        genesis: nft.genesis,
        sensibleId: nft.sensibleId,
      }
    );

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee1 = createNftMetaDataTx.estimateFee({
      metaData,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createNftMintTx.estimateFee({ genesisInput, utxoMaxCount: 1 });
    let fee = fee1 + fee2;
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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
    let { txComposer } = await createNftMintTx({
      nftSigner,
      genesisInput,
      genesisContract,
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

    if (options.noBroadcast) {
      return {
        rawtxs: [nftMetaDataRet.txComposer.getRawHex(), txComposer.getRawHex()],
      };
    } else {
      let txid0 = await this.provider.broadcast(
        nftMetaDataRet.txComposer.getRawHex()
      );
      let txid1 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid0, txid1] };
    }
  }

  async transferNft(
    {
      nft,
      receiverAddress,
      utxos,
    }: {
      nft: NFT;
      receiverAddress?: string;
      utxos?: Utxo[];
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    if (!receiverAddress) receiverAddress = address;
    if (!utxos) utxos = await this.provider.getUtxos(address);

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

    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    let fee = createNftTransferTx.estimateFee({
      nftInput,
      utxoMaxCount: utxos.length,
    });
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
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
    let rawhex = await provider.getRawTxData(nftUtxo.metaTxId);
    let tx = new bsv.Transaction(rawhex);
    let jsondata =
      tx.outputs[nftUtxo.metaOutputIndex].script.chunks[2].buf.toString();
    let data = JSON.parse(jsondata);
    return data;
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
    return nfts;
  }

  //nft-auction
  async startNftAuction(
    {
      nft,
      startBsvPrice,
      endTimeStamp,
      feeAddress,
      feeAmount,
    }: {
      nft: NFT;
      startBsvPrice: number;
      endTimeStamp: number;
      feeAddress: string;
      feeAmount: number;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
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

    let fee1 = createNftAuctionContractTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    let fee2Ret = await this.transferNft(
      { nft, receiverAddress: address },
      { onlyEstimateFee: true }
    );
    let fee = fee1 + fee2Ret.fee;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";
    let { auctionContractHash, txComposer } = await createNftAuctionContractTx({
      nftSigner,
      witnessOracle: new WitnessOracle(),
      nftInput,
      feeAddress,
      feeAmount,
      senderAddress: address,
      startBsvPrice,
      endTimeStamp,
      utxos,
    });
    let sigResults = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults);

    utxos = [txComposer.getChangeUtxo()];

    //just for getting address
    let { nftForAuctionAddress } = await createNftForAuctionContractTx(
      this.provider,
      {
        nftInput,
        auctionContractHash,
        utxos,
      }
    );

    let transferNftResult = await this.transferNft(
      { nft, receiverAddress: nftForAuctionAddress, utxos },
      {
        noBroadcast: true,
      }
    );

    if (options.noBroadcast) {
      return { rawtxs: [txComposer.getRawHex(), transferNftResult.rawtx] };
    } else {
      let txid1 = await this.provider.broadcast(txComposer.getRawHex());
      let txid2 = await this.provider.broadcast(transferNftResult.rawtx);
      return { txids: [txid1, txid2] };
    }
  }

  async bidInNftAuction(
    {
      nft,
      bsvBidPrice,
    }: {
      nft: NFT;
      bsvBidPrice: number;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
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
    let nftAuctionUtxo = await getNftAuctionUtxo(this.provider, {
      nftID: nftInput.nftID,
    });

    let nftAuctionInput = await getNftAuctionInput(this.provider, {
      nftAuctionUtxo,
    });

    let fee = createBidTx.estimateFee({
      nftAuctionInput,
      utxoMaxCount: utxos.length,
    });
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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

    if (options.noBroadcast) {
      return { rawtx: txComposer.getRawHex() };
    } else {
      let txid = await this.provider.broadcast(txComposer.getRawHex());
      return { txid };
    }
  }

  async withdrawInNftAuction(
    {
      nft,
    }: {
      nft: NFT;
    },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
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

    let nftAuctionUtxo = await getNftAuctionUtxo(this.provider, {
      nftID: nftInput.nftID,
    });
    let nftAuctionInput = await getNftAuctionInput(this.provider, {
      nftAuctionUtxo,
    });

    let nftUnlockType = NFT_UNLOCK_CONTRACT_TYPE.OUT_6;

    let fee1 = createNftForAuctionContractTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    let fee2 = createNftUnlockCheckContractTx.estimateFee({
      nftUnlockType,
      utxoMaxCount: 1,
    });
    let fee3 = createWithdrawTx.estimateFee({
      nftAuctionInput,
      nftInput,
      utxoMaxCount: 1,
    });
    let fee = fee1 + fee2 + fee3;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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

    utxos = [nftForAuctionRet.txComposer.getChangeUtxo()];

    let unlockCheckRet = await createNftUnlockCheckContractTx({
      nftUnlockType,
      codehash: nftInput.codehash,
      nftID: nftInput.nftID,
      utxos,
    });

    let sigResults1 = await this.wallet.signTransaction(
      unlockCheckRet.txComposer.getRawHex(),
      unlockCheckRet.txComposer.getInputInfos()
    );
    unlockCheckRet.txComposer.unlock(sigResults1);

    utxos = [unlockCheckRet.txComposer.getChangeUtxo()];

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

    if (options.noBroadcast) {
      return {
        rawtxs: [
          nftForAuctionRet.txComposer.getRawHex(),
          unlockCheckRet.txComposer.getRawHex(),
          txComposer.getRawHex(),
        ],
      };
    } else {
      let txid1 = await this.provider.broadcast(
        nftForAuctionRet.txComposer.getRawHex()
      );
      let txid2 = await this.provider.broadcast(
        unlockCheckRet.txComposer.getRawHex()
      );
      let txid3 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid1, txid2, txid3] };
    }
  }

  //nft-sell
  async sellNft(
    { nft, satoshisPrice }: { nft: NFT; satoshisPrice: number },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let nftSigner = await getNftSigner(nft);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    let fee1 = createNftSellContractTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    let _res = await this.transferNft({ nft }, { onlyEstimateFee: true });
    let fee = fee1 + _res.fee;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

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

    let nftSellRet = await createNftSellContractTx({
      nftInput,
      satoshisPrice,
      utxos,
    });
    let sigResults = await this.wallet.signTransaction(
      nftSellRet.txComposer.getRawHex(),
      nftSellRet.txComposer.getInputInfos()
    );
    nftSellRet.txComposer.unlock(sigResults);

    utxos = [nftSellRet.txComposer.getChangeUtxo()];

    let { txComposer } = await createNftTransferTx({
      nftSigner,
      nftInput,
      receiverAddress: nftSellRet.sellAddress,
      utxos,
    });
    let sigResults2 = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults2);

    if (options.noBroadcast) {
      return {
        rawtxs: [nftSellRet.txComposer.getRawHex(), txComposer.getRawHex()],
      };
    } else {
      let txid1 = await this.provider.broadcast(
        nftSellRet.txComposer.getRawHex()
      );
      let txid2 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid1, txid2] };
    }
  }

  async cancelSellNft(
    { nft }: { nft: NFT },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
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

    let nftUnlockType = NFT_UNLOCK_CONTRACT_TYPE.OUT_6;

    let fee1 = createNftUnlockCheckContractTx.estimateFee({
      nftUnlockType,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createCancelSellNftTx.estimateFee({
      nftInput,
      utxoMaxCount: 1,
    });
    let fee = fee1 + fee2;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let sellUtxo = (
      await this.provider.getNftSellUtxoDetail(
        nft.codehash,
        nft.genesis,
        nft.tokenIndex,
        {
          ready: true,
        }
      )
    ).map((v) => ({
      txId: v.txid,
      outputIndex: v.vout,
      sellerAddress: v.address,
      satoshisPrice: v.price,
    }))[0];

    let { sellInput, nftSellContract } = await getSellInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      tokenIndex: nft.tokenIndex,
      sellUtxo,
    });

    let nftSellTxComposer = new TxComposer(
      new bsv.Transaction(sellInput.txHex)
    );
    let unlockCheckRet = await createNftUnlockCheckContractTx({
      nftUnlockType,
      codehash: nft.codehash,
      nftID: nftInput.nftID,
      utxos,
    });

    let sigResults = await this.wallet.signTransaction(
      unlockCheckRet.txComposer.getRawHex(),
      unlockCheckRet.txComposer.getInputInfos()
    );
    unlockCheckRet.txComposer.unlock(sigResults);

    utxos = [unlockCheckRet.txComposer.getChangeUtxo()];

    let { txComposer } = await createCancelSellNftTx({
      nftSigner,
      nftInput,
      nftSellContract,
      nftSellTxComposer,
      nftUnlockCheckContract: unlockCheckRet.unlockCheckContract,
      nftUnlockCheckTxComposer: unlockCheckRet.txComposer,
      utxos,
    });

    let sigResults2 = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults2);

    if (options.noBroadcast) {
      return {
        rawtxs: [unlockCheckRet.txComposer.getRawHex(), txComposer.getRawHex()],
      };
    } else {
      let txid1 = await this.provider.broadcast(
        unlockCheckRet.txComposer.getRawHex()
      );
      let txid2 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid1, txid2] };
    }
  }

  async buyNft({ nft }: { nft: NFT }, options: TxOptions = DEFAULT_TX_OPTIONS) {
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

    let sellUtxo = (
      await this.provider.getNftSellUtxoDetail(
        nft.codehash,
        nft.genesis,
        nft.tokenIndex,
        {
          ready: true,
        }
      )
    ).map((v) => ({
      txId: v.txid,
      outputIndex: v.vout,
      sellerAddress: v.address,
      satoshisPrice: v.price,
    }))[0];

    let { sellInput, nftSellContract } = await getSellInput(this.provider, {
      codehash: nft.codehash,
      genesis: nft.genesis,
      tokenIndex: nft.tokenIndex,
      sellUtxo,
    });

    let nftUnlockType = NFT_UNLOCK_CONTRACT_TYPE.OUT_6;

    let fee1 = createNftUnlockCheckContractTx.estimateFee({
      nftUnlockType,
      utxoMaxCount: utxos.length,
    });
    let fee2 = createBuyNftTx.estimateFee({
      nftInput,
      sellInput,
      utxoMaxCount: 1,
    });
    let fee = fee1 + fee2;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let nftSellTxComposer = new TxComposer(
      new bsv.Transaction(sellInput.txHex)
    );
    let unlockCheckRet = await createNftUnlockCheckContractTx({
      nftUnlockType,
      codehash: nft.codehash,
      nftID: nftInput.nftID,
      utxos,
    });

    let sigResults = await this.wallet.signTransaction(
      unlockCheckRet.txComposer.getRawHex(),
      unlockCheckRet.txComposer.getInputInfos()
    );
    unlockCheckRet.txComposer.unlock(sigResults);

    utxos = [unlockCheckRet.txComposer.getChangeUtxo()];

    let { txComposer } = await createBuyNftTx({
      nftSigner,
      nftInput,
      nftSellContract,
      nftSellTxComposer,
      nftUnlockCheckContract: unlockCheckRet.unlockCheckContract,
      nftUnlockCheckTxComposer: unlockCheckRet.txComposer,
      utxos,
    });

    let sigResults2 = await this.wallet.signTransaction(
      txComposer.getRawHex(),
      txComposer.getInputInfos()
    );
    txComposer.unlock(sigResults2);

    if (options.noBroadcast) {
      return {
        rawtxs: [unlockCheckRet.txComposer.getRawHex(), txComposer.getRawHex()],
      };
    } else {
      let txid1 = await this.provider.broadcast(
        unlockCheckRet.txComposer.getRawHex()
      );
      let txid2 = await this.provider.broadcast(txComposer.getRawHex());
      return { txids: [txid1, txid2] };
    }
  }

  //token-lock
  async lockTokenToPledge(
    {
      token,
      matureTime,
      amount,
    }: { token: Token; matureTime: number; amount: string },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    matureTime = Math.floor(matureTime / 1000);

    let pledgeAddress = await getLockTokenAddress({
      witnessOracle: new PledgeWitnessOracle(),
      ownerAddress: address,
      matureTime,
    });

    let _res = await this.transferToken(
      token,
      [{ address: pledgeAddress, amount }],
      options
    );
    return Object.assign({ pledgeAddress }, _res);
  }

  async unlockTokenFromPledge(
    {
      token,
      pledgeAddress,
      matureTime,
    }: { token: Token; pledgeAddress: string; matureTime: number },
    options: TxOptions = DEFAULT_TX_OPTIONS
  ) {
    let tokenSigner = await getTokenSigner(token);
    let address = await this.wallet.getAddress();
    let publicKey = await this.wallet.getPublicKey();
    let utxos = await this.provider.getUtxos(address);

    matureTime = Math.floor(matureTime / 1000);

    let tokenUtxos = await this.provider.getTokenUtxos(
      token.codehash,
      token.genesis,
      pledgeAddress,
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
        amount: tokenUtxos
          .reduce(
            (pre, cur) => pre.add(BN.fromString(cur.tokenAmount, 10)),
            BN.Zero
          )
          .toString(10),
      },
    ];

    let tokenUnlockType = TOKEN_UNLOCK_TYPE.IN_20_OUT_5;
    let fee1 = createTokenLockContractTx.estimateFee({
      utxoMaxCount: utxos.length,
    });
    let fee2 = createTokenUnlockCheckContractTx.estimateFee({
      tokenUnlockType,
    });
    let fee3 = createUnlockTx.estimateFee({
      tokenInputs,
      tokenOutputs,
      tokenUnlockType,
    });

    let fee = fee1 + fee2 + fee3;
    let balance = utxos.reduce((pre, cur) => cur.satoshis + pre, 0);
    if (options.onlyEstimateFee) return { fee };
    if (balance < fee) throw "Insufficient Bsv Balance.";

    let tokenLockRet = await createTokenLockContractTx({
      witnessOracle: new PledgeWitnessOracle(),
      ownerAddress: address,
      matureTime,
      utxos,
    });

    let sigResults = await this.wallet.signTransaction(
      tokenLockRet.txComposer.getRawHex(),
      tokenLockRet.txComposer.getInputInfos()
    );
    tokenLockRet.txComposer.unlock(sigResults);

    utxos = [tokenLockRet.txComposer.getChangeUtxo()];

    let unlockCheckRet = await createTokenUnlockCheckContractTx({
      tokenUnlockType,
      tokenInputIndexArray: new Array(tokenUtxos.length)
        .fill(0)
        .map((v, index) => index + 1),
      tokenOutputs,
      codehash: token.codehash,
      tokenID: tokenInputs[0].tokenID,
      utxos,
    });

    let sigResults2 = await this.wallet.signTransaction(
      unlockCheckRet.txComposer.getRawHex(),
      unlockCheckRet.txComposer.getInputInfos()
    );
    unlockCheckRet.txComposer.unlock(sigResults2);

    utxos = [unlockCheckRet.txComposer.getChangeUtxo()];

    let ret = await createUnlockTx({
      witnessOracle: new PledgeWitnessOracle(),
      tokenSigner,
      tokenInputs,
      tokenOutputs,
      tokenLockContract: tokenLockRet.tokenLockContract,
      tokenLockTxComposer: tokenLockRet.txComposer,
      unlockCheckContract: unlockCheckRet.unlockCheckContract,
      unlockCheckTxComposer: unlockCheckRet.txComposer,
      utxos,
    });

    let sigResults3 = await this.wallet.signTransaction(
      ret.txComposer.getRawHex(),
      ret.txComposer.getInputInfos()
    );
    ret.txComposer.unlock(sigResults3);

    if (options.noBroadcast) {
      return {
        rawtxs: [
          tokenLockRet.txComposer.getRawHex(),
          unlockCheckRet.txComposer.getRawHex(),
          ret.txComposer.getRawHex(),
        ],
      };
    } else {
      let txid1 = await this.provider.broadcast(
        tokenLockRet.txComposer.getRawHex()
      );
      let txid2 = await this.provider.broadcast(
        unlockCheckRet.txComposer.getRawHex()
      );
      let txid3 = await this.provider.broadcast(ret.txComposer.getRawHex());
      return {
        txids: [txid1, txid2, txid3],
      };
    }
  }
}
