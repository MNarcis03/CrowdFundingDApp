const CrowdFundingToken = artifacts.require("./CrowdFundingToken.sol");
const TokenCrowdsale = artifacts.require("./TokenCrowdsale.sol");
const CrowdFunding = artifacts.require("./CrowdFunding.sol");
const IpfsHastStorage = artifacts.require("./IpfsHashStorage.sol");

module.exports = async (deployer, network, [owner]) => {
  await deployer.deploy(CrowdFundingToken, "Crowd Funding Token", "CFT", 3, 100000);
  const crowdFundingToken = await CrowdFundingToken.deployed();

  await deployer.deploy(TokenCrowdsale, 2, owner, crowdFundingToken.address);
  const tokenCrowdsale = await TokenCrowdsale.deployed();

  await crowdFundingToken.transfer(tokenCrowdsale.address, await crowdFundingToken.totalSupply());

  await deployer.deploy(CrowdFunding, crowdFundingToken.address);
  await deployer.deploy(IpfsHastStorage);
};
