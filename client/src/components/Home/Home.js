import React, { Component } from "react";
import { Link } from "react-router-dom";
import {
  Container, Row, Col,
  Card,
  Alert,
  Button,
  Spinner
} from 'react-bootstrap/';

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import CrowdFunding from "./../../contracts/CrowdFunding.json";
import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";

import './Home.css';

class Home extends Component {
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
        symbol: null,
        decimals: 0,
        rate: 0,
        balance: 0,
        accountBalance: 0,
      },
      userAccount: {
        isLoggedIn: false,
        username: null,
      },
      view: {
        loaded: false,
        data: {
          projects: {
            fetched: null,
            generated: null,
            NUM_OF_PROJECTS: 3,
            totalFunding: 0,
          },
        },
      },
    };

    this.fetchProjects = this.fetchProjects.bind(this);
    this.generateProjectsView = this.generateProjectsView.bind(this);
    this.computeTotalFunding = this.computeTotalFunding.bind(this);
    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
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

      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        CrowdFunding.networks[networkId] &&
        CrowdFunding.networks[networkId].address,
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
        web3, accounts,
        contracts: {
          ipfsHashStorage, crowdFunding,
          crowdsale, token,
        },
        token: {
          symbol, decimals: 10 ** decimals, rate,
          balance, accountBalance,
        },
      });

      const isLoggedIn = await this.userIsLoggedIn();

      if (true === isLoggedIn) {
        const username = await this.getUsername(accounts[0]);

        this.setState({
          userAccount: {
            isLoggedIn, username,
          }
        });
      }

      let { view } = this.state;

      view.data.projects.fetched = await this.fetchProjects();
      this.setState({ view });

      view.data.projects.generated = this.generateProjectsView();

      view.data.projects.totalFunding = await this.computeTotalFunding();

      view.loaded = true;
      this.setState({ view });      
    } catch (err) {
      let view = this.state;

      view.loaded = true;
      this.setState({ view });

      console.error("Err @ ComponentDidMount():", err.message);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }
  }

  fetchProjects = async () => {
    let projects = [];

    try {
      const { crowdFunding } = this.state.contracts;

      let lastProjectId = await crowdFunding.methods.getLastProjectId().call();

      if (lastProjectId > 0) {
        const { view } = this.state;

        lastProjectId--;

        while (
          (projects.length < view.data.projects.NUM_OF_PROJECTS) &&
          (lastProjectId >= 0)
        ) {
          try {
            let project = {};

            project.id = lastProjectId;
            project.isApproved = await crowdFunding.methods.isApproved(lastProjectId).call();
            project.isOpen = await crowdFunding.methods.isOpen(lastProjectId).call();

            if ((true === project.isApproved) && (true === project.isOpen)) {
              project.name = await crowdFunding.methods.getName(lastProjectId).call();
              project.goal = await crowdFunding.methods.getGoal(lastProjectId).call();
              project.balance = await crowdFunding.methods.getBalance(lastProjectId).call();

              const ownerAddr = await crowdFunding.methods.getOwner(lastProjectId).call();
              project.owner = await this.getUsername(ownerAddr);

              project.ipfsHash = await crowdFunding.methods.getIpfsHash(lastProjectId).call();

              const ipfsContent = ipfs.cat(project.ipfsHash);
              const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

              if (decodedIpfsContent && decodedIpfsContent.category) {
                project.category = decodedIpfsContent.category;
              }

              if (decodedIpfsContent && decodedIpfsContent.imageUrl) {
                project.imageUrl = decodedIpfsContent.imageUrl;
              }

              projects.push(project);
            }
          } catch (err) {
            console.error("Err @ fetchProjects(): projectId =", lastProjectId, ":", err.message);
          }

          lastProjectId--;
        }
      }
    } catch (err) {
      console.error("Err @ fetchProjects():", err.message);
    }

    return projects;
  }

  generateProjectsView() {
    let projectsView = null;

    const { token } = this.state;
    const { projects } = this.state.view.data;

    if (projects.fetched && projects.fetched.length > 0) {
      let cards = [];

      for (let it = 0; it < projects.fetched.length; it++) {
        const card =
          <Col>
            <Card className="text-center justify-content-md-center" style={{ width: "22rem", height: "24rem" }}>
              <Card.Img
                variant="top"
                src={ projects.fetched[it].imageUrl }
                style={{ width: "100%", height: "50%" }}
              />
              <Card.Body>
                <Card.Title className="lead">
                  <b>{ projects.fetched[it].name }</b>
                </Card.Title>

                <Card.Text className="text-muted mb-1">
                  <i>Created by { projects.fetched[it].owner }</i>
                </Card.Text>

                <Card.Text className="lead mb-1">
                  { projects.fetched[it].category }
                </Card.Text>

                <Card.Text className="text-muted">
                  {
                    //if
                    (true === projects.fetched[it].isOpen) ?
                      <b>
                        {
                          Math.floor(
                            (projects.fetched[it].balance / token.decimals) * 100 /
                            (projects.fetched[it].goal / token.decimals))
                        }% Funded
                      </b>
                    //else
                    : <b>Funding Finished</b>
                    //endif
                  }
                </Card.Text>

                <Link to={{ pathname: `/viewProject/${ projects.fetched[it].id }` }} className="btn btn-secondary">
                  View More
                </Link>
              </Card.Body>
            </Card>
          </Col>
        ;

        cards.push(card);
      }

      if (cards.length > 0) {
        projectsView =
          <Row className="justify-content-md-center" style={{ "margin-left": "2%", width: "100%" }}>
            { cards }
          </Row>
        ;
      }
    }

    return projectsView;
  }

  computeTotalFunding = async () => {
    let totalFunding = 0;

    try {
      const { crowdFunding } = this.state.contracts;

      let lastProjectId = await crowdFunding.methods.getLastProjectId().call();

      if (lastProjectId > 0) {
        for (let it = 0; it < lastProjectId; it++) {
          try {
            const balance = await crowdFunding.methods.getBalance(it).call();
            totalFunding += parseInt(balance);
          } catch (err) {
            console.error("Err @ computeTotalFunding(): projectId =", it, ":", err.message);
          }
        }
      }
    } catch (err) {
      console.error("Err @ computeTotalFunding():", err.message);
    }

    return totalFunding;
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

      const response =
        await contracts.ipfsHashStorage.methods.accountHasIpfsHash(
          accounts[0]
        ).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.log("Err @ userExists():", err.message);
    }

    return false;
  }

  getUsername = async (_accountAddr) => {
    try {
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash =
        await ipfsHashStorage.methods.getAccountIpfsHash(
          _accountAddr
        ).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedContent = await this.decodeIpfsContent(ipfsContent);

      return decodedContent.username;
    } catch (err) {
      console.error("Err @ getUsername():", err.message);
    }

    return null;
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

  render() {
    const { web3, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="Home" style={{ width: "100%", height: "85%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Homepage...
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
                  (null !== contracts.ipfsHashStorage) && (null !== contracts.crowdFunding) &&
                  (null !== contracts.crowdsale) && (null !== contracts.token)
                ) ?
                  <>
                    <Card.Text className="lead">
                      <b>Crowd Funding Token ({ token.symbol })</b>
                    </Card.Text>

                    <Row className="justify-context-md-center">
                      <Col>
                        <Card.Text className="lead">
                          <i>1 { token.symbol } = { 1 / token.rate } Kilowei</i>
                        </Card.Text>
                      </Col>
                      <Col>
                        <Card.Text className="lead">
                          <i>
                            { view.data.projects.totalFunding / token.decimals } { token.symbol } Total Funding
                          </i>
                        </Card.Text>
                      </Col>
                      <Col>
                        <Card.Text className="lead">
                          <i>1 { token.balance / token.decimals } { token.symbol } Units Left For Sale</i>
                        </Card.Text>
                      </Col>
                    </Row>

                    <hr className="mb-3" />

                    <Card.Text className="lead mb-3">
                      <b>Latest Crowd Funding DApp's Projects</b>
                    </Card.Text>

                    <hr className="mb-5" />

                    {
                      //if
                      (
                        view.data.projects.fetched &&
                        view.data.projects.fetched.length > 0 && 
                        view.data.projects.generated
                      ) ?
                        view.data.projects.generated
                      //else
                      : <></>
                      //endif
                    }

                    <hr className="mt-5 mb-5" />

                    <Link
                      to={{ pathname: `/discoverProjects` }}
                      className="btn btn-outline-secondary fw-bold mb-5"
                      style={{ width: "100%" }}
                    >
                      SEE ALL PROJECTS
                    </Link>
                  </>
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

                      <Link to={{ pathname: `/home` }} className="btn btn-dark">
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

export default Home;
