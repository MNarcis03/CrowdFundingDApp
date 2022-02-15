import React, { Component } from "react";
import { Alert, Container, Row, Col, Pagination, PageItem, Card, Button } from "react-bootstrap";

import getWeb3 from "./../../utils/getWeb3";

import CrowdFunding from "./../../contracts/CrowdFunding.json";

import "./DiscoverProjects.css";

class DiscoverProjects extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      crowdFunding: null,
      lastProjectId: 0,
      projects: [],
      cards: [],
      activePage: 1,
      paginationItems: []
    };

    this.generatePaginationItems = this.generatePaginationItems.bind(this);
    this.handlePageClick = this.handlePageClick.bind(this);
    this.getProjects = this.getProjects.bind(this);
    this.generateCards = this.generateCards.bind(this);
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

      const lastProjectId = await crowdFunding.methods.getLastProjectId().call();

      // Set web3, accounts, and contract to the state
      this.setState({
        web3,
        accounts,
        crowdFunding,
        lastProjectId
      });

      this.generatePaginationItems();

      if (true === await this.getProjects(1)) {
        this.generateCards();
      }
    } catch (error) {
      console.error(error);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }
  }

  generatePaginationItems() {
    const { lastProjectId, activePage } = this.state;
    const PROJECTS_PER_PAGE = 3;
    let paginationItems = [];

    paginationItems.push(
      <Pagination.First />
    );

    paginationItems.push(
      <Pagination.Prev />
    );

    if (lastProjectId > 3) {
      let addOnePage = 0;

      if (0 != lastProjectId % PROJECTS_PER_PAGE) {
        addOnePage = 1;
      }

      for (let it = 1; it <= lastProjectId / PROJECTS_PER_PAGE + addOnePage; it++) {
        paginationItems.push(
          <Pagination.Item key={ it } active={ it === activePage } onClick={ () => this.handlePageClick(it) }>
            { it }
          </Pagination.Item>,
        );
      }
    } else {
      paginationItems.push(
        <Pagination.Item key={ 1 } active={ true } onClick={ () => this.handlePageClick(1) }>
          { 1 }
        </Pagination.Item>,
      );
    }

    paginationItems.push(
      <Pagination.Next />
    );

    paginationItems.push(
      <Pagination.Last />
    );

    this.setState({
      paginationItems
    });
  }

  handlePageClick(page) {
    const { activePage } = this.state;

    if (page !== activePage) {
      //do stuff
    }
  }

  getProjects = async (_forPage) => {
    const { lastProjectId, crowdFunding } = this.state;

    if (lastProjectId > 0) {
      const PROJECTS_PER_PAGE = 3;

      let firstProject =  PROJECTS_PER_PAGE * (_forPage - 1) + 1;
      let lastProject = PROJECTS_PER_PAGE * _forPage;

      if (lastProject > lastProjectId) {
        lastProject = lastProjectId;
      }

      let projects = [];

      for (let it = firstProject - 1; it < lastProject; it++) {
        let project = {};

        project.name = await crowdFunding.methods.getName(it).call();
        project.open = await crowdFunding.methods.isOpen(it).call();
        project.goal = await crowdFunding.methods.getGoal(it).call();
        project.balance = await crowdFunding.methods.getBalance(it).call();

        projects.push(project);
      }

      this.setState({projects});
    } else {
      return false;
    }

    return true;
  }

  generateCards() {
    const { projects } = this.state;

    if (projects.length > 0) {
      const PROJECTS_PER_PAGE = 3;

      let cards = [];

      for (let it = 0; it <= projects.length - 1; it++) {
        cards.push(
          <Col className="justify-content-md-center">
            <Card className="text-center" style={{ width: "24rem" }}>
              <Card.Body className="mt-1 mb-1">
                <Card.Title className="lead">
                  { projects[it].name }
                </Card.Title>

                <Card.Subtitle className="text-muted mt-1 mb-1">
                  { projects[it].name ? "Open" : "Closed"  }
                </Card.Subtitle>

                <Card.Text className="text-muted">
                  { projects[it].balance }/{ projects[it].goal } CFT Funded
                </Card.Text>

                <Button variant="outline-secondary" size="sm">
                  View More
                </Button>
              </Card.Body>
            </Card>
          </Col>
        );
      }

      this.setState({ cards });
    } else {
      return false;
    }

    return true;
  }

  render () {
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

    if (this.state.lastProjectId < 1) {
      return (
        <Container fluid="md auto" className="DiscoverProjects">
          <Row className="justify-content-md-center mb-3">
            <h1 className="text-center display-6">
              No Projects Available...
            </h1>
          </Row>
          <Row className="justify-content-md-center mb-3">
            <Button href="/startProject" variant="outline-dark" style={{ width: "24rem" }}>
              Publish 1st Crowd Funding Project!
            </Button>
          </Row>
        </Container>
      );
    }

    return (
      <Container fluid="md" className="DiscoverProjects">
        <Row className="justify-content-md-center">
          <Card border="light" className="text-center" style={{ width: "80rem" }}>
            <Card.Body className="mt-3 mb-3">
              <Card.Title className="display-6">Discover Crowd Funding Projects</Card.Title>

              <Row className="justify-content-md-center mt-5 mb-5">
                { this.state.cards }
              </Row>

              <Row>
                <Pagination size="sm" className="justify-content-md-center">
                  {/* { this.state.paginationItems } */}
                </Pagination>
              </Row>
            </Card.Body>
          </Card>
        </Row>
      </Container>
    );
  }
}

export default DiscoverProjects;

