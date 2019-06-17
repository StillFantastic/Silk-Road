var ERC20 = artifacts.require("SilkToken");


module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(ERC20);
  });
};
