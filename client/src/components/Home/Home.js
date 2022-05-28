import React, { Component } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Row,
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
      },
      userAccount: {
        isLoggedIn: false,
        username: null,
      },
      view: {
        loaded: false,
      },
    };

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

      this.setState({
        web3, accounts,
        contracts: {
          ipfsHashStorage,
        },
      });

      const isLoggedIn = await this.userIsLoggedIn();

      if (true === isLoggedIn) {
        const username = await this.getUsername();

        this.setState({
          userAccount: {
            isLoggedIn, username,
          }
        });
      }
    } catch (err) {
      console.error("Err @ ComponentDidMount():", err.message);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }

    let view = this.state;
    view.loaded = true;
    this.setState({ view });
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

  getUsername = async () => {
    try {
      const { contracts, accounts } = this.state;

      const ipfsHash =
        await contracts.ipfsHashStorage.methods.getAccountIpfsHash(
          accounts[0]
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
                    Loading Homepage...
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
                  (true === userAccount.isLoggedIn) ?
                    <>
                      <Card.Title className="display-6">
                        Welcome Back, { userAccount.username }!
                      </Card.Title>
                    </>
                  //else
                  :
                    <>
                      <Card.Title className="display-6">
                        Welcome To Crowd Funding DApp!
                      </Card.Title>
                    </>
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

    if (true === this.state.loggedIn) {
      return (
        <Container fluid="md auto" className="Home">
          <Row className="justify-content-md-center mb-3">
            <h1 className="text-center display-6">
              Welcome back to Crowd Funding DApp, { this.state.username }!
            </h1>
          </Row>
          <Row className="justify-content-md-center mb-3">
            <Button href="/startProject" variant="outline-secondary" style={{ width: "32rem" }}>
              Propose A Project To The Crowd Funding Community
            </Button>
          </Row>
          <Row className="justify-content-md-center mb-3">
            <Button href="/discoverProjects" variant="outline-dark" style={{ width: "32rem" }}>
              Check The Latest Crowd Funding Projects
            </Button>
          </Row>
          <Row className="justify-content-md-center">
            <Button href="/crowdsale" variant="outline-secondary" style={{ width: "32rem" }}>
              Join The Crowd Funding Token Crowdsale
            </Button>
          </Row>
        </Container>
      );
    }

    return (
      <Container fluid="md auto" className="Home">
        <Row className="justify-content-md-center mb-3">
          <h1 className="text-center display-6">Welcome to Crowd Funding DApp!</h1>
        </Row>
        <Row className="justify-content-md-center mb-3">
          <Button href="/register" variant="outline-dark" style={{ width: "32rem" }}>
            Join The Dark Side
          </Button>
        </Row>
        <Row className="justify-content-md-center">
          <Button href="/login" variant="outline-secondary" style={{ width: "32rem" }}>
            I'm Already Part Of The Crowd Funding Community
          </Button>
        </Row>
      </Container>
    );
  }
}

export default Home;
