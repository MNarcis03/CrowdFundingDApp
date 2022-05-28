import React, { Component } from "react";
import { Redirect, Link } from "react-router-dom";
import {
  Container,
  Row,
  Card,
  Alert,
  Form,
  Button,
  Spinner,
} from "react-bootstrap";

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Login.css";

class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contracts: {
        ipfsHashStorage: null,
      },
      userAccount: {
        isLoggedIn: false,
      },
      view: {
        loaded: false,
        data: {
          form: {
            validated: false,
            submitted: false,
            failed: false,
            input: {
              username: null,
              password: null,
            },
            errors: {
              username: null,
              password: null,
            },
            fieldEnumeration: {
              E_USERNAME_FIELD: 0,
              E_PASSWORD_FIELD: 1,
            },
          },
        },
      },
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.setField = this.setField.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkErrors = this.checkErrors.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.login = this.login.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.sleep = this.sleep.bind(this);
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

      this.setState({
        web3,
        accounts,
        contracts: {
          ipfsHashStorage,
        },
      });

      const isLoggedIn = await this.userIsLoggedIn();

      let { view } = this.state;
      view.loaded = true;

      this.setState({
        userAccount: {
          isLoggedIn,
        },
        view,
      });
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
      if (true === await this.userExists()) {
        return true;
      }
    }

    return false;
  }

  userHasAccount = async () => {
    try {
      const { contracts, accounts } = this.state;

      const response =
        await contracts.ipfsHashStorage.methods.accountHasIpfsHash(
          accounts[0]
        ).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  setField(_field, _value) {
    let { view } = this.state;

    if (view.data.form.fieldEnumeration.E_USERNAME_FIELD === _field) {
      view.data.form.input.username = _value;

      if (!!view.data.form.errors.username) {
        view.data.form.errors.username = null;
      }
    } else if (view.data.form.fieldEnumeration.E_PASSWORD_FIELD === _field) {
      view.data.form.input.password = _value;

      if (!!view.data.form.errors.password) {
        view.data.form.errors.password = null;
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
          await this.handleLogin();
        })();
      }
    }

    _event.preventDefault();
    _event.stopPropagation();
  }

  checkErrors() {
    let errors = {};

    const { username, password } = this.state.view.data.form.input;

    if (null === username) {
      errors.username = "Please fill out this field.";
    } else if (username.length > 30) {
      errors.username = "User Name Too Long.";
    }

    if (null === password) {
      errors.password = "Please fill out this field.";
    } else if ((password.length < 8) || (password.length > 30)) {
      errors.password = "Password Must Have Between 8-30 Characters."
    }

    return errors;
  }

  handleLogin = async () => {
    let { userAccount, view } = this.state;

    const response = await this.login();
    await this.sleep(2000);

    if (true === response) {
      view.data.form.submitted = true;
      userAccount.isLoggedIn = true;

      session.startSession();
    } else {
      view.data.form.validated = false;
      view.data.form.failed = true;
    }

    this.setState({ userAccount, view });
  }

  login = async () => {
    try {
      const { accounts, contracts } = this.state;
      const { username, password } = this.state.view.data.form.input;

      const ipfsHash =
        await contracts.ipfsHashStorage.methods.getAccountIpfsHash(
          accounts[0]
        ).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (
        (null !== decodedIpfsContent) &&
        (username === decodedIpfsContent.username) &&
        (password === decodedIpfsContent.password)
      ) {
        return true;
      }
    } catch (err) {
      console.error("Err @ login():", err.message);
    }

    return false;
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  render() {
    const { web3, accounts, contracts, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="Crowdsale" style={{ width: "100%", height: "70%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Login...
                  </Card.Title>

                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </>
              //else
              :
                //if
                ((null !== web3) && (null !== accounts) && (null !== contracts.ipfsHashStorage)) ?
                  //if
                  (false === userAccount.isLoggedIn) ?
                    <>
                      <Card.Title className="display-6 mb-5">
                        Login
                      </Card.Title>

                      {
                        //if
                        (true === view.data.form.failed) ?
                          <Card.Text className="lead mb-3" style={{ color: "red" }}>
                            Login Failed: Invalid Username OR Password!
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

                          <Form.Group controlId="formAccountUsername">
                            <Form.Label className="lead">Account User Name</Form.Label>

                            <Form.Control
                              required
                              type="text"
                              placeholder="Enter User Name"
                              onChange={
                                e => this.setField(
                                  view.data.form.fieldEnumeration.E_USERNAME_FIELD,
                                  e.target.value
                                )
                              }
                              isInvalid={ !!view.data.form.errors.username }
                            />

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.username }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          <Form.Group controlId="formAccountPassword">
                            <Form.Label className="lead">Account Password</Form.Label>

                            <Form.Control
                              required
                              type="password"
                              placeholder="Enter Password"
                              onChange={
                                e => this.setField(
                                  view.data.form.fieldEnumeration.E_PASSWORD_FIELD,
                                  e.target.value
                                )
                              }
                              isInvalid={ !!view.data.form.errors.password }
                            />

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.password }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          {
                            //if
                            (true === view.data.form.validated) ?
                              <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </Spinner>
                            //else
                            :
                              <Button variant="outline-secondary" type="submit" className="mt-3">
                                Login
                              </Button>
                            //endif
                          }
                        </Form>
                      </Row>

                      <Card.Text className="mt-3">
                        <a href="/register" className="text-muted" style={{ color: "black" }}>
                          Don't have an account?
                        </a>
                      </Card.Text>
                    </>
                  //else
                  : <Redirect to="/home" />
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

                      <Link to={{ pathname: `/login` }} className="btn btn-dark">
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

export default Login;
