import './index.css';
const CHAIN_ID = '0x316';
const TurboMini = require('turbomini');
const ethers = require('ethers');
const MetaMaskOnboarding = require('@metamask/onboarding').default;
const forwarderOrigin = window.location.href;
const pancakeRouterAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
const pancakeRouterAbi = require('./abi/pancake_router.json');
const pancakeFactoryAddress = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const pancakeFactoryAbi = require('./abi/uniswap_factory.json');
const bep20Abi = require('./abi/bep20.json');
const lpAbi = require('./abi/lp.json');
window.app = TurboMini('/moon-patrol');
app.run(async (app) => {
  app.Num = (t) => 
    isNaN(t) ? 0 : new Intl.NumberFormat("en-GB",{
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      maximumSignificantDigits: 4
    }).format(t);
  let provider = null;
  let signer = null;
  const onboarding = new MetaMaskOnboarding({forwarderOrigin});
  const isMetaMaskInstalled = () => {
    const {ethereum} = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  }
  if(isMetaMaskInstalled()) {
    ethereum.on('chainChanged', (_chainId) => window.location.reload());
    ethereum.on('connect', (connectInfo) => {
      if(!app.state.connected) {
        app.state.connected = true;
        //app.refresh();
      }
      app.state.wrongChain = connectInfo.chainId!==CHAIN_ID;
    });
    provider = new ethers.providers.Web3Provider(ethereum);
    signer = provider.getSigner();
  }
  else {
    //no metamask
  }
  app.controller('default', async (params) => {
    try {
      //await ethereum.request({method: 'eth_requestAccounts'});
      app.state.connected = true;
      //app.refresh();
    } catch (e) {
      throw(e);
      return;
    }
    console.log('default controller');
    if(!isMetaMaskInstalled()) return {nometamask:true};
    const pancakeFactory = new ethers.Contract(pancakeFactoryAddress, pancakeFactoryAbi, provider);
    const doSort = () => {
      switch(ctrl.sort) {
        case 'symbol':
          ctrl.coins.sort((a,b) => a.symbol > b.symbol ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'name':
          ctrl.coins.sort((a,b) => a.name > b.name ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'time60':
          ctrl.coins.sort((a,b) => a.timeData['60'] > b.timeData['60'] ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'time300':
          ctrl.coins.sort((a,b) => a.timeData['300'] > b.timeData['300'] ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'time600':
          ctrl.coins.sort((a,b) => a.timeData['600'] > b.timeData['600'] ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'reserve0':
          ctrl.coins.sort((a,b) => +a.bnbReserve > +b.bnbReserve ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'reserve1':
          ctrl.coins.sort((a,b) => +a.tokenReserve > +b.tokenReserve ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
        case 'price':
          ctrl.coins.sort((a,b) => +a.price > +b.price ? -1 * ctrl.sortDir : 1 * ctrl.sortDir); break;
      }
    };
    const redrawCoinTable = () => {
      app.$('table.coin-table tbody').innerHTML = ctrl.coins.map(c => app.$t('coin', c)).join('');
    }
    const updateCoinData = async () => {
      const now = new Date().getTime();
      for(let f=0; f<ctrl.coins.length; f++) {
        const coin = ctrl.coins[f];
        if(!coin.pairAddress) {
          coin.pairAddress = await pancakeFactory.getPair(coin.token0, coin.address);
        }
        coin.timeData = coin.buyHistory.reduce((res, hist) => {
          Object.keys(res).forEach(key => {
            if(hist.x > now - (+key * 1000)) {
              res[key]+=hist.v;
            }
          })
          return res;
        }, {'60':0,'300':0,'600':0});
        if(coin.timeData['60'] || coin.resCooldown++ > 200) {
          coin.resCooldown = 0;
          const pairContract = new ethers.Contract(coin.pairAddress, lpAbi, provider);
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
        }
      }
      doSort();
      redrawCoinTable();
    }
    const ctrl = {
      coins: [],
      sort: 'time60',
      sortDir: 1,
      setSort: (name) => {
        console.log('setting sort', name);
        if(name!==ctrl.sort) ctrl.sortDir = 1;
        else ctrl.sortDir *= -1;
        ctrl.sort = name;
        doSort();
        redrawCoinTable();
        app.$('table.coin-table thead').innerHTML = app.$t('coin-header', ctrl);
      },
      connect: async () => {
        const filter = {
          topics: [
            ethers.utils.id('Transfer(address,address,uint256)'),
            ethers.utils.hexZeroPad('0x10ed43c718714eb63d5aa57b78b54704e256024e', 32)
          ]
        }
        provider.on(filter, async (log, event) => {
          //console.log('got events');
          try {
            const transaction = await provider.getTransaction(log.transactionHash);
            const iface = new ethers.utils.Interface(pancakeRouterAbi);
            const res = iface.decodeFunctionData('swapExactETHForTokens', transaction.data);
            const contract = new ethers.Contract(res.path[1], bep20Abi, provider);
            const name = await contract.name();
            const symbol = await contract.symbol();
            const decimals = await contract.decimals();
            let coin = ctrl.coins.find(c => c.address===res.path[1]);
            const now = new Date().getTime();
            if(coin) {
              coin.volume++;
            }
            else {
              coin = {
                address: res.path[1],
                token0: res.path[0],
                name, symbol, decimals,
                volume: 1,
                buyHistory: [{x: now, v: 1}],
                resCooldown: 0
              };
              ctrl.coins.push(coin);
            }
            if(coin.buyHistory[0].x < now + 100) {
              coin.buyHistory[0].v++;
            }
            else {
              coin.buyHistory.unshift({
                x: now,
                v: 1
              })
            }
            //app.refresh();
          } catch(e) {
            //console.log('error', e)
          }
        })
        setInterval(updateCoinData, 1000)
      }
    }
    ctrl.connect();
    return ctrl;
  })
}).start()