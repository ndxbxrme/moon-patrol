const ethers = require('ethers');
let dexRouterAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
let dexRouterAbi = require('../abi/pancake_router.json');
let dexFactoryAddress = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
let dexFactoryAbi = require('../abi/uniswap_factory.json');
let dexTokenAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const bep20Abi = require('../abi/bep20.json');
const lpAbi = require('../abi/lp.json');
const Wallet = require('./wallet.js');
const chains = {
  '0x38': {
    name: 'BSC',
    token: 'BNB',
    dexFactoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    dexRouterAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
    scanner: 'https://bscscan.com/token/'
  },
  '0xa86a': {
    name: 'Avalanche',
    token: 'AVAX',
    dexFactoryAddress: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10',
    dexRouterAddress: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
    scanner: 'https://snowtrace.io/address/'
  },
  '0xfa': {
    name: 'Fantom',
    token: 'FTM',
    dexFactoryAddress: '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3',
    dexRouterAddress: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
    scanner: 'https://ftmscan.com/address/'
  },
  '0x89': {
    name: 'Polygon',
    token: 'MATIC',
    dexFactoryAddress: '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3',
    dexRouterAddress: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
    scanner: 'https://ftmscan.com/address/'
  },
}
module.exports = (app, forwarderOrigin) => {
  const toProcess = [];
  const connect = () => ctrl.connect();
  const {provider, signer} = Wallet(app, forwarderOrigin, connect);
  const dexFactory = new ethers.Contract(dexFactoryAddress, dexFactoryAbi, provider);
  const doSort = () => {
    ctrl.coins.sort((a,b) => a[ctrl.sort] > b[ctrl.sort] ? -1 * ctrl.sortDir : 1 * ctrl.sortDir);
    ctrl.buyers.sort((a,b) => a[ctrl.sort] > b[ctrl.sort] ? -1 * ctrl.sortDir : 1 * ctrl.sortDir)
  }
  const updateCoinData = async () => {
    const now = new Date().getTime();
    const localToProcess = [...toProcess];
    toProcess.length = 0;
    for(let f=0; f<localToProcess.length; f++) {
      await processTransfer(localToProcess[f]);
    }
    for(let f=0; f<ctrl.coins.length; f++) {
      const coin = ctrl.coins[f];
      const times = [60,300,600];
      ['buy', 'sell'].forEach(side => {
        times.forEach(time => coin[side + 'Time' + time] = 0);
        coin.timeData = coin[side + 'History'].forEach(hist => {
          times.forEach(time => {
            if(hist.x > now - (time * 1000)) {
              coin[side + 'Time' + time] += hist.v;
            }
          })
        });
      })
      if(coin.buyTime60 || coin.sellTime60 || coin.resCooldown++ > 200) {
        coin.resCooldown = 0;
        if(coin.pairAddress) {
          const pairContract = new ethers.Contract(coin.pairAddress, lpAbi, provider);
          try {
            const reserves = await pairContract.getReserves();
            if(ethers.BigNumber.from(coin.address).gt(ethers.BigNumber.from(coin.token0))) {
              coin.bnbReserve = ethers.utils.formatEther(reserves[0]);
              coin.tokenReserve = ethers.utils.formatUnits(reserves[1], coin.decimals);
            }
            else {
              coin.bnbReserve = ethers.utils.formatEther(reserves[1]);
              coin.tokenReserve = ethers.utils.formatUnits(reserves[0], coin.decimals);
            }
            coin.price = +coin.bnbReserve / +coin.tokenReserve;
          } catch(e) {
            coin.errors++;
          }
        }
      }
    }
    for(let f=ctrl.coins.length-1; f>=0; f--) {
      if((!ctrl.coins[f].buyTime600 && !ctrl.coins[f].sellTime600) || ctrl.coins[f].errors > 20) {
        ctrl.coins.splice(ctrl.coins.indexOf(ctrl.coins[f]), 1);
      }
    }
    doSort();
    ctrl.redrawTableBody && ctrl.redrawTableBody(ctrl);
  }
  const processTransfer = async (log) => {
    ctrl.transactionCount++;
    //console.log(log.address, dexTokenAddress);
    if(log.address.toLowerCase()!==dexTokenAddress) return;
    try {
      const transaction = await provider.getTransaction(log.transactionHash);
      const iface = new ethers.utils.Interface(dexRouterAbi);
      const res = iface.decodeFunctionData(log.side==='buy'?'swapExactETHForTokens':'swapExactTokensForETH', transaction.data);
      //if(log.side==='sell') debugger;
      const contract = new ethers.Contract(res.path[log.side==='buy'?1:0], bep20Abi, provider);
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      const value = +ethers.utils.formatEther(log.side==='buy'?transaction.value:res.amountOutMin);
      //const code = await provider.getCode(res.path[1]);
      //console.log(code);
      const pairAddress = await dexFactory.getPair(res.path[0], res.path[1]);
      let coin = ctrl.coins.find(c => c.pairAddress===pairAddress);
      let buyer = ctrl.buyers.find(b => b.address===res.to);
      if(buyer) {
        if(buyer.txns.includes(log.transactionHash)) return;
      }
      const now = new Date().getTime();
      if(coin) {
        coin.volume++;
      }
      else {
        coin = {
          address: res.path[log.side==='buy'?1:0],
          token0: res.path[log.side==='buy'?0:1],
          name, symbol, decimals, pairAddress,
          volume: 1,
          errors: 0,
          buyHistory: [],
          sellHistory: [],
          resCooldown: 0
        };
        //coin[log.side + 'History'].push({x: now, v: 1});
        ctrl.coins.push(coin);
      }
      //console.log(ctrl.coins.length);
      if(coin[log.side + 'History'].length && coin[log.side + 'History'][0].x < now + 100) {
        coin[log.side + 'History'][0].v++;
      }
      else {
        coin[log.side + 'History'].unshift({
          x: now,
          v: 1
        })
      }
      if(buyer) {
        buyer.txns.push(log.transactionHash);
        buyer.volume++;
        buyer[log.side + 'Value'] += value;
        let buyercoin = buyer.coins.find(c => c.pairAddress===pairAddress);
        if(buyercoin) {
          buyercoin.bvolume++;
          buyercoin[log.side + 'value'] += value;
        }
        else {
          buyer.nocoins++;
          buyercoin = {
            address: res.to,
            symbol, decimals, pairAddress, volume: 1
          }
          buyercoin[log.side + 'Value'] = value;
          buyer.coins.push(buyercoin);
        }
      }
      else {
        const balance = +ethers.utils.formatEther(await provider.getBalance(res.to));
        const buyValue = log.side==='buy'?value:0;
        const sellValue = log.side==='sell'?value:0;
        buyer = {
          address: res.to,
          volume: 1,
          buyValue,sellValue,
          nocoins: 1,
          balance, coins: [ {
            address: res.path[1],
            name, symbol, decimals, buyValue, sellValue, pairAddress, volume: 1
          }],
          txns: [log.transactionHash]
        }
        ctrl.buyers.unshift(buyer);
      }
    } catch(e) {
      //console.log('error', e)
    }
    
  }
  const handleBuy = (log) => {
    log.side = 'buy';
    toProcess.push(log);
  }
  const handleSell = (log) => {
    log.side = 'sell';
    toProcess.push(log);
  }
  const ctrl = {
    transactionCount: 0,
    redrawTableBody: null,
    redrawTableHead: null,
    coins: [],
    buyers: [],
    sort: 'time60',
    sortDir: 1,
    setSort: (name) => {
      if(name!==ctrl.sort) ctrl.sortDir = 1;
      else ctrl.sortDir *= -1;
      ctrl.sort = name;
      doSort();
      ctrl.redrawTableBody && ctrl.redrawTableBody(ctrl);
      ctrl.redrawTableHead && ctrl.redrawTableHead(ctrl);
    },
    connect: async () => {
      const buyFilter = {
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          [ethers.utils.hexZeroPad(dexRouterAddress, 32), ethers.utils.hexZeroPad('0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8', 32)]
        ]
      }
      const sellFilter = {
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          null,
          [ethers.utils.hexZeroPad(dexRouterAddress, 32), ethers.utils.hexZeroPad('0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8', 32)]
        ]
      }
      provider.on(buyFilter, handleBuy);
      provider.on(sellFilter, handleSell);
      setInterval(updateCoinData, 1000);
    }
  }
  return ctrl;
}