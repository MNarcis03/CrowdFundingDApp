import Web3 from "web3";

const getWeb3 = () => new Promise((resolve, reject) => {
  console.log("Called getWeb3");

  function winLoad(callback) {
    if (document.readyState === 'complete') {
      callback();
    } else {
      window.addEventListener("load", callback);
    }
  }

  // Wait for loading completion to avoid race conditions with web3 injection timing.
  winLoad(async () => {
    console.log("Webpage loaded...");
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      console.log("Injected web3 detected.");

      try {
        // Request account access if needed
        await window.ethereum.enable();
        // Acccounts now exposed
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    } else if (window.web3) {
      // Legacy dapp browsers...
      // Use Mist/MetaMask's provider.
      const web3 = window.web3;
      console.log("Injected web3 detected.");
      resolve(web3);
    } else {
      // Fallback to localhost; use dev console port by default...
      const provider = new Web3.providers.HttpProvider(
        "http://127.0.0.1:8545"
      );
      const web3 = new Web3(provider);
      console.log("No web3 instance injected, using Local web3.");
      resolve(web3);
    }
  });
});

export default getWeb3;
