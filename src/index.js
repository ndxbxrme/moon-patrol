import './index.css';
const TurboMini = require('turbomini');
const Transfers = require('./components/transfers.js');
const Num = require('./components/num.js');
const forwarderOrigin = window.location.href;
window.app = TurboMini('/moon-patrol');
app.run(async (app) => {
  app.useHash = true;
  const transfers = Transfers(app, forwarderOrigin);
  Num(app);
  app.controller('default', async (params) => {
    if(!window.ethereum) return {nometamask:true};
    transfers.redrawTableBody = (ctrl) => app.$('table.coin-table tbody').innerHTML = ctrl.coins.map(c => app.$t('coin', c)).join('');
    transfers.redrawTableHead = (ctrl) => app.$('table.coin-table thead').innerHTML = app.$t('coin-header', ctrl);
    return transfers;
  });
  app.controller('another', async (params) => {
    if(!window.ethereum) return {nometamask:true};
    return {};
  });
}).start()