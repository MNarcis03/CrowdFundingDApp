import React, { Component } from "react";
import { Navbar, Nav, Container } from "react-bootstrap/";

import getWeb3 from "./../../utils/getWeb3";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";

import "./Header.css";

class Header extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contract: null,
      session: session,
      loggedIn: false
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
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
      console.log("accountHasIpfsHash(): ", response);

      if (true === response) {
        return true;
      }
    } catch (error) {
      console.log("Err @ userExists(): ", error);
    }

    return false;
  }

  render() {
    if (true === this.state.loggedIn) {
      return (
        <Container fluid="md auto" className="mb-3">
          <Navbar bg="transparent" variant="light" expand="lg">
            <Navbar.Brand href="home">Crowd Funding DApp</Navbar.Brand>

            <Navbar.Toggle aria-controls="responsive-navbar-nav" />

            <Navbar.Collapse id="responsive-navbar-nav">
              <Nav className="mr-auto">
                <Nav.Link href="startProject">Start Project</Nav.Link>
                <Nav.Link href="discoverProjects">Discover Projects</Nav.Link>
                <Nav.Link href="crowdsale">Buy CFT</Nav.Link>
              </Nav>

              <Nav>
                <Nav.Link href="home">My Account</Nav.Link>
                <Nav.Link href="logout">Logout</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Navbar>

          <hr className="mt-3" />
        </Container>
      );
    }

    return (
      <Container fluid="md auto" className="mb-3">
        <Navbar bg="transparent" variant="light" expand="lg">
          <Navbar.Brand href="home">Crowd Funding DApp</Navbar.Brand>

          <Navbar.Toggle aria-controls="responsive-navbar-nav" />

          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="mr-auto">
              <Nav.Link href="startProject">Start Project</Nav.Link>
              <Nav.Link href="discoverProjects">Discover Projects</Nav.Link>
              <Nav.Link href="crowdsale">Buy CFT</Nav.Link>
            </Nav>

            <Nav>
              <Nav.Link href="login">Login</Nav.Link>
              <Nav.Link href="register">Register</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <hr className="mt-3" />
      </Container>
    );
  }
}

export default Header;
