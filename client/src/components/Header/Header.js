import React, { Component } from "react";
import {
  Container,
  Navbar, Nav, NavDropdown
} from "react-bootstrap/";

import getWeb3 from "./../../utils/getWeb3";
import ipfs from "../../utils/ipfs";
import session from "./../../utils/session";

import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import TokenCrowdsale from "../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "../../contracts/CrowdFundingToken.json";

import "./Header.css";

class Header extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contracts: {
        ipfsHashStorage: null,
        token: null,
        crowdsale: null,
      },
      token: {
        symbol: "",
        decimals: 0,
        accountBalance: 0,
      },
      userAccount: {
        isLoggedIn: false,
        isAdmin: false,
        username: "",
      },
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.userIsAdmin = this.userIsAdmin.bind(this);
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

      const crowdsale = new web3.eth.Contract(
        TokenCrowdsale.abi,
        TokenCrowdsale.networks[networkId] &&
        TokenCrowdsale.networks[networkId].address,
      );

      const crowdsaleToken = await crowdsale.methods.token().call();

      const token = new web3.eth.Contract(
        CrowdFundingToken.abi, crowdsaleToken
      );

      const symbol = await token.methods.symbol().call();
      const decimals = await token.methods.decimals().call();
      const accountBalance = await token.methods.balanceOf(accounts[0]).call();

      this.setState({
        web3, accounts,
        contracts: {
          ipfsHashStorage,
          crowdsale, token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          accountBalance,
        },
      });

      if (true === await this.userIsLoggedIn()) {
        const username = await this.getUsername(accounts[0]);
        const isAdmin = this.userIsAdmin();

        this.setState({
          userAccount: {
            isLoggedIn: true, isAdmin,
            username,
          },
        });
      }
    } catch (err) {
      console.error("Err @ ComponentDidMount():", err.message);
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
    const { contracts, accounts } = this.state;

    try {
      const response =
        await contracts.ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.log("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  getUsername = async (_userAddr) => {
    const { ipfsHashStorage } = this.state.contracts;

    try {
      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_userAddr).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (decodedIpfsContent.username) {
        return decodedIpfsContent.username;
      }
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
      return null;
    }
  }

  userIsAdmin() {
    return true;
  }

  render() {
    const { web3, accounts, contracts, token, userAccount } = this.state;

    return (
      <Container fluid="md auto" className="mb-3 mt-3">
        <Navbar bg="transparent" variant="light" expand="lg">
          <Navbar.Brand href="/home">Crowd Funding DApp</Navbar.Brand>
          
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />

          <Navbar.Collapse id="responsive-navbar-nav" className="flex-grow-1 justify-content-evenly">
            <Nav className="mr-auto">
              {
                //if
                (true === userAccount.isAdmin) ?
                  <Nav.Link href="/admin">Admin Space</Nav.Link>  
                //else
                : <></>
                //endif
              }

              <Nav.Link href="/discoverProjects">Projects</Nav.Link>

              {
                //if
                (
                  (web3 !== null) && (accounts !== null) &&
                  (contracts.ipfsHashStorage !== null) &&
                  (contracts.crowdsale !== null) && (contracts.token !== null)
                ) ?
                  //if
                  (true === userAccount.isLoggedIn) ?
                    <Nav.Link href="/startProject">Raise Funding</Nav.Link>
                  //else
                  : <></>
                  //endif
                //else
                : <></>
                //endif
              }
            </Nav>

            <Nav>
              {
                //if
                (
                  (web3 !== null) && (accounts !== null) &&
                  (contracts.ipfsHashStorage !== null) &&
                  (contracts.crowdsale !== null) && (contracts.token !== null)
                ) ?
                  //if
                  (true === userAccount.isLoggedIn) ?
                    <>
                      <Nav.Link disabled><b>Crypto Wallet:</b> Connected</Nav.Link>

                      <Nav.Link href="/crowdsale">{ token.symbol }: { token.accountBalance / token.decimals }</Nav.Link>

                      <NavDropdown title="My Account" id="my-account-nav-dropdown">
                        <NavDropdown.Item href="/myAccount">{ userAccount.username } Profile</NavDropdown.Item>
                        <NavDropdown.Divider />
                        <NavDropdown.Item href="/logout">Logout</NavDropdown.Item>
                      </NavDropdown>
                    </>
                  //else
                  :
                    <>
                      <Nav.Link disabled><b>Crypto Wallet:</b> Connected</Nav.Link>

                      <NavDropdown title="Login" id="login-nav-dropdown">
                        <NavDropdown.Item href="/login">Login</NavDropdown.Item>
                        <NavDropdown.Divider />
                        <NavDropdown.Item href="/register">Create Account</NavDropdown.Item>
                      </NavDropdown>
                    </>
                  //endif
                //else
                :
                  <>
                    <Nav.Link disabled><b>Crypto Wallet:</b> Disconnected</Nav.Link>

                    <NavDropdown title="Login" id="login-nav-dropdown">
                      <NavDropdown.Item href="/login">Login</NavDropdown.Item>
                      <NavDropdown.Item href="/register">Create Account</NavDropdown.Item>
                    </NavDropdown>
                  </>
                //endif
              }
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <hr className="mt-3" />
      </Container>
    );
  }
}

export default Header;
