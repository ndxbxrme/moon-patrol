import './index.css';
const TurboMini = require('turbomini');
const Transfers = require('./components/transfers.js');
const Num = require('./components/num.js');
const forwarderOrigin = window.location.href;
window.app = TurboMini('/moon-patrol');
app.run((app) => {
  ['buyer', 'buyer-header', 'buyers', 'coin', 'coin-header', 'default', 'page-top'].forEach(name => app.template(name, require('./templates/' + name + '.html')));
  app.useHash = true;
  const transfers = Transfers(app, forwarderOrigin);
  Num(app);
  app.controller('default', async (params) => {
    if(!window.ethereum) return {nometamask:true};
    transfers.redrawTableBody = (ctrl) => {
      app.$('transaction-count').innerText = ctrl.transactionCount;
      app.$('table.coin-table tbody').innerHTML = ctrl.coins.map(c => app.$t('coin', c)).join('');
    }
    transfers.redrawTableHead = (ctrl) => app.$('table.coin-table thead').innerHTML = app.$t('coin-header', ctrl);
    transfers.setSort('time60');
    return transfers;
  });
  app.controller('buyers', async (params) => {
    if(!window.ethereum) return {nometamask:true};
    transfers.redrawTableBody = (ctrl) => {
      app.$('transaction-count').innerText = ctrl.transactionCount;
      app.$('table.buyer-table tbody').innerHTML = ctrl.buyers.filter((b,i) => i < 100).map(c => app.$t('buyer', c)).join('');
    }
    transfers.redrawTableHead = (ctrl) => app.$('table.buyer-table thead').innerHTML = app.$t('buyer-header', ctrl);
    transfers.setSort('nocoins');
    return transfers;
  });
}).start()