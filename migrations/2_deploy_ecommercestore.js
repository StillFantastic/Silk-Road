var EcommerceStore = artifacts.require("./EcommerceStore.sol");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(EcommerceStore, "0x3ea99197e3E2F8037ed87B9586ECee75283A12ad");
  });
};

