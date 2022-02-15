import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import { Alert, Container, Row, Card, Form, Button, InputGroup, FormControl } from "react-bootstrap";

import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import CrowdFunding from "./../../contracts/CrowdFunding.json";

import "./StartProject.css";

const START_PROJECT_ERROR_ENUM = Object.freeze({
  "Unknown": -1,
  "Success": 0,
  "BlockchainError": 1,
  "ProjectNameAlreadyExists": 2,
  "Last": 3
});

class StartProject extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      crowdFunding: null,
      ipfsHashStorage: null,
      form: {
        projectName: "", 
        projectGoal: 1 
      },
      formErrors: {},
      validated: false,
      startProjectError: null,
      redirect: false,
      session: session,
      loggedIn: false
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.setField = this.setField.bind(this);
    this.changeProjectGoal = this.changeProjectGoal.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkFormErrors = this.checkFormErrors.bind(this);
    this.projectExists = this.projectExists.bind(this);
    this.startProject = this.startProject.bind(this);
    this.handleStartProjectError = this.handleStartProjectError.bind(this);
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts
      const accounts = await web3.eth.getAccounts();

      // Get the CrowdFunding contract instance
      let networkId = await web3.eth.net.getId();
      let deployedNetwork = CrowdFunding.networks[networkId];
      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        deployedNetwork && deployedNetwork.address,
      );

      // Get the IpfsHashStorage contract instance
      networkId = await web3.eth.net.getId();
      deployedNetwork = IpfsHashStorage.networks[networkId];
      const ipfsHashStorage = new web3.eth.Contract(
        IpfsHashStorage.abi,
        deployedNetwork && deployedNetwork.address,
      );

      // Set web3, accounts, and contract to the state
      this.setState({
        web3,
        accounts,
        crowdFunding,
        ipfsHashStorage
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
    const { ipfsHashStorage, accounts } = this.state;

    try {
      const response = await ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();
      console.log("ipfsHashStorage.methods.accountHasIpfsHash(): ", response);

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

    console.log("setField(): value: ", value);

    if (!!this.state.formErrors[field]) {
      this.setState({ formErrors: { ...this.state.formErrors, [field] : null } });
    }

    console.log("setField(): this.state.form.projectName: ", this.state.form.projectName);
  }

  changeProjectGoal(value) {
    const FIELD = "projectGoal";

    if (value > 1) {
      this.setState({ form: { ...this.state.form, [FIELD] : value } });
    } else {
      this.setState({ form: { ...this.state.form, [FIELD] : 1 } });
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
          let startProjectError = await this.startProject();

          this.handleStartProjectError(startProjectError);
        })();
      }
    }

    event.preventDefault();
    event.stopPropagation();
  }

  checkFormErrors() {
    const formErrors = {};
    const { projectName } = this.state.form;

    console.log("checkFormErrors(): this.state.form.projectName: ", projectName);

    if ((!projectName) || ("" === projectName)) {
      formErrors.projectName = "Please choose a name for your project.";
    } else if ((projectName < 8) || (projectName > 30)) {
      formErrors.projectName = "Project's name must be between 8 and 30 characters..";
    }

    return formErrors;
  }

  projectExists = async () => {
    const { crowdFunding } = this.state;
    const { projectName } = this.state.form;
    let startProjectError = START_PROJECT_ERROR_ENUM.Success;

    try {
      const response = await crowdFunding.methods.projectExists(projectName);

      if (true === response) {
        console.log("projectExists");
        startProjectError = START_PROJECT_ERROR_ENUM.ProjectNameAlreadyExists;
      }
    } catch (error) {
      console.error("Err @ projectExists(): ", error);
      startProjectError = START_PROJECT_ERROR_ENUM.BlockchainError;
    }

    return startProjectError;
  }

  startProject = async () => {
    const { crowdFunding, accounts } = this.state;
    const { projectName, projectGoal } = this.state.form;
    let startProjectError = START_PROJECT_ERROR_ENUM.Success;

    try {
      await crowdFunding.methods.create(projectName, projectGoal).send({ from: accounts[0] });
    } catch (error) {
      console.error("Err @ startProject(): ", error);
      startProjectError = START_PROJECT_ERROR_ENUM.BlockchainError;
    }

    return startProjectError;
  }

  handleStartProjectError(_startProjectError) {
    if (START_PROJECT_ERROR_ENUM.Success === _startProjectError) {
      this.setState({
        startProjectError: null,
        validated: true,
        redirect: true
      });
    } else if (START_PROJECT_ERROR_ENUM.BlockchainError === _startProjectError) {
      this.setState({
        startProjectError: "Oh snap! Error occurred on Blockchain... Please try again later!"
      });
    } else if (START_PROJECT_ERROR_ENUM.ProjectNameAlreadyExists === _startProjectError) {
      this.setState({
        startProjectError: "This project's name is already used... Please choose another!"
      });
    }
  }

  render() {
    if (true === this.state.redirect) {
      return <Redirect to="/" />
    }

    if (!this.state.web3 || !this.state.accounts) {
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

    console.log(this.state.loggedIn);
    if (true === this.state.loggedIn) {
      return (
        <Container fluid="md" className="StartProject">
          <Row className="justify-content-md-center">
            <Card className="text-center" style={{ width: "64rem" }}>
              <Card.Body className="mt-3 mb-3">
                <Card.Title className="display-6">Start Crowd Funding Project</Card.Title>

                <Card.Text className="lead">
                  In just few steps you can propose a crowd funding project to our community!
                </Card.Text>

                <Card.Text className="lead" style={{ color: "red" }}>
                  { this.state.startProjectError }
                </Card.Text>

                <br />

                <Row className="justify-content-md-center">
                  <Form validated={ this.state.validated } style={{ width: "32rem" }}>
                    <Form.Group controlId="formProjectName">
                      <Form.Label className="lead">Choose Project's Name</Form.Label>

                      <Form.Control
                        required
                        type="text"
                        placeholder="Enter Project's Name"
                        onChange={ e => this.setField("projectName", e.target.value) }
                        isInvalid={ !!this.state.formErrors.projectName }
                      />

                      <Form.Control.Feedback type="invalid">
                        { this.state.formErrors.projectName }
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group controlId="formProjectGoal">
                      <Form.Label className="lead">Choose Project's CFT Goal</Form.Label>

                      <InputGroup>
                        <FormControl
                          required
                          type="number"
                          value={ this.state.form.projectGoal }
                          min="1"
                          placeholder={ `Enter Project's CFT Goal` }
                          onChange={ e => this.changeProjectGoal(e.target.value) }
                        />
                      </InputGroup>
                    </Form.Group>

                    <Form.Group controlId="formProjectTermsConditions" className="mt-3">
                      <Form.Check
                        required
                        type="checkbox"
                        label="Agree to terms and conditions."
                        feedback="You must agree before submitting."
                      />
                    </Form.Group>

                    <Button variant="dark" type="submit" onClick={ this.handleSubmit }>
                      Create Project
                    </Button>
                  </Form>
                </Row>
              </Card.Body>
            </Card>
          </Row>
        </Container>
      );
    }

    return (
      <Container fluid="md" className="StartProject">
        <Row className="justify-content-md-center">
          <Card className="text-center" style={{ width: "80rem" }}>
            <Card.Body className="mt-3 mb-3">
              <Card.Title className="display-6">Start Crowd Funding Project</Card.Title>

              <Card.Text className="lead">
                In just few steps you can propose a crowd funding project to our community!
              </Card.Text>

              <Card.Text className="lead" style={{ color: "red" }}>
                { this.state.startProjectError }
              </Card.Text>

              <br />

              <Row className="justify-content-md-center">
                <Form validated={ this.state.validated } style={{ width: "32rem" }}>
                  <Form.Group controlId="formProjectName">
                    <Form.Label className="lead">Choose Project's Name</Form.Label>

                    <Form.Control
                      required
                      type="text"
                      placeholder="Enter Project's Name"
                      onChange={ e => this.setField("projectName", e.target.value) }
                      isInvalid={ !!this.state.formErrors.projectName }
                      disabled
                      readOnly
                    />

                    <Form.Control.Feedback type="invalid">
                      { this.state.formErrors.projectName }
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="formProjectGoal">
                    <Form.Label className="lead">Choose Project's CFT Goal</Form.Label>

                    <InputGroup>
                      <FormControl
                        required
                        type="number"
                        value={ this.state.form.projectGoal }
                        min="1"
                        placeholder={ `Enter Project's CFT Goal` }
                        onChange={ e => this.changeProjectGoal(e.target.value) }
                        disabled
                        readOnly
                      />
                    </InputGroup>
                  </Form.Group>

                  <Form.Group controlId="formProjectTermsConditions" className="mt-3">
                    <Form.Check
                      required
                      type="checkbox"
                      label="Agree to terms and conditions."
                      feedback="You must agree before submitting."
                      disabled
                    />
                  </Form.Group>

                  <Button variant="dark" type="submit" onClick={ this.handleSubmit } disabled>
                    Create Project
                  </Button>
                </Form>
              </Row>

              <Card.Text className="lead mt-3 mb-3">
                Only Crowd Funding DApp members are allowed to create projects.
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

export default StartProject;

