import React, { Component } from "react";
import { Redirect, Link } from "react-router-dom";
import {
  Container,
  Row, Col,
  Alert,
  Card,
  Form,
  Button,
  Spinner
} from "react-bootstrap";

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Register.css";

class Register extends Component {
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
            failReason: null,
            input: {
              email: null,
              firstname: null,
              lastname: null,
              username: null,
              password: null,
              confirmPassword: null,
              state: null,
              city: null,
            },
            errors: {
              email: null,
              firstname: null,
              lastname: null,
              username: null,
              password: null,
              confirmPassword: null,
              state: null,
              city: null,
            },
            fieldEnumeration: {
              E_EMAIL_FIELD: 0,
              E_FIRSTNAME_FIELD: 1,
              E_LASTNAME_FIELD: 2,
              E_USERNAME_FIELD: 3,
              E_PASSWORD_FIELD: 4,
              E_CONFIRM_PASSWORD_FIELD: 5,
              E_STATE_FIELD: 6,
              E_CITY_FIELD: 7,
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
    this.handleRegister = this.handleRegister.bind(this);
    this.register = this.register.bind(this);
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

    if (view.data.form.fieldEnumeration.E_EMAIL_FIELD === _field) {
      view.data.form.input.email = _value;

      if ((undefined !== view.data.form.errors.email) &&(null !== view.data.form.errors.email)) {
        view.data.form.errors.email = null;
      }
    } else if (view.data.form.fieldEnumeration.E_FIRSTNAME_FIELD === _field) {
      view.data.form.input.firstname = _value;

      if ((undefined !== view.data.form.errors.firstname) && (null !== view.data.form.errors.firstname)) {
        view.data.form.errors.firstname = null;
      }
    } else if (view.data.form.fieldEnumeration.E_LASTNAME_FIELD === _field) {
      view.data.form.input.lastname = _value;

      if ((undefined !== view.data.form.errors.lastname) && (null !== view.data.form.errors.lastname)) {
        view.data.form.errors.lastname = null;
      }
    } else if (view.data.form.fieldEnumeration.E_USERNAME_FIELD === _field) {
      view.data.form.input.username = _value;

      if ((undefined !== view.data.form.errors.username) && (null !== view.data.form.errors.username)) {
        view.data.form.errors.username = null;
      }
    } else if (view.data.form.fieldEnumeration.E_PASSWORD_FIELD === _field) {
      view.data.form.input.password = _value;

      if ((undefined !== view.data.form.errors.password) && (null !== view.data.form.errors.password)) {
        view.data.form.errors.password = null;
      }
    } else if (view.data.form.fieldEnumeration.E_CONFIRM_PASSWORD_FIELD === _field) {
      view.data.form.input.confirmPassword = _value;

      if ((undefined !== view.data.form.errors.confirmPassword) && (null !== view.data.form.errors.confirmPassword)) {
        view.data.form.errors.confirmPassword = null;
      }
    } else if (view.data.form.fieldEnumeration.E_STATE_FIELD === _field) {
      view.data.form.input.state = _value;

      if ((undefined !== view.data.form.errors.state) && (null !== view.data.form.errors.state)) {
        view.data.form.errors.state = null;
      }
    } else if (view.data.form.fieldEnumeration.E_CITY_FIELD  === _field) {
      view.data.form.input.city = _value;

      if ((undefined !== view.data.form.errors.city) && (null !== view.data.form.errors.city)) {
        view.data.form.errors.city = null;
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
          await this.handleRegister();
        })();
      }  
    }

    _event.preventDefault();
    _event.stopPropagation();
  }

  checkErrors() {
    const errors = {};

    const {
      email, firstname, lastname, username, password, confirmPassword, state, city
    } = this.state.view.data.form.input;

    if (null === email) {
      errors.email = "Please fill out this field.";
    } else if (email.length > 30) {
      errors.email = "E-Mail Address Too Long.";
    }

    if (null === firstname) {
      errors.firstname = "Please fill out this field.";
    } else if (firstname.length > 30) {
      errors.firstname = "First Name Too Long.";
    }

    if (null === lastname) {
      errors.lastname = "Please fill out this field.";
    } else if (lastname.length > 30) {
      errors.lastname = "Last Name Too Long.";
    }

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

    if (null === confirmPassword) {
      errors.confirmPassword = "Please fill out this field."
    } else if ((password) && (password !== confirmPassword)) {
      errors.confirmPassword = "Passwords Do NOT Match!";
    }

    if (null === state) {
      errors.state = "Please fill out this field.";
    } else if (state.length > 30) {
      errors.state = "State Too Long.";
    }

    if (null === city) {
      errors.city = "Please fill out this field.";
    } else if (city.length > 30) {
      errors.city = "City Too Long.";
    }

    return errors;
  }

  handleRegister = async () => {
    let { view } = this.state;

    let response = await this.userHasAccount();

    if (true === response) {
      view.data.form.validated = false;
      view.data.form.failed = true;
      view.data.form.failReason = "Wallet Account Address Already Registered To CrowdFundingDApp!";
    } else {
      response = await this.register();
      await this.sleep(2000);

      if (true === response) {
        view.data.form.submitted = true;
      } else {
        view.data.form.validated = false;
        view.data.form.failed = true;
        view.data.form.failReason = "Blockchain/IPFS Error!";
      }
    }

    this.setState({ view });
  }

  register = async () => {
    try {
      const { contracts, accounts } = this.state;
      const {
        email, firstname, lastname, username, password, state, city
      } = this.state.view.data.form.input;

      let account = {
        email, firstname, lastname, username, password, state, city
      };
      console.log("Account:", account);

      const buffer = [Buffer.from(JSON.stringify(account))];
      console.log("Buffer:", buffer);

      const ipfsHash = await ipfs.add(buffer);
      console.log("ipfsHash:", ipfsHash.cid.toString());

      await contracts.ipfsHashStorage.methods.setAccountIpfsHash(
        ipfsHash.cid.toString()
      ).send({ from: accounts[0] });
      console.log("contract.methods.setAccountIpfsHash(): Success");
    } catch (err) {
      console.error("Err @ register():", err.message);
      return false;
    }

    return true;
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
                    Loading Register...
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
                    //if
                    (false === this.state.view.data.form.submitted) ?
                      <>
                        <Card.Title className="display-6 mb-5">
                          Create Account
                        </Card.Title>

                        {
                          //if
                          (true === view.data.form.failed) ?
                            <Card.Text className="lead mb-3" style={{ color: "red" }}>
                              Account Creation Failed: { view.data.form.failReason }
                            </Card.Text>
                          //else
                          : <></>
                          //endif
                        }

                        <Row className="justify-content-md-center">
                          <Form
                            validated={ view.data.form.validated }
                            onSubmit={ this.handleSubmit }
                            style={{ width: "80%" }}
                          >
                            <Row>
                              <Form.Group as={ Col } controlId="formAccountAddress">
                                <Form.Label className="lead">Account Address</Form.Label>

                                <Form.Control
                                  type="text"
                                  placeholder={ `${ accounts[0] }` }
                                  aria-label="Disabled Account Address"
                                  readOnly
                                />
                              </Form.Group>

                              <Form.Group as={ Col } controlId="formEmailAddress">
                                <Form.Label className="lead">E-Mail Address</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Enter E-Mail Address"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_EMAIL_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.email }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.email }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>
                            </Row>
                            
                            <Row>
                              <Form.Group as={ Col } controlId="formFirstname">
                                <Form.Label className="lead">First Name</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Enter First Name"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_FIRSTNAME_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.firstname }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.firstname }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>

                              <Form.Group as={ Col } controlId="formLastname">
                                <Form.Label className="lead">Last Name</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Enter Last Name"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_LASTNAME_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.lastname }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.lastname }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>

                              <Form.Group as={ Col } controlId="formUsername">
                                <Form.Label className="lead">User Name</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Create User Name"
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
                            </Row>

                            <Row>
                              <Form.Group as={ Col } controlId="formPassword">
                                <Form.Label className="lead">Password</Form.Label>

                                <Form.Control
                                  required
                                  type="password"
                                  placeholder="Create Password"
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

                              <Form.Group as={ Col } controlId="formConfirmPassword">
                                <Form.Label className="lead">Confirm Password</Form.Label>

                                <Form.Control
                                  required
                                  type="password"
                                  placeholder="Confirm Password"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_CONFIRM_PASSWORD_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.confirmPassword }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.confirmPassword }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>
                            </Row>

                            <Row>
                              <Form.Group as={ Col } controlId="formState">
                                <Form.Label className="lead">State</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Enter State"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_STATE_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.state }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.state }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>

                              <Form.Group as={ Col } controlId="formCity">
                                <Form.Label className="lead">City</Form.Label>

                                <Form.Control
                                  required
                                  type="text"
                                  placeholder="Enter City"
                                  onChange={
                                    e => this.setField(
                                      view.data.form.fieldEnumeration.E_CITY_FIELD,
                                      e.target.value
                                    )
                                  }
                                  isInvalid={ !!view.data.form.errors.city }
                                />

                                {
                                  //if
                                  (false === view.data.form.validated) ?
                                    <Form.Control.Feedback type="invalid">
                                      { view.data.form.errors.city }
                                    </Form.Control.Feedback>
                                  //else
                                  : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                  //endif
                                }
                              </Form.Group>
                            </Row>

                            {
                              //if
                              (true === view.data.form.validated) ?
                                <Spinner animation="border" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </Spinner>
                              //else
                              :
                                <Button variant="outline-secondary" type="submit" className="mt-3">
                                  Create Account
                                </Button>
                              //endif
                            }
                            
                          </Form>                              
                        </Row>

                        <Card.Text className="mt-3">
                          <a href="/login" className="text-muted" style={{ color: "black" }}>
                            Already have an account?
                          </a>
                        </Card.Text>
                      </>
                    //else
                    : <Redirect to="/login" />
                    //endif
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

                      <Link to={{ pathname: `/register` }} className="btn btn-dark">
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

export default Register;
