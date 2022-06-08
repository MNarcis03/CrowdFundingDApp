pragma solidity ^0.5.5;

contract IpfsHashStorage {
  mapping (address => string) accountsIpfsHashes_;
  address[] accounts_;

  function setAccountIpfsHash(string memory _ipfsHash) public {
    address account = msg.sender;

    require (false == accountHasIpfsHash(account), "setAccountIpfsHash(): Invalid Account!");

    accountsIpfsHashes_[account] = _ipfsHash;
    accounts_.push(account);
  }

  function getAccountIpfsHash(address _account) public view returns (string memory) {
    require (true == accountHasIpfsHash(_account), "getAccountIpfsHash(): Invalid Account!");

    return accountsIpfsHashes_[_account];
  }

  function getAccounts() public view returns (address [] memory) {
    return accounts_;
  }

  function accountHasIpfsHash(address _account) public view returns (bool) {
    require (_account != address(0), "accountHasIpfsHash(): Invalid User!");

    for (uint it = 0; it < accounts_.length; it++) {
      if (accounts_[it] == _account) {
        return true;
      }
    }

    return false;
  }
}
