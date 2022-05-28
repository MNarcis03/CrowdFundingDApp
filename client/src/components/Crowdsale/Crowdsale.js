import React, { Component } from "react";
import { Redirect, Link } from "react-router-dom";
import {
  Container, Row,
  Alert,
  Card,
  Form, FormControl,
  InputGroup,
  ButtonGroup, Button,
  Spinner,
} from "react-bootstrap";

import BigNumber from "bignumber.js";

import getWeb3 from "./../../utils/getWeb3";
import ipfs from "./../../utils/ipfs";
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
      newtworkId: null,
      contracts: {
        crowdsale: null,
        token: null,
        ipfsHashStorage: null,
      },
      token: {
        symbol: 0,
        decimals: 0,
        rate: 0,
        balance: 0,
        accountBalance: 0,
      },
      userAccount: {
        isLoggedIn: false,
        username: "",
      },
      view: {
        loaded: false,
        active: {
          myWallet: true,
          buyTokens: false,
        },
        data: {
          form: {
            validated: false,
            submitted: false,
            failed: false,
            input: {
              amount: 0,
            },
            errors: {
              amount: null,
            },
            fieldEnumeration: {
              AMOUNT: 0,
            },
          },
        },
        enumeration: {
          E_MY_WALLET_VIEW: 0,
          E_BUY_TOKENS_VIEW: 1,
        },
      },
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.setView = this.setView.bind(this);
    this.setField = this.setField.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkErrors = this.checkErrors.bind(this);
    this.handleBuyTokens = this.handleBuyTokens.bind(this);
    this.buyTokens = this.buyTokens.bind(this);
    this.getTokenPrice = this.getTokenPrice.bind(this);
    this.resetForm = this.resetForm.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();

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

      const rate = await crowdsale.methods.rate().call();
      const crowdsaleToken = await crowdsale.methods.token().call();

      const token = new web3.eth.Contract(
        CrowdFundingToken.abi, crowdsaleToken
      );

      const symbol = await token.methods.symbol().call();
      const decimals = await token.methods.decimals().call();
      const balance =
        await token.methods.balanceOf(
          TokenCrowdsale.networks[networkId] &&
          TokenCrowdsale.networks[networkId].address
        ).call();
      const accountBalance = await token.methods.balanceOf(accounts[0]).call();

      this.setState({
        web3,
        accounts,
        networkId,
        contracts: {
          ipfsHashStorage,
          crowdsale,
          token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          rate,
          balance,
          accountBalance,
        },
      });

      const isLoggedIn = await this.userIsLoggedIn();

      if (true === isLoggedIn) {
        const username = await this.getUsername(accounts[0]);

        this.setState({
          userAccount: {
            isLoggedIn,
            username,
          },
        });
      }

      let { view } = this.state;

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
      const { accounts, contracts } = this.state;

      const response = await contracts.ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  getUsername = async (_userAddr) => {
    let username = "";

    try {
      const { accounts } = this.state;
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(accounts[0]).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (decodedIpfsContent.username) {
        username = decodedIpfsContent.username;
      }
    } catch (err) {
      console.error("Err @ getUsername():", err.message);
    }

    return username;
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

  setView(_view) {
    const { view } = this.state;

    if (view.enumeration.E_MY_WALLET_VIEW === _view) {
      if (false === view.active.myWallet) {
        view.active.myWallet = true;
        view.active.buyTokens = false;
        this.setState({ view });
      }
    } else if (view.enumeration.E_BUY_TOKENS_VIEW === _view) {
      if (false === view.active.buyTokens) {
        view.active.myWallet = false;
        view.active.buyTokens = true;
        this.setState({ view });
      }
    }
  }

  setField(_field, _value) {
    let { view } = this.state;

    if (view.data.form.fieldEnumeration.AMOUNT === _field) {
      if (_value && _value > 0) {
        view.data.form.input.amount = _value;
      } else {
        view.data.form.input.amount = 0;
      }

      if (!!view.data.form.errors.amount) {
        view.data.form.errors.amount = null;
      }
    }

    this.setState({ view });
  }

  handleSubmit(_event) {
    const form = _event.currentTarget;

    if (true === form.checkValidity()) {
      let { view } = this.state;

      const errors = this.checkErrors();

      view.data.form.errors = errors;
      this.setState({ view });

      if (Object.keys(errors).length < 1) {
        view.data.form.validated = true;
        this.setState({ view });

        (async () => {
          await this.handleBuyTokens();
        })();
      }
    }

    _event.preventDefault();
    _event.stopPropagation();
  }

  checkErrors() {
    let errors = {};

    const { token } = this.state;
    const { amount } = this.state.view.data.form.input;

    if (amount < 1) {
      errors.amount = "Please choose a valid amount of tokens to buy.";
    } else if (amount > (token.balance / token.decimals)) {
      errors.amount = "Choosen token amount exceeds the amount of tokens left for sale";
    }

    return errors;
  }

  handleBuyTokens = async () => {
    let { view } = this.state;

    const response = await this.buyTokens();

    if (true === response) {
      view.data.form.submitted = true;
    } else {
      view.data.form.validated = false;
      view.data.form.failed = true;
    }

    this.setState({ view });
  }

  buyTokens = async () => {
    try {
      const { accounts, networkId, contracts, token } = this.state;

      const tokenPrice = this.getTokenPrice();

      await contracts.crowdsale.methods.buyTokens(accounts[0]).send({
        value: tokenPrice, from: accounts[0]
      });

      const balance = await contracts.token.methods.balanceOf(
        TokenCrowdsale.networks[networkId] &&
        TokenCrowdsale.networks[networkId].address
      ).call();
      const accountBalance = await contracts.token.methods.balanceOf(accounts[0]).call();

      token.balance = balance;
      token.accountBalance = accountBalance;

      this.setState({ token });
    } catch (err) {
      console.error("Err @ buyTokens(): ", err.message);

      alert(
        `Transaction failed or was rejected. Check console for details.`,
      );

      return false;
    }

    return true;
  }

  getTokenPrice() {
    const { decimals, rate } = this.state.token;
    const { amount } = this.state.view.data.form.input;

    return (amount / rate) * decimals;
  }

  resetForm(_event) {
    let { view } = this.state;

    view.data.form.validated = false;
    view.data.form.submitted = false;
    view.data.form.failed = false;
    view.data.form.input.amount = 0;
    view.data.form.errors.amount = null;

    this.setState({ view });

    _event.preventDefault();
    _event.stopPropagation();
  }

  render() {
    const { web3, networkId, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="Crowdsale" style={{ width: "100%", height: "70%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Wallet...
                  </Card.Title>

                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </>
              //else
              :
                //if
                (
                  (null !== web3) && (null !== accounts) && (null !== networkId) &&
                  (null !== contracts.crowdFunding) && (null !== contracts.token) &&
                  (null !== contracts.crowdsale) && (null !== contracts.ipfsHashStorage)
                ) ?
                  //if
                  (true === userAccount.isLoggedIn) ?
                    <>
                      <Card.Title className="display-6 mb-5">
                        { userAccount.username }'s Wallet
                      </Card.Title>

                      <ButtonGroup className="mb-5" style={{ width: "20%" }}>
                        <Button
                          type="submit"
                          onClick={ () => this.setView(view.enumeration.E_MY_WALLET_VIEW) }
                          active={ view.active.myWallet }
                          variant="outline-secondary"
                          className="fw-bold"
                          style={{ width: "50%" }}
                        >
                          My Wallet
                        </Button>

                        <Button
                          type="submit"
                          onClick={ () => this.setView(view.enumeration.E_BUY_TOKENS_VIEW) }
                          active={ view.active.buyTokens }
                          variant="outline-secondary"
                          className="fw-bold"
                          style={{ width: "50%" }}
                        >
                          Buy Tokens
                        </Button>
                      </ButtonGroup>

                      {
                        //if
                        (true === view.active.myWallet) ?
                          <>
                            <Card.Text className="lead">
                              Account Balance: { token.accountBalance / token.decimals } { token.symbol }
                            </Card.Text>

                            <Card.Text className="lead">
                              Account Address: { accounts[0] }
                            </Card.Text>
                          </>
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.buyTokens) ?
                          //if
                          (false === view.data.form.submitted) ?
                            <>
                              {
                                //if
                                (true === view.data.form.failed) ?
                                  <Card.Text className="lead mb-3" style={{ color: "red" }}>
                                    Transaction Failed OR Was Rejected!
                                  </Card.Text>
                                //else
                                : <></>
                                //endif
                              }

                              <Row className="justify-content-md-center">
                                <Form
                                  validated={ view.data.form.validated }
                                  onSubmit={ this.handleSubmit }
                                  style={{ width: "50%" }}
                                >
                                  <Form.Group controlId="formAccountAddress">
                                    <Form.Label className="lead">Account Address</Form.Label>

                                    <Form.Control
                                      type="text"
                                      placeholder={ `${ accounts[0] }` }
                                      aria-label="Disabled Account Address"
                                      readOnly
                                    />
                                  </Form.Group>

                                  <Form.Group controlId="formAmount">
                                    <Form.Label className="lead">{ token.symbol } Amount</Form.Label>

                                    <InputGroup>
                                      <FormControl
                                        required
                                        type="number"
                                        placeholder={ `${ token.symbol } Amount` }
                                        onChange={ e => this.setField(view.data.form.fieldEnumeration.AMOUNT, e.target.value) }
                                        isInvalid={ !!view.data.form.errors.amount }
                                        value={ view.data.form.input.amount }
                                        min="0"
                                      />

                                      <InputGroup.Text>{ token.balance / token.decimals } { token.symbol } Left For Sale!</InputGroup.Text>

                                      {
                                        //if
                                        (false === view.data.form.validated) ?
                                          <Form.Control.Feedback type="invalid">
                                            { view.data.form.errors.amount }
                                          </Form.Control.Feedback>
                                        //else
                                        : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                        //endif
                                      }
                                    </InputGroup>
                                  </Form.Group>

                                  {
                                    //if
                                    (true === view.data.form.validated) ?
                                      <Spinner animation="border" role="status" className="mt-3">
                                        <span className="visually-hidden">Loading...</span>
                                      </Spinner>
                                    //else
                                    :
                                      <Button variant="outline-secondary" type="submit" className="mt-3">
                                        Pay { this.getTokenPrice() / token.decimals } ETH
                                      </Button>
                                    //endif
                                  }
                                </Form>
                              </Row>
                            </>
                          //else
                          :
                            <>
                              <Card.Text className="lead">
                                You Successfuly Purchased { view.data.form.input.amount } { token.symbol }!
                              </Card.Text>

                              <Card.Text className="lead">
                                Account Balance: { token.accountBalance / token.decimals } { token.symbol }
                              </Card.Text>

                              <Button onClick={ this.resetForm } variant="outline-secondary" className="mt-3">
                                Go Back
                              </Button>
                            </>
                          //endif
                        //else
                        : <></>
                        //endif
                      }
                    </>
                  //else
                  : <Redirect to="/login" />
                  //endif
                //else
                :
                  <Row className="justify-content-md-center mt-5">
                    <Alert variant="light" style={{ width: "50%" }}>
                      <Alert.Heading className="mb-3">Oh snap! You got an error!</Alert.Heading>

                      <p className="lead">Web3, accounts or contracts not loaded...</p>

                      <hr />

                      <p className="mb-3">
                        Make sure you have MetaMask installed and your account is connected to Crowd Funding ETH.
                      </p>

                      <Link to={{ pathname: `/startProject` }} className="btn btn-dark">
                        Reload Page
                      </Link>
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

export default Crowdsale;
