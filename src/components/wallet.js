const ethers = require('ethers');
const MetaMaskOnboarding = require('@metamask/onboarding').default;
module.exports = (app, forwarderOrigin, connect) => {
  const ctrl = {
    provider: null,
    signer: null
  }
  const onboarding = new MetaMaskOnboarding({forwarderOrigin});
  const isMetaMaskInstalled = () => {
    const {ethereum} = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  }
  console.log('chain', ethereum.chainId)
  if(isMetaMaskInstalled()) {
    ethereum.on('chainChanged', (_chainId) => window.location.reload());
    ethereum.on('connect', (connectInfo) => {
      if(!app.state.connected) {
        app.state.connected = true;
        connect();
      }
      console.log('connected');
      //app.refresh();
    });
    if(ethereum.chainId) {
      app.state.connected = true;
      connect();
    }
    ctrl.provider = new ethers.providers.Web3Provider(ethereum);
    ctrl.signer = ctrl.provider.getSigner();
  }
  else {
    //no metamask
  }
  return ctrl;
}