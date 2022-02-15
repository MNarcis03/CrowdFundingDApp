import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { Alert, Container, Row, Card, Form, Button } from "react-bootstrap";

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Login.css";

const LOGIN_ERROR_ENUM = Object.freeze({
  "Unknown": -1,
  "Success": 0,
  "BlockchainError": 1,
  "UserDoesNotExistsError": 2,
  "Last": 3
});

// Feature: Account Recovery
class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contract: null,
      form: {},
      formErrors: {},
      loginError: null,
      redirect: false,
      session: session
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.setField = this.setField.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkFormErrors = this.checkFormErrors.bind(this);
    this.login = this.login.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.handleLoginError = this.handleLoginError.bind(this);
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = IpfsHashStorage.networks[networkId];
      const contract = new web3.eth.Contract(
        IpfsHashStorage.abi,
        deployedNetwork && deployedNetwork.address,
      );

      // Set web3, accounts, and contract to the state
      this.setState({
        web3: web3,
        accounts: accounts,
        contract: contract
      });

      if (true === await this.userIsLoggedIn()) {
        this.setState({ loggedIn: true });
      }
    } catch (error) {
      console.error(error);

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
    const { contract, accounts } = this.state;

    try {
      const response = await contract.methods.accountHasIpfsHash(accounts[0]).call();
      console.log("contract.methods.accountHasIpfsHash(): ", response);

      if (true === response) {
        return true;
      }
    } catch (error) {
      console.error("Err @ userExists(): ", error);
    }

    return false;
  }

  setField(field, value) {
    this.setState({ form: { ...this.state.form, [field] : value } });

    if (!!this.state.formErrors[field]) {
      this.setState({ formErrors: { ...this.state.formErrors, [field] : null } });
    }
  }

  checkFormErrors() {
    const formErrors = {};
    const { username, password } = this.state.form;

    if ((!username) || ("" === username)) {
      formErrors.username = "Please enter your username.";
    } else if (username.length > 30) {
      formErrors.username = "Username too long."
    }

    if ((!password) || ("" === password)) {
      formErrors.password = "Please enter your password";
    } else if ((password.length < 8) || (password.length > 30)) {
      formErrors.password = "Password must be between 8 and 30 characters."
    }

    return formErrors;
  }

  handleSubmit(event) {
    const formErrors = this.checkFormErrors();

    if (Object.keys(formErrors).length > 0) {
      this.setState({ formErrors: formErrors });
    } else {
      const form = event.currentTarget;

      if (true === form.checkValidity()) {
        (async () => {
          let loginError = LOGIN_ERROR_ENUM.UserDoesNotExistsError;

          if (true === await this.userExists()) {
            loginError = await this.login();

            if (LOGIN_ERROR_ENUM.Success === loginError) {
              const { session } = this.state;
              session.startSession();
            }
          }

          this.handleLoginError(loginError);
        })();
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  login = async () => {
    let loginError = LOGIN_ERROR_ENUM.UserDoesNotExistsError;

    const { contract, accounts } = this.state;
    const { username, password } = this.state.form;

    try {
      const ipfsHash = await contract.methods.getAccountIpfsHash(accounts[0]).call();
      console.log("contract.methods.getUserDataIpfsHash(): ", ipfsHash);

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if ((username === decodedIpfsContent.username) && (password === decodedIpfsContent.password)) {
        loginError = LOGIN_ERROR_ENUM.Success;
      }
    } catch (error) {
      console.error("Err @ login(): ", error);
      loginError = LOGIN_ERROR_ENUM.BlockchainError;
    }

    return loginError;
  }

  decodeIpfsContent = async (_ipfsContent) => {
    const decoder = new TextDecoder("utf-8");

    let decodedContent = "";

    for await (const chunk of _ipfsContent) {
      decodedContent += decoder.decode(chunk, { stream: true });
    }

    decodedContent += decoder.decode();

    return JSON.parse(decodedContent);
  }

  handleLoginError(_loginError) {
    if (LOGIN_ERROR_ENUM.Success === _loginError) {
      this.setState({
        loginError: null,
        loggedIn: true
      });
    } else if (LOGIN_ERROR_ENUM.BlockchainError === _loginError) {
      this.setState({
        loginError: "Oh snap! Error occurred on Blockchain... Please try again later!"
      });
    } else if (LOGIN_ERROR_ENUM.UserDoesNotExistsError === _loginError) {
      this.setState({
        loginError: "Username or password is incorrect... Please make sure both username and password are correct!"
      });
    }
  }

  render() {
    if (true === this.state.loggedIn) {
      return (
        <Redirect to="/"/>
      );
    }

    if (!this.state.web3 || !this.state.accounts || !this.state.contract) {
      return (
        <Container fluid="md" className="Login mt-5" style={{ height: "24rem" }}>
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

    return (
      <Container fluid="md" className="Login">
        <Row className="justify-content-md-center">
          <Card className="text-center" style={{ width: "64rem" }}>
            <Card.Body className="mt-3 mb-3">
              <Card.Title className="display-6">Welcome Back!</Card.Title>

              <Card.Text className="lead" style={{ color: "red" }}>
                { this.state.loginError }
              </Card.Text>

              <br />

              <Row className="justify-content-md-center">
                <Form style={{ width: "32rem" }}>
                  <Form.Group controlId="formBasicUsername">
                    <Form.Label className="lead">Username</Form.Label>

                    <Form.Control
                      required
                      type="text"
                      placeholder="Enter Username"
                      onChange={ e => this.setField("username", e.target.value) }
                      isInvalid={ !!this.state.formErrors.username }
                    />

                    <Form.Control.Feedback type="invalid">
                      { this.state.formErrors.username }
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="formBasicPassword">
                    <Form.Label className="lead">Password</Form.Label>

                    <Form.Control
                      required
                      type="password"
                      placeholder="Enter Password"
                      onChange={ e => this.setField("password", e.target.value) }
                      isInvalid={ !!this.state.formErrors.password }
                    />

                    <Form.Control.Feedback type="invalid">
                      { this.state.formErrors.password }
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="formBasicCheckbox">
                    <Form.Check type="checkbox" label="Remember me!" />
                  </Form.Group>

                  <Button variant="dark" type="submit" onClick={ this.handleSubmit }>
                    Login
                  </Button>
                </Form>
              </Row>

              <br />

              <Card.Text>
                <a href="/register" className="text-muted" style={{ color: "black" }}>Don't have an account?</a>
              </Card.Text>
            </Card.Body>
          </Card>
        </Row>
      </Container>
    );
  }
}

export default Login;
