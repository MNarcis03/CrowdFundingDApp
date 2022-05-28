pragma solidity ^0.5.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrowdFunding {
  IERC20 public crowdFundingToken_;

  struct CrowdFundingProject {
    address owner;
    string name;
    bool approved;
    bool open;
    uint256 goal;
    uint256 balance;
    mapping (address => uint256) fundersBalances;
    address [] funders;
  }

  mapping (uint256 => CrowdFundingProject) private projects_;
  uint256 private lastProjectId_;

  mapping (address => uint256 []) private ownerProjects_;
  address [] private owners_;

  mapping (address => uint256 []) private userFundedProjects_;
  address [] private funders_;

  constructor(IERC20 _crowdFundingToken) public {
    crowdFundingToken_ = _crowdFundingToken;
    lastProjectId_ = 0;
  }

  function getOwner(uint256 _projectId) public view returns (address) {
    require (_projectId < lastProjectId_, "getOwner(): Invalid Project!");
    return projects_[_projectId].owner;
  }

  function getName(uint256 _projectId) public view returns (string memory) {
    require (_projectId < lastProjectId_, "getName(): Invalid Project!");
    return projects_[_projectId].name;
  }

  function isApproved(uint256 _projectId) public view returns (bool) {
    require (_projectId < lastProjectId_, "isApproved(): Invalid Project!");
    return projects_[_projectId].approved;
  }

  function isOpen(uint256 _projectId) public view returns (bool) {
    require (_projectId < lastProjectId_, "isOpen(): Invalid Project!");
    return projects_[_projectId].open;
  }

  function getGoal(uint256 _projectId) public view returns (uint256) {
    require (_projectId < lastProjectId_, "getGoal(): Invalid Project!");
    return projects_[_projectId].goal;
  }

  function getBalance(uint256 _projectId) public view returns (uint256) {
    require (_projectId < lastProjectId_, "getBalance(): Invalid Project!");
    return projects_[_projectId].balance;
  }

  function getFunderBalance(uint256 _projectId, address _funder) public view returns (uint256) {
    require (_projectId < lastProjectId_, "getFunderBalance(): Invalid Project!");
    return projects_[_projectId].fundersBalances[_funder];
  }

  function getLastProjectId() public view returns (uint256) {
    return lastProjectId_;
  }

  function getOwnerProjects(address _owner) public view returns (uint256 [] memory) {
    require (
      ownerProjects_[_owner].length > 0,
      "getOwnerProjects(): Invalid Address / No Projects Available!"
    );

    return ownerProjects_[_owner];
  }

  function getUserFundedProjects(address _user) public view returns (uint256 [] memory) {
    require (
      userFundedProjects_[_user].length > 0,
      "getUserFundedProjects(): Invalid Address / No Projects Available!"
    );

    return userFundedProjects_[_user];
  }

  function create(string memory _name, uint32 _goal) public returns (bool) {
    projects_[lastProjectId_].owner = msg.sender;
    projects_[lastProjectId_].name = _name;
    projects_[lastProjectId_].approved = false;
    projects_[lastProjectId_].open = true;
    projects_[lastProjectId_].goal = _goal;
    projects_[lastProjectId_].balance = 0;

    ownerProjects_[msg.sender].push(lastProjectId_);
    owners_.push(msg.sender);

    lastProjectId_ = lastProjectId_ + 1;

    return true;
  }

  function approve(uint256 _projectId) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      false == projects_[_projectId].approved,
      "approve(): Invalid Project/Project Closed/Project Approved!"
    );

    projects_[_projectId].approved = true;

    return true;
  }

  function deposit(uint256 _projectId, uint256 _amount) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      true == projects_[_projectId].approved &&
      _amount > 0,
      "deposit(): Invalid Project/Project Closed/Project NOT Approved/Invalid Amount!"
    );

    crowdFundingToken_.transferFrom(msg.sender, address(this), _amount);

    projects_[_projectId].balance += _amount;
    projects_[_projectId].fundersBalances[msg.sender] += _amount;

    bool funderFound = false;

    for (uint it = 0; it < projects_[_projectId].funders.length; it++) {
      if (msg.sender == projects_[_projectId].funders[it]) {
        funderFound = true;
      }
    }

    if (false == funderFound) {
      projects_[_projectId].funders.push(msg.sender);

      userFundedProjects_[msg.sender].push(_projectId);
      funders_.push(msg.sender);
    }

    return true;
  }

  function withdraw(uint256 _projectId, uint256 _amount) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      true == projects_[_projectId].approved &&
      _amount <= projects_[_projectId].fundersBalances[msg.sender],
      "withdraw(): Invalid Project/Project Closed/Project NOT Approved/Invalid Amount!"
    );

    crowdFundingToken_.approve(msg.sender, _amount);

    projects_[_projectId].balance -= _amount;
    projects_[_projectId].fundersBalances[msg.sender] -= _amount;

    return true;
  }

  function close(uint256 _projectId) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      true == projects_[_projectId].open &&
      true == projects_[_projectId].approved &&
      msg.sender == projects_[_projectId].owner,
      "close(): Invalid Project/Project Closed/Project NOT Approved/Unknown Sender!"
    );

    projects_[_projectId].open = false;

    return true;
  }

  function distributeFunding(uint256 _projectId) public returns (bool) {
    require (
      _projectId < lastProjectId_ &&
      false == projects_[_projectId].open &&
      true == projects_[_projectId].approved &&
      msg.sender == projects_[_projectId].owner,
      "distributeFunding(): Invalid Project/Project Open/Project NOT Approved/Unknown Sender!"
    );

    crowdFundingToken_.transferFrom(address(this), msg.sender, projects_[_projectId].balance);

    return true;
  }
}
