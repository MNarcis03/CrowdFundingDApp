pragma solidity ^0.5.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract CrowdFundingToken is Context, ERC20, ERC20Detailed {
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _amount
  )
    ERC20Detailed(_name, _symbol, _decimals)
    public
  {
    _mint(_msgSender(), _amount * (10 ** uint256(_decimals)));
  }
}
