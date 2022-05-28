import React, { Component } from "react";
import { withRouter } from "react-router";
import {
  Alert,
  Container, Row,
  Card,
  ButtonGroup, Button,
  FormControl,
  InputGroup,
  Spinner
} from "react-bootstrap";

import BigNumber from "bignumber.js";

import getWeb3 from "./../../utils/getWeb3";
import ipfs from "./../../utils/ipfs";
import session from "./../../utils/session";

import CrowdFunding from "./../../contracts/CrowdFunding.json";
import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";

import "./ViewProject.css";

class ViewProject extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      networkId: null,
      contracts: {
        crowdFunding: null,
        ipfsHashStorage: null,
        crowdsale: null,
        token: null,
      },
      token: {
        symbol: "",
        decimals: 0,
        accountBalance: 0,
      },
      userAccount: {
        isLoggedIn: false,
        isOwner: false,
      },
      view: {
        loaded: false,
        active: {
          deposit: true,
          withdraw: false,
          owner: false,
        },
        data: {
          fetched: {
            project: null,
          },
          inputGroup: {
            deposit: {
              amount: 0,
            },
            withdraw: {
              amount: 0,
            },
          },
        },
        enumeration: {
          E_DEPOSIT_VIEW: 0,
          E_WITHDRAW_VIEW: 1,
          E_OWNER_VIEW: 2,
        },
      },
    };

    this.fetchProject = this.fetchProject.bind(this);
    this.getOwnerName = this.getOwnerName.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.userIsOwner = this.userIsOwner.bind(this);
    this.deposit = this.deposit.bind(this);
    this.withdraw = this.withdraw.bind(this);
    this.close = this.close.bind(this);
    this.changeDepositAmount = this.changeDepositAmount.bind(this);
    this.changeWithdrawAmount = this.changeWithdrawAmount.bind(this);
    this.setView = this.setView.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();

      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        CrowdFunding.networks[networkId] &&
        CrowdFunding.networks[networkId].address,
      );

      const ipfsHashStorage = new web3.eth.Contract(
        IpfsHashStorage.abi,
        IpfsHashStorage.networks[networkId] &&
        IpfsHashStorage.networks[networkId].address,
      );

      const crowdsale = new web3.eth.Contract(
        TokenCrowdsale.abi,
        TokenCrowdsale.networks[networkId] &&
        TokenCrowdsale.networks[networkId].address,
      );

      const crowdsaleToken = await crowdsale.methods.token().call();

      const token = new web3.eth.Contract(
        CrowdFundingToken.abi, crowdsaleToken
      );

      const symbol = await token.methods.symbol().call();
      const decimals = await token.methods.decimals().call();
      const accountBalance = await token.methods.balanceOf(accounts[0]).call();

      this.setState({
        web3,
        networkId,
        accounts,
        contracts: {
          crowdFunding, ipfsHashStorage,
          crowdsale, token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          accountBalance
        },
      });

      let { view } = this.state;

      const projectId = this.props.match.params.id;
      view.data.fetched.project = await this.fetchProject(projectId);

      if (null !== view.data.fetched.project) {
        this.setState({ view });

        const isLoggedIn = await this.userIsLoggedIn();

        if (true === isLoggedIn) {
          const isOwner = await this.userIsOwner(projectId);

          this.setState({
            userAccount: {
              isLoggedIn, isOwner,
            }
          });
        }
      }

      view.loaded = true;
      this.setState({ view });
    } catch (err) {
      let { view } = this.state;

      view.loaded = true;
      this.setState({ view });

      console.error("Err @ ComponentDidMount():", err.message);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }
  }

  fetchProject = async (_projectId) => {
    let project = {};

    if (_projectId && _projectId >= 0) {
      try {
        const { accounts } = this.state;
        const { crowdFunding } = this.state.contracts;

        const lastProjectId = await crowdFunding.methods.getLastProjectId().call();

        if (_projectId < lastProjectId) {
          const isApproved = await crowdFunding.methods.isApproved(_projectId).call();

          if (true === isApproved) {
            project.id = _projectId;
            project.isApproved = isApproved;

            const ownerAddr = await crowdFunding.methods.getOwner(_projectId).call();
            project.owner = await this.getOwnerName(ownerAddr);

            project.name = await crowdFunding.methods.getName(_projectId).call();
            project.isOpen = await crowdFunding.methods.isOpen(_projectId).call();
            project.goal = await crowdFunding.methods.getGoal(_projectId).call();
            project.balance = await crowdFunding.methods.getBalance(_projectId).call();
            project.funderBalance =
              await crowdFunding.methods.getFunderBalance(
                _projectId, accounts[0]
              ).call();
          }
        }
      } catch (err) {
        console.error("Err @ fetchProject():", err.message);
        project = null;
      }
    }

    return project;
  }

  getOwnerName = async (_ownerAddr) => {
    let ownerName = "";

    try {
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_ownerAddr).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (decodedIpfsContent.username) {
        ownerName = decodedIpfsContent.username;
      }
    } catch(err) {
      console.error("Err @ getOwnerName():", err.message);
    }

    return ownerName;
  }

  decodeIpfsContent = async (_ipfsContent) => {
    try {
      const decoder = new TextDecoder("utf-8");

      let decodedContent = "";

      for await (const chunk of _ipfsContent) {
        decodedContent += decoder.decode(chunk, { stream: true });
      }

      decodedContent += decoder.decode();

      return JSON.parse(decodedContent);
    } catch (err) {
      console.error("Err @ decodeIpfsContent():", err.message);
    }

    return null;
  }

  userIsLoggedIn = async () => {
    if (false === session.sessionExpired()) {
      if (true === await this.userHasAccount()) {
        return true;
      }
    }

    return false;
  }

  userHasAccount = async () => {
    try {
      const { accounts } = this.state;
      const { ipfsHashStorage } = this.state.contracts;

      const response = await ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  userIsOwner = async (_projectId) => {
    try {
      const { accounts } = this.state;
      const { crowdFunding } = this.state.contracts;

      const ownerAddr = await crowdFunding.methods.getOwner(_projectId).call();

      if (ownerAddr === accounts[0]) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userIsOwner():", err.message);
    }

    return false;
  }

  deposit = async () => {
    try {
      const { accounts, networkId, contracts } = this.state;
      let { token, view } = this.state;

      const crowdFundingAddress =
        CrowdFunding.networks[networkId] &&
        CrowdFunding.networks[networkId].address;

      await contracts.token.methods.approve(
        crowdFundingAddress,
        view.data.inputGroup.deposit.amount * token.decimals
      ).send({ from: accounts[0] });

      await contracts.crowdFunding.methods.deposit(
        view.data.fetched.project.id,
        view.data.inputGroup.deposit.amount * token.decimals
      ).send({ from: accounts[0] });

      const accountBalance = await contracts.token.methods.balanceOf(accounts[0]).call();
      token.accountBalance = new BigNumber(accountBalance);
      this.setState({ token });

      view.data.fetched.project.balance =
        await contracts.crowdFunding.methods.getBalance(
          view.data.fetched.project.id
        ).call();

      view.data.fetched.project.funderBalance =
        await contracts.crowdFunding.methods.getFunderBalance(
          view.data.fetched.project.id, accounts[0]
        ).call();

      this.setState({ view });

      alert(
        `Thank you for supporting our community!`,
      );
    } catch (err) {
      console.error("Err @ deposit(): ", err.message);

      alert(
        `Transaction failed or was rejected. Check console for details.`,
      );
    }
  }

  withdraw = async () => {
    try {
      const { accounts, networkId, contracts } = this.state;
      let { token, view } = this.state;

      const crowdFundingAddress =
        CrowdFunding.networks[networkId] && CrowdFunding.networks[networkId].address;

      await contracts.crowdFunding.methods.withdraw(
        view.data.fetched.project.id,
        view.data.inputGroup.withdraw.amount * token.decimals
      ).send({ from: accounts[0] });

      await contracts.token.methods.transferFrom(
        crowdFundingAddress, accounts[0],
        view.data.inputGroup.withdraw.amount * token.decimals
      ).send({ from: accounts[0] });;

      const accountBalance = await contracts.token.methods.balanceOf(accounts[0]).call();
      token.accountBalance = new BigNumber(accountBalance);
      this.setState({ token });

      view.data.fetched.project.balance =
        await contracts.crowdFunding.methods.getBalance(
          view.data.fetched.project.id
        ).call();

      view.data.fetched.project.funderBalance =
        await contracts.crowdFunding.methods.getFunderBalance(
          view.data.fetched.project.id, accounts[0]
        ).call();

      this.setState({ view });

      alert(
        `Thank you for supporting our community!`,
      );
    } catch (err) {
      console.error("Err @ withdraw(): ", err.message);

      alert(
        `Transaction failed or was rejected. Check console for details.`,
      );
    }
  }

  close = async () => {
    try {
      const { accounts, contracts } = this.state;
      let { view } = this.state;

      await contracts.crowdFunding.methods.close(
        view.data.fetched.project.id
      ).send({ from: accounts[0] });

      view.data.fetched.project.isOpen = false;
      this.setState({ view });

      alert(
        `Thank you for supporting our community!`,
      );
    } catch (err) {
      console.error("Err @ close():", err.message);

      alert(
        `Transaction failed or was rejected. Check console for details.`,
      );
    }
  }

  changeDepositAmount(_event) {
    let { view } = this.state;

    if (_event && _event.target.value) {
      const { token } = this.state;

      const balance = token.accountBalance / token.decimals;

      if ((_event.target.value >= 1) && (_event.target.value <= balance)) {
        view.data.inputGroup.deposit.amount = _event.target.value;
        this.setState({ view });
      }
    } else {
      view.data.inputGroup.deposit.amount = 0;
      this.setState({ view });
    }
  }

  changeWithdrawAmount(_event) {
    let { view } = this.state;

    if (_event && _event.target.value) {
      const { token } = this.state;

      const balance = token.accountBalance / token.decimals;

      if ((_event.target.value >= 1) && (_event.target.value <= balance)) {
        view.data.inputGroup.withdraw.amount = _event.target.value;
        this.setState({ view });
      }
    } else {
      view.data.inputGroup.withdraw.amount = 0;
      this.setState({ view });
    }
  }

  setView(_view) {
    let { view } = this.state;

    if (_view === view.enumeration.E_DEPOSIT_VIEW) {
      view.active.deposit = true;
      view.active.withdraw = false;
      view.active.owner = false;
    } else if (_view === view.enumeration.E_WITHDRAW_VIEW) {
      view.active.deposit = false;
      view.active.withdraw = true;
      view.active.owner = false;
    } else if (_view === view.enumeration.E_OWNER_VIEW) {
      view.active.deposit = false;
      view.active.withdraw = false;
      view.active.owner = true;
    }

    this.setState({ view });
  }

  render() {
    const { web3, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="DiscoverProjects" style={{ width: "100%", height: "60%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Project...
                  </Card.Title>

                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </>
              //else
              :
                //if
                (
                  (null !== web3) && (null !== accounts) &&
                  (null !== contracts.crowdFunding) && (null !== contracts.token) &&
                  (null !== contracts.crowdsale) && (null !== contracts.ipfsHashStorage)
                ) ?
                  //if
                  (null !== view.data.fetched.project) ?
                    <>
                      <Card.Title className="display-6 mb-3">
                        { view.data.fetched.project.name }
                      </Card.Title>

                      <Card.Text className="text-muted mb-3">
                        Created by { view.data.fetched.project.owner }
                      </Card.Text>

                      <ButtonGroup className="mb-3" style={{ width: "30%" }}>
                        {
                          //if
                          (true === userAccount.isOwner) ?
                            <>
                              <Button
                                type="submit"
                                onClick={ () => this.setView(view.enumeration.E_DEPOSIT_VIEW) }
                                active={ view.active.deposit }
                                variant="outline-secondary"
                                className="fw-bold"
                                style={{ width: "33%" }}
                              >
                                Deposit
                              </Button>

                              <Button
                                type="submit"
                                onClick={ () => this.setView(view.enumeration.E_WITHDRAW_VIEW) }
                                active={ view.active.withdraw }
                                variant="outline-secondary"
                                className="fw-bold"
                                style={{ width: "33%" }}
                              >
                                Withdraw
                              </Button>

                              <Button
                                type="submit"
                                onClick={ () => this.setView(view.enumeration.E_OWNER_VIEW) }
                                active={ view.active.owner }
                                variant="outline-secondary"
                                className="fw-bold"
                                style={{ width: "33%" }}
                              >
                                For Owner
                              </Button>
                            </>
                          //else
                          :
                            <>
                              <Button
                                type="submit"
                                onClick={ () => this.setView(view.enumeration.E_DEPOSIT_VIEW) }
                                active={ view.active.deposit }
                                variant="outline-secondary"
                                className="fw-bold"
                                style={{ width: "50%" }}
                              >
                                Deposit
                              </Button>

                              <Button
                                type="submit"
                                onClick={ () => this.setView(view.enumeration.E_WITHDRAW_VIEW) }
                                active={ view.active.withdraw }
                                variant="outline-secondary"
                                className="fw-bold"
                                style={{ width: "50%" }}
                              >
                                Withdraw
                              </Button>
                            </>
                          //endif
                        }
                      </ButtonGroup>

                      {
                        //if
                        (true === view.active.deposit) ?
                          <>
                            <Card.Text className="lead">
                              {
                                view.data.fetched.project.isOpen ?
                                  "Open For Funding" : "Funding Finished"
                              }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              { view.data.fetched.project.balance / token.decimals }/
                              { view.data.fetched.project.goal / token.decimals } { token.symbol } Total Funding {
                                //if
                                (view.data.fetched.project.funderBalance > 0) ?
                                  <>
                                    ({
                                      view.data.fetched.project.funderBalance /
                                      token.decimals
                                    } { token.symbol } Funded By You)
                                  </>
                                //else
                                : <></>
                                //endif
                              }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              Your Account's Balance: { token.accountBalance / token.decimals } { token.symbol }
                            </Card.Text>

                            <Row className="mb-3 justify-content-md-center">
                              <InputGroup  style={{ width: "30%" }}>
                                <InputGroup.Text>{ token.symbol } Amount</InputGroup.Text>

                                <FormControl
                                  type="number"
                                  placeholder={ `Enter ${ token.symbol } Amount` }
                                  aria-label={ `How many ${ token.symbol } you deposit?` }
                                  value={ view.data.inputGroup.deposit.amount }
                                  min="1"
                                  onChange={ this.changeDepositAmount }
                                  required
                                />

                                <Button
                                  type="submit"
                                  variant="outline-secondary"
                                  disabled={ !userAccount.isLoggedIn || !view.data.fetched.project.isOpen }
                                  onClick={ this.deposit }
                                >
                                  Deposit
                                </Button>
                              </InputGroup>
                            </Row>

                            <a href="/crowdsale" className="text-muted" style={{ color: "black" }}>
                              Need more { token.symbol } to back this project?
                            </a>
                          </>
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.withdraw) ?
                          <>
                            <Card.Text className="lead">
                              {
                                view.data.fetched.project.isOpen ?
                                  "Open For Withdrawing Funds" : "Funding Finished"
                              }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              { view.data.fetched.project.balance / token.decimals }/
                              { view.data.fetched.project.goal / token.decimals } { token.symbol } Total Funding {
                                //if
                                (view.data.fetched.project.funderBalance > 0) ?
                                  <>
                                    ({
                                      view.data.fetched.project.funderBalance /
                                      token.decimals
                                    } { token.symbol } Funded By You)
                                  </>
                                //else
                                : <></>
                                //endif
                              }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              Your Account's Balance: { token.accountBalance / token.decimals } { token.symbol }
                            </Card.Text>

                            <Row className="mb-3 justify-content-md-center">
                              <InputGroup style={{ width: "30%" }}>
                                <InputGroup.Text>{ token.symbol } Amount</InputGroup.Text>

                                <FormControl
                                  type="number"
                                  placeholder={ `Enter ${ token.symbol } Amount` }
                                  aria-label={ `How many ${ token.symbol } you withdraw?` }
                                  value={ view.data.inputGroup.withdraw.amount }
                                  min="1"
                                  onChange={ this.changeWithdrawAmount }
                                  required
                                />

                                <Button
                                  type="submit"
                                  variant="outline-secondary"
                                  disabled={ !userAccount.isLoggedIn || !view.data.fetched.project.isOpen }
                                  onClick={ this.withdraw }
                                >
                                  Withdraw
                                </Button>
                              </InputGroup>
                            </Row>
                          </>
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.owner) ?
                          <>
                            <Card.Text className="lead">
                              {
                                view.data.fetched.project.isOpen ?
                                  "Funding Ongoing" : "Funding Finished"
                              }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              Total Funding: {
                                view.data.fetched.project.balance / token.decimals
                              }/{ 
                                view.data.fetched.project.goal / token.decimals
                              } { token.symbol }
                            </Card.Text>

                            <Card.Text className="text-muted">
                              Your Account's Balance: { token.accountBalance / token.decimals } { token.symbol }
                            </Card.Text>

                            <Row className="text-center justify-content-md-center">
                              <Button
                                  type="submit"
                                  variant="outline-secondary"
                                  disabled={ !userAccount.isLoggedIn || !view.data.fetched.project.isOpen }
                                  onClick={ this.close }
                                  style={{ width: "10%" }}
                                >
                                  Close Project
                                </Button>
                            </Row>
                          </>
                        //else
                        : <></>
                        //endif
                      }
                    </>
                  //else
                  :
                    <Row className="justify-content-md-center mt-5">
                      <Alert variant="light" style={{ width: "50%" }}>
                        <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
                        <p className="lead">Project not loaded...</p>

                        <hr />

                        <p className="mb-0">
                          Invalid project ID / Failed to load project from Blockchain.
                        </p>
                      </Alert>
                    </Row>
                  //endif
                //else
                :
                  <Row className="justify-content-md-center mt-5">
                    <Alert variant="light" style={{ width: "50%" }}>
                      <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
                      <p className="lead">Web3, accounts or contracts not loaded...</p>

                      <hr />

                      <p className="mb-0">
                        Make sure you have MetaMask installed and your account is connected to Crowd Funding ETH.
                      </p>
                    </Alert>
                  </Row>
                //endif
              //endif
            }
          </Card.Body>
        </Card>
      </Container>
    );
  }
}

export default withRouter(ViewProject);
