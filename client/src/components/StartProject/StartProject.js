import React, { Component } from "react";
import { Redirect, Link } from "react-router-dom";
import {
  Container, Row,
  Alert,
  Card,
  Form, FormControl,
  InputGroup,
  Button,
  Spinner
} from "react-bootstrap";

import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import CrowdFunding from "./../../contracts/CrowdFunding.json";
import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";

import "./StartProject.css";

class StartProject extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contracts: {
        ipfsHashStorage: null,
        crowdFunding: null,
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
      },
      view: {
        loaded: false,
        data: {
          form: {
            validated: false,
            submitted: false,
            failed: false,
            input: {
              title: "",
              category: "None",
              goal: 0,
              description: "",
            },
            errors: {
              title: null,
              category: null,
              goal: null,
              description: null,
            },
            fieldEnumeration: {
              TITLE: 0,
              CATEGORY: 1,
              GOAL: 2,
              DESCRIPTION: 3,
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
    this.startProject = this.startProject.bind(this);
    this.sleep = this.sleep.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();

      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        CrowdFunding.networks[networkId] && CrowdFunding.networks[networkId].address,
      );

      const ipfsHashStorage = new web3.eth.Contract(
        IpfsHashStorage.abi,
        IpfsHashStorage.networks[networkId] && IpfsHashStorage.networks[networkId].address,
      );

      const crowdsale = new web3.eth.Contract(
        TokenCrowdsale.abi,
        TokenCrowdsale.networks[networkId] && TokenCrowdsale.networks[networkId].address,
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
        accounts,
        contracts: {
          crowdFunding, ipfsHashStorage,
          crowdsale, token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          accountBalance,
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
      if (true === await this.userHasAccount()) {
        return true;
      }
    }

    return false;
  }

  userHasAccount = async () => {
    try {
      const { contracts, accounts } = this.state;

      const response = await contracts.ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  setField(field, value) {
    const { view } = this.state;

    if (view.data.form.fieldEnumeration.TITLE === field) {
      view.data.form.input.title = value;

      if (!!view.data.form.errors.title) {
        view.data.form.errors.title = null;
      }
    } else if (view.data.form.fieldEnumeration.CATEGORY === field) {
        view.data.form.input.category = value;

        if (!!view.data.form.errors.category) {
          view.data.form.errors.category = null;
        }
    } else if (view.data.form.fieldEnumeration.GOAL === field) {
      if (value > 0) {
        view.data.form.input.goal = value;
      } else {
        view.data.form.input.goal = 0;
      }

      if (!!view.data.form.errors.goal) {
        view.data.form.errors.goal = null;
      }  
    } else if (view.data.form.fieldEnumeration.DESCRIPTION === field) {
      view.data.form.input.description = value;

      if (!!view.data.form.errors.description) {
        view.data.form.errors.description = null;
      }
    }
 
    this.setState({ view });
  }

  handleSubmit(event) {
    const form = event.currentTarget;

    if (true === form.checkValidity()) {
      let { view } = this.state;

      const errors = this.checkErrors();

      view.data.form.errors = errors;
      this.setState({ view });

      if (Object.keys(errors).length < 1) {
        view.data.form.validated = true;
        this.setState({ view });

        (async () => {
          await this.handleStartProject();
        })();
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  checkErrors() {
    let errors  = {};

    const { title, category, goal, description } = this.state.view.data.form.input;

    if ((!title) || ("" === title)) {
      errors.title = "Please choose a title for your project.";
    } else if ((title < 8) || (title > 30)) {
      errors.title = "Project's title must have between 8 and 30 characters.";
    }

    if ("None" === category) {
      errors.category = "Please choose a category for your project.";
    }

    if (0 === goal) {
      errors.goal = "Please choose a goal for your project.";
    }

    if ((!description) || ("" === description)) {
      errors.description = "Please write a description for your project.";
    } else if ((title < 10) || (title > 30)) {
      errors.description = "Project's description must have between 100 and 300 characters.";
    }

    return errors;
  }

  handleStartProject = async () => {
    let { view } = this.state;

    const response = await this.startProject();
    await this.sleep(2000);

    if (true === response) {
      view.data.form.submitted = true;
    } else {
      view.data.form.validated = false;
      view.data.form.failed = true;
    }

    this.setState({ view });
  }

  startProject = async () => {
    try {
      const { contracts, accounts, token } = this.state;
      const { input } = this.state.view.data.form;

      await contracts.crowdFunding.methods.create(
        input.title,
        input.goal * token.decimals
      ).send({ from: accounts[0] });
    } catch (err) {
      console.error("Err @ startProject():", err.message);
      return false;
    }

    return true;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  render() {
    const { web3, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="StartProject" style={{ width: "100%", height: "80%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Raise Funding Form...
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
                  (true === userAccount.isLoggedIn) ?
                    //if
                    (false === view.data.form.submitted) ?
                    <>
                      <Card.Title className="display-6 mb-3">
                        Raise Funding
                      </Card.Title>

                      <Card.Text className="text-muted mb-3">
                        Complete the following formular to be able to propose your crowd funding project into our platform.
                      </Card.Text>

                      {
                        //if
                        (true === view.data.form.failed) ?
                          <Card.Text className="lead mb-3" style={{ color: "red" }}>
                            Request failed due to blockchain error! Please retry later...
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
                          <Form.Group controlId="formProjectTitle">
                            <Form.Label className="lead">Title</Form.Label>

                            <Form.Control
                              required
                              type="text"
                              placeholder="Project Title"
                              onChange={
                                e => this.setField(
                                  view.data.form.fieldEnumeration.TITLE,
                                  e.target.value
                                )
                              }
                              isInvalid={ !!view.data.form.errors.title }
                            />

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.title }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          <Form.Group controlId="formProjectCategory">
                            <Form.Label className="lead">Category</Form.Label>

                            <Form.Control
                              required
                              as="select"
                              onChange={
                                e => this.setField(
                                  view.data.form.fieldEnumeration.CATEGORY,
                                  e.target.value
                                )
                              }
                              isInvalid={ !!view.data.form.errors.category }
                            >
                              <option value="None">Project Category</option>
                              <option value="Crypto">Crypto</option>
                              <option value="Gaming">Gaming</option>
                              <option value="Green Future">Green Future</option>
                              <option value="Science">Science</option>
                            </Form.Control>

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.category }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          <Form.Group controlId="formProjectGoal">
                            <Form.Label className="lead">{ token.symbol } Goal</Form.Label>

                            <InputGroup>
                              <FormControl
                                required
                                type="number"
                                placeholder={ `Project ${ token.symbol } Goal` }
                                onChange={
                                  e => this.setField(
                                    view.data.form.fieldEnumeration.GOAL,
                                    e.target.value
                                  )
                                }
                                isInvalid={ !!view.data.form.errors.goal }
                                value={ view.data.form.input.goal }
                                min="0"
                              />

                              <InputGroup.Text>{ token.symbol }</InputGroup.Text>
                            </InputGroup>

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.goal }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          <Form.Group controlId="formProjectDescription">
                            <Form.Label className="lead">Campaign Description</Form.Label>

                            <Form.Control
                              required
                              as="textarea"
                              placeholder="Project Campaign Description..."
                              onChange={
                                e => this.setField(
                                  view.data.form.fieldEnumeration.DESCRIPTION,
                                  e.target.value
                                )
                              }
                              isInvalid={ !!view.data.form.errors.description }
                            />

                            {
                              //if
                              (false === view.data.form.validated) ?
                                <Form.Control.Feedback type="invalid">
                                  { view.data.form.errors.description }
                                </Form.Control.Feedback>
                              //else
                              : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                              //endif
                            }
                          </Form.Group>

                          {
                            //if
                            (true === view.data.form.validated) ?
                              <Spinner animation="border" role="status" className="mt-3">
                                <span className="visually-hidden">Loading...</span>
                              </Spinner>
                            //else
                            :
                              <Button variant="dark" type="submit" className="mt-3">
                                Propose Project
                              </Button>
                            //endif
                          }
                        </Form>
                      </Row>
                    </>
                    //else
                    :
                      <Row className="justify-content-md-center mt-5">
                        <Alert variant="light" style={{ width: "50%" }}>
                          <Alert.Heading className="mb-3">Project Succcesfully Proposed!</Alert.Heading>

                          <p className="lead">Waiting for approval...</p>

                          <hr />

                          <p className="mb-3">
                            You can check the status of the project <a href="/myAccount" style={{ color: "black" }}>here</a>.
                          </p>

                          <Link to={{ pathname: `/home/` }} className="btn btn-dark">
                            Return To Homepage
                          </Link>
                        </Alert>
                      </Row>
                    //endif
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

export default StartProject;

