pragma solidity ^0.5.5;

import "@openzeppelin/contracts/crowdsale/Crowdsale.sol";

contract TokenCrowdsale is Crowdsale {
  constructor(
    uint256 _rate,
    address payable _wallet,
    IERC20 _token
  )
    Crowdsale(_rate, _wallet, _token)
    public
  {}
}
