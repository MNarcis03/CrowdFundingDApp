pragma solidity ^0.5.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrowdFunding {
  IERC20 public crowdFundingToken_;

  struct CrowdFundingProject {
    address owner;
    string name;
    bool open;
    uint32 goal;
    uint32 balance;
    mapping (address => uint32) fundersBalances;
    address [] funders;
  }

  mapping (uint256 => CrowdFundingProject) private projects_;
  uint256 private lastProjectId_;

  constructor(IERC20 _crowdFundingToken) public {
    crowdFundingToken_ = _crowdFundingToken;
    lastProjectId_ = 0;
  }

  function getName(uint256 _projectId) public view returns (string memory) {
    require (_projectId < lastProjectId_, "getName(): Invalid Project!");
    return projects_[_projectId].name;
  }

  function isOpen(uint256 _projectId) public view returns (bool) {
    require (_projectId < lastProjectId_, "isOpen(): Invalid Project!");
    return projects_[_projectId].open;
  }

  function getGoal(uint256 _projectId) public view returns (uint32) {
    require (_projectId < lastProjectId_, "getGoal(): Invalid Project!");
    return projects_[_projectId].goal;
  }

  function getBalance(uint256 _projectId) public view returns (uint32) {
    require (_projectId < lastProjectId_, "getBalance(): Invalid Project!");
    return projects_[_projectId].balance;
  }

  function getLastProjectId() public view returns (uint256) {
    return lastProjectId_;
  }

  function create(string memory _name, uint32 _goal) public returns (bool) {
    projects_[lastProjectId_].owner = msg.sender;
    projects_[lastProjectId_].name = _name;
    projects_[lastProjectId_].open = true;
    projects_[lastProjectId_].goal = _goal;
    projects_[lastProjectId_].balance = 0;

    lastProjectId_ = lastProjectId_ + 1;

    return true;
  }

  function deposit(uint256 _projectId, uint32 _amount) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      _amount > 0,
      "deposit(): Invalid Project/Project Closed/Invalid Amount!"
    );

    crowdFundingToken_.transferFrom(msg.sender, address(this), _amount);

    projects_[_projectId].balance += _amount;
    projects_[_projectId].fundersBalances[msg.sender] += _amount;
    projects_[_projectId].funders.push(msg.sender);

    return true;
  }

  function withdraw(uint256 _projectId, uint32 _amount) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      _amount <= projects_[_projectId].fundersBalances[msg.sender],
      "withdraw(): Invalid Project/Project Closed/Invalid Amount!"
    );

    crowdFundingToken_.transferFrom(address(this), msg.sender, _amount);

    projects_[_projectId].balance -= _amount;
    projects_[_projectId].fundersBalances[msg.sender] -= _amount;

    return true;
  }

  function close(uint256 _projectId) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      msg.sender == projects_[_projectId].owner,
      "close(): Invalid Project/Project Closed/Unknown Sender!"
    );

    projects_[_projectId].open = false;

    return true;
  }

  function distributeFunding(uint256 _projectId) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      false == projects_[_projectId].open &&
      msg.sender == projects_[_projectId].owner,
      "distributeFunding(): Invalid Project/Project Closed/Unknown Sender!"
    );

    crowdFundingToken_.transferFrom(address(this), msg.sender, projects_[_projectId].balance);

    return true;
  }
}
