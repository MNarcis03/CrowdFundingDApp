import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { Alert, Container, Row, Card, Form, Button } from "react-bootstrap";

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Register.css";

const REGISTER_ERROR_ENUM = Object.freeze({
  "Unknown": -1,
  "Success": 0,
  "BlockchainError": 1,
  "UsernameAlreadyExists": 2,
  "AccountAlreadyRegistered": 3,
  "Last": 4
});

// Feature: Check if username already exists
class Register extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contract: null,
      form: {},
      formErrors: {},
      validated: false,
      registerError: null,
      redirect: false,
      loggedIn: false,
      session: session
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.setField = this.setField.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkFormErrors = this.checkFormErrors.bind(this);
    this.register = this.register.bind(this);
    this.endSessionIfNeeded = this.endSessionIfNeeded.bind(this);
    this.handleRegisterError = this.handleRegisterError.bind(this);
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

  handleSubmit(event) {
    const formErrors = this.checkFormErrors();

    if (Object.keys(formErrors).length > 0) {
      this.setState({ formErrors: formErrors });
    } else {
      const form = event.currentTarget;

      if (true === form.checkValidity()) {
        (async () => {
          let registerError = REGISTER_ERROR_ENUM.AccountAlreadyRegistered;

          if (false === await this.userExists()) {
            registerError = await this.register();

            if (REGISTER_ERROR_ENUM.Success === registerError) {
              this.endSessionIfNeeded();
            }
          }

          this.handleRegisterError(registerError);
        })();
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  checkFormErrors() {
    const formErrors = {};
    const { username, password, confirmPassword } = this.state.form;

    if ((!username) || ("" === username)) {
      formErrors.username = "Please choose a username.";
    } else if (username.length > 30) {
      formErrors.username = "Username too long.";
    }

    if ((!password) || ("" === password)) {
      formErrors.password = "Please choose a password.";
    } else if ((password.length < 8) || (password.length > 30)) {
      formErrors.password = "Password must be between 8 and 30 characters."
    }

    if ((!confirmPassword) || ("" === confirmPassword)) {
      formErrors.confirmPassword = "Please confirm the password."
    } else if ((password) && (password !== confirmPassword)) {
      formErrors.confirmPassword = "Passwords doesn't match.";
    }

    return formErrors;
  }

  register = async () => {
    let registerError = REGISTER_ERROR_ENUM.Success;

    const { contract, accounts } = this.state;
    const { username, password } = this.state.form;

    var userData = {
      username: username,
      password: password
    };

    try {
      const buffer = [Buffer.from(JSON.stringify(userData))];
      console.log("Buffer: ", buffer);

      const result = await ipfs.add(buffer);
      const ipfsHash = result.cid;
      console.log("ipfsHash: ", ipfsHash.toString());

      await contract.methods.setAccountIpfsHash(ipfsHash.toString()).send({ from: accounts[0] });
      console.log("contract.methods.setAccountIpfsHash(): Success");
    } catch (error) {
      console.error("Err @ register(): ", error);
      registerError = REGISTER_ERROR_ENUM.BlockchainError;
    }

    return registerError;
  }

  endSessionIfNeeded() {
    const { session } = this.state;

    if (false === session.sessionExpired()) {
      session.endSession();
    }
  }

  handleRegisterError(_registerError) {
    if (REGISTER_ERROR_ENUM.Success === _registerError) {
      this.setState({
        registerError: null,
        validated: true,
        redirect: true
      });
    } else if (REGISTER_ERROR_ENUM.BlockchainError === _registerError) {
      this.setState({
        registerError: "Oh snap! Error occurred on Blockchain... Please try again later!"
      });
    } else if (REGISTER_ERROR_ENUM.UsernameAlreadyExists === _registerError) {
      this.setState({
        registerError: "This username is already taken... Please choose another!"
      });
    } else if (REGISTER_ERROR_ENUM.AccountAlreadyRegistered === _registerError) {
      this.setState({
        registerError: "This wallet account is already registered to website... Please switch to login!"
      });
    }
  }

  render() {
    if (true === this.state.loggedIn) {
      return <Redirect to="/" />
    }

    if (true === this.state.redirect) {
      return <Redirect to="/login" />
    }

    if (!this.state.web3 || !this.state.accounts || !this.state.contract) {
      return (
        <Container fluid="md" className="Register mt-5" style={{ height: "24rem" }}>
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
      <Container fluid="md auto" className="Register">
        <Row className="justify-content-md-center">
          <Card className="text-center" style={{ width: "64rem" }}>
            <Card.Body className="mt-3 mb-3">
              <Card.Title className="display-6">Create Account</Card.Title>

              <Card.Text className="lead" style={{ color: "red" }}>
                { this.state.registerError }
              </Card.Text>

              <br />

              <Row className="justify-content-md-center">
                <Form validated={ this.state.validated } style={{ width: "32rem" }}>
                  <Form.Group controlId="formBasicUsername">
                    <Form.Label className="lead">Create Username</Form.Label>

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
                    <Form.Label className="lead">Create Password</Form.Label>

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

                  <Form.Group controlId="formBasicConfirmPassword">
                    <Form.Label className="lead">Confirm Password</Form.Label>

                    <Form.Control
                      required
                      type="password"
                      placeholder="Enter Password Again"
                      onChange={ e => this.setField("confirmPassword", e.target.value) }
                      isInvalid={ !!this.state.formErrors.confirmPassword }
                    />

                    <Form.Control.Feedback type="invalid">
                      { this.state.formErrors.confirmPassword }
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="formBasicCheckbox">
                    <Form.Check
                      required
                      type="checkbox"
                      label="Agree to terms and conditions."
                      feedback="You must agree before submitting."
                    />
                  </Form.Group>

                  <Button variant="dark" type="submit" onClick={ this.handleSubmit }>
                    Register
                  </Button>
                </Form>
              </Row>

              <br />

              <Card.Text>
                <a href="login" className="text-muted" style={{ color: "black" }}>Already have an account?</a>
              </Card.Text>
            </Card.Body>
          </Card>
        </Row>
      </Container>
    );
  }
}

export default Register;
