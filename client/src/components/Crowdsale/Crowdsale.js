import React, { Component } from "react";
import { Alert, Container, Row, Card, Button, InputGroup, FormControl } from "react-bootstrap";

import BigNumber from "bignumber.js";

import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";
import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Crowdsale.css";

class Crowdsale extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      deployedNetwork: null,
      crowdsale: null,
      token: null,
      ipfsHashStorage: null,
      symbol: 0,
      rate: 0,
      decimals: 0,
      tokenBalance: 0,
      accountBalance: 0,
      amount: 1,
      session: session,
      loggedIn: false
    }

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.getPrice = this.getPrice.bind(this);
    this.changeAmount = this.changeAmount.bind(this);
    this.buy = this.buy.bind(this);
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      const networkId = await web3.eth.net.getId();
      const deployedNetwork = TokenCrowdsale.networks[networkId];

      // Get the token crowdsale contract instance.
      const crowdsaleInstance = new web3.eth.Contract(
        TokenCrowdsale.abi,
        deployedNetwork && deployedNetwork.address,
      );

      const rate = await crowdsaleInstance.methods.rate().call();
      const token = await crowdsaleInstance.methods.token().call();

      // Get the crowdfunding token instance.
      const tokenInstance = new web3.eth.Contract(
        CrowdFundingToken.abi, token
      );

      const symbol = await tokenInstance.methods.symbol().call();
      const decimals = await tokenInstance.methods.decimals().call();
      const tokenBalance = await tokenInstance.methods.balanceOf(deployedNetwork && deployedNetwork.address).call();
      const accountBalance = await tokenInstance.methods.balanceOf(accounts[0]).call();

      this.setState({
        web3,
        accounts,
        deployedNetwork,
        crowdsale: crowdsaleInstance,
        token: tokenInstance,
        symbol,
        rate,
        decimals: 10 ** decimals,
        tokenBalance: new BigNumber(tokenBalance),
        accountBalance: new BigNumber(accountBalance)
      });

      const ipfsHashStorageDeployedNetwork = IpfsHashStorage.networks[networkId];
      const ipfsHashStorage = new web3.eth.Contract(
        IpfsHashStorage.abi,
        ipfsHashStorageDeployedNetwork && ipfsHashStorageDeployedNetwork.address,
      );

      this.setState({ ipfsHashStorage });

      if (true === await this.userIsLoggedIn()) {
        this.setState({ loggedIn: true });
      }
    } catch (error) {
      console.error("ComponentDinMount(): ", error);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }
  }

  userIsLoggedIn = async () => {
    const { session } = this.state;

    if (false === session.sessionExpired()) {
      if (true === await this.userExists()) {
        return true;
      }
    }

    return false;
  }

  userExists = async () => {
    const { ipfsHashStorage, accounts } = this.state;

    try {
      const response = await ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();
      console.log("ipfsHashStorage.methods.accountHasIpfsHash(): ", response);

      if (true === response) {
        return true;
      }
    } catch (error) {
      console.log("Err @ userExists(): ", error);
    }

    return false;
  }

  getPrice() {
    const { amount, rate } = this.state;
    return amount / rate;
  }

  changeAmount(event) {
    if (event && event.target.value >= 1) {
      this.setState({ amount: event.target.value });
    } else {
      this.setState({ amount: 1 });
    }
  }

  buy(event) {
    const { decimals, accounts, deployedNetwork, crowdsale, token } = this.state;
    const value = this.getPrice() * decimals;

    (async () => {
      try {
        await crowdsale.methods.buyTokens(accounts[0]).send({ value, from: accounts[0] });

        const tokenBalance = await token.methods.balanceOf(deployedNetwork && deployedNetwork.address).call();
        const accountBalance = await token.methods.balanceOf(accounts[0]).call();

        this.setState({
          tokenBalance: new BigNumber(tokenBalance),
          accountBalance: new BigNumber(accountBalance)
        });

        alert(
          `Thank you for buying CFT and supporting our community!`,
        );
      } catch (error) {
        console.log("buy(): ", error);
        alert(
          `Transaction failed or was rejected. Check console for details.`,
        );
      }
    })();

    event.preventDefault();
    event.stopPropagation();
  }

  render() {
    if (!this.state.web3 || !this.state.accounts || !this.state.crowdsale || !this.state.token) {
      return (
        <Container fluid="md" className="Crowdsale" style={{ height: "24rem" }}>
          <Row className="text-center justify-content-md-center">
            <Alert variant="light" style={{ width: "32rem" }}>
              <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
              <p className="lead">Web3, accounts or contract not loaded...</p>

              <hr />

              <p className="mb-0">
                Make sure you have MetaMask installed and your account is connected to Crowd Funding ETH.
              </p>
            </Alert>
          </Row>
        </Container>
      );
    }

    const { symbol, decimals, amount, tokenBalance, accountBalance, loggedIn } = this.state;
  
    if (true === loggedIn) {
      return (
        <Container fluid="md auto" className="Crowdsale">
          <Row className="justify-content-md-center">
            <Card className="text-center" style={{ width: "64rem" }}>
              <Card.Body className="mb-3">
                <Card.Title className="display-6 mt-3">Crowd Funding Token</Card.Title>
  
                <br />
  
                <Card.Text className="lead mb-3">
                  Your Balance: { accountBalance.div(decimals).toString() } {symbol}
                </Card.Text>
  
                <Row className="justify-content-md-center mb-3">
                  <InputGroup style={{ width: "32rem" }}>
                    <InputGroup.Text>Enter { symbol } Amount</InputGroup.Text>

                    <FormControl
                      type="number"
                      placeholder={`How many ${ symbol }s you need?`}
                      value={ amount }
                      min="1"
                      onChange={ this.changeAmount }
                      aria-label="How many tokens you need?"
                      aria-describedby="basic-addon2"
                      required
                    />
  
                    <Button
                      type="submit"
                      variant="outline-secondary"
                      disabled={ !tokenBalance }
                      onClick={ this.buy }
                    >
                      Pay { this.getPrice() } ETH
                    </Button>
                  </InputGroup>
                </Row>

                <Card.Text className="lead mb-3">
                  Only { tokenBalance.div(decimals).toString() } { symbol } is left for sale!
                </Card.Text>

                <Row className="d-inline">
                  <a href="/home" className="text-muted" style={{ color: "black" }}>
                    Is your wallet prepared to browse through projects?
                  </a>
                </Row>
              </Card.Body>
            </Card>
          </Row>
        </Container>
      );
    }

    return (
      <Container fluid="md auto" className="Crowdsale">
        <Row className="justify-content-md-center">
          <Card className="text-center" style={{ width: "64rem" }}>
            <Card.Body className="mb-3">
              <Card.Title className="display-6 mt-3">Crowd Funding Token</Card.Title>

              <br />

              <Card.Text className="lead mb-3">
                Only { tokenBalance.div(decimals).toString() } { symbol } is left for sale!
              </Card.Text>

              <Row className="justify-content-md-center mb-3">
                <InputGroup style={{ width: "32rem" }}>
                  <InputGroup.Text>Enter { symbol } Amount</InputGroup.Text>

                  <FormControl
                    type="number"
                    placeholder={`How many ${ symbol }s you need?`}
                    value={ amount }
                    min="1"
                    onChange={ this.changeAmount }
                    aria-label="How many tokens you need?"
                    aria-describedby="basic-addon2"
                    required
                  />

                  <Button
                    type="submit"
                    variant="outline-secondary"
                    disabled
                    onClick={ this.buy }
                  >
                    Pay { this.getPrice() } ETH
                  </Button>
                </InputGroup>
              </Row>

              <Card.Text className="lead mb-3">
                { symbol } is available for purchase only for Crowd Funding DApp members.
              </Card.Text>

              <Row className="d-inline">
                <a href="/register" className="text-muted" style={{ color: "black" }}>Become Member NOW!</a>
                <a href="/login" className="text-muted" style={{ color: "black" }}>Already Member?</a>
              </Row>
            </Card.Body>
          </Card>
        </Row>
      </Container>
    );
  }
}

export default Crowdsale;
