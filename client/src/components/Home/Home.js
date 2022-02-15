import React, { Component } from "react";
import { Container, Row, Button } from 'react-bootstrap/';

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import './Home.css';

class Home extends Component {
  constructor(props) {
    super(props);

    this.state = {
      username: null,
      web3: null,
      accounts: null,
      contract: null,
      session: session,
      loggedIn: false
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
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
        if (true === await this.getUsername()) {
          this.setState({ loggedIn: true });
        }
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
      console.log("Err @ userExists(): ", error);
    }

    return false;
  }

  getUsername = async () => {
    const { contract, accounts } = this.state;

    try {
      const ipfsHash = await contract.methods.getAccountIpfsHash(accounts[0]).call();
      console.log("contract.methods.getAccountIpfsHash(): ", ipfsHash);

      const ipfsContent = ipfs.cat(ipfsHash);
      console.log("ipfs.cat() Content Decoded: ", ipfsContent);

      const decodedContent = await this.decodeIpfsContent(ipfsContent);
      console.log("Home: getUsername(): ", decodedContent.username)
      this.setState({ username: decodedContent.username });
    } catch (error) {
      console.error("Err @ getUsername(): ", error);
      return false;
    }

    return true;
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

  render() {
    if (true === this.state.loggedIn) {
      return (
        <Container fluid="md auto" className="Home">
          <Row className="justify-content-md-center">
            <h1 className="text-center display-6">
              Welcome back to Crowd Funding DApp, { this.state.username }!
            </h1>
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
        <Row className="justify-content-md-center mb-3">
          <Button href="/login" variant="outline-secondary" style={{ width: "32rem" }}>
            I'm Already Part Of The Crowd Funding Community
          </Button>
        </Row>
      </Container>
    );
  }
}

export default Home;
