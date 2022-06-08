import React, { Component } from "react";
import { Redirect, Link } from "react-router-dom";
import {
  Container, Row, Col,
  Alert,
  Card,
  ButtonGroup, Button,
  ListGroup,
  Pagination, PageItem,
  Spinner
} from "react-bootstrap";

import BigNumber from "bignumber.js";

import getWeb3 from "./../../utils/getWeb3";
import ipfs from "./../../utils/ipfs";
import session from "./../../utils/session";

import CrowdFunding from "./../../contracts/CrowdFunding.json";
import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";

import "./MyAccount.css";

class MyAccount extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contracts: {
        crowdFunding: null,
        ipfsHashStorage: null,
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
        userProfile: null,
      },
      view: {
        loaded: false,
        active: {
          wallet: true,
          createdProjects: false,
          fundedProjects: false,
        },
        data: {
          createdProjects: {
            fetched: null,
            generated: null,
            pagination: {
              ITEMS_PER_PAGE: 4,
              activePage: 1,
            },
          },
          fundedProjects: {
            fetched: null,
            generated: null,
            pagination: {
              ITEMS_PER_PAGE: 4,
              activePage: 1,
            },
          },
        },
        enumeration: {
          E_WALLET_VIEW: 0,
          E_CREATED_PROJECTS_VIEW: 1,
          E_FUNDED_PROJECTS_VIEW: 2,
        },
      },
    };

    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.fetchCreatedProjects = this.fetchCreatedProjects.bind(this);
    this.generateCreatedProjectsView = this.generateCreatedProjectsView.bind(this);
    this.fetchFundedProjects = this.fetchFundedProjects.bind(this);
    this.generateFundedProjectsView = this.generateFundedProjectsView.bind(this);
    this.generatePaginationItems = this.generatePaginationItems.bind(this);
    this.handlePageClick = this.handlePageClick.bind(this);
    this.setActiveView = this.setActiveView.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      let networkId = await web3.eth.net.getId();

      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        CrowdFunding.networks[networkId] &&
        CrowdFunding.networks[networkId].address,
      );

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
        web3,
        accounts,
        contracts: {
          crowdFunding, ipfsHashStorage,
          crowdsale, token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          accountBalance: new BigNumber(accountBalance),
        },
      });

      let { view } = this.state;

      const isLoggedIn = await this.userIsLoggedIn();

      if (true === isLoggedIn) {
        const userProfile = await this.getUserProfile();

        view.data.createdProjects.fetched = await this.fetchCreatedProjects();

        if (
          (null != view.data.createdProjects.fetched) &&
          (view.data.createdProjects.fetched.length > 0)
        ) {
          this.setState({ view });
          view.data.createdProjects.generated = this.generateCreatedProjectsView();
        }

        view.data.fundedProjects.fetched = await this.fetchFundedProjects();

        if (
          (null != view.data.fundedProjects.fetched) &&
          (view.data.fundedProjects.fetched.length > 0)
        ) {
          this.setState({ view });
          view.data.fundedProjects.generated = await this.generateFundedProjectsView();
        }

        this.setState({
          userAccount: {
            isLoggedIn, userProfile,
          },
          view,
        });
      }

      view.loaded = true;
      this.setState({ view });
    } catch (err) {
      let { view } = this.state;
      view.loaded = true;
      this.setState({ view });

      console.error(err.message);

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
    const { accounts } = this.state;
    const  { ipfsHashStorage } = this.state.contracts;

    try {
      const response = await ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (error) {
      console.error("Err @ userExists(): ", error.message);
    }

    return false;
  }

  getUserProfile = async (_userAddr) => {
    let userProfile = {};

    try {
      const { accounts } = this.state;
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(accounts[0]).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (null !== decodedIpfsContent) {
        console.log(decodedIpfsContent);
        userProfile.email = decodedIpfsContent.email;
        userProfile.firstname = decodedIpfsContent.firstname;
        userProfile.lastname = decodedIpfsContent.lastname;
        userProfile.username = decodedIpfsContent.username;
        userProfile.state = decodedIpfsContent.state;
        userProfile.city = decodedIpfsContent.city;
      }
    } catch (err) {
      console.error("Err @ getUsername():", err.message);
      return null;
    }

    return userProfile;
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

  fetchCreatedProjects = async () => {
    let projects = [];

    try {
      const { accounts } = this.state;
      const { crowdFunding } = this.state.contracts;

      const projectsIds = await crowdFunding.methods.getOwnerProjects(accounts[0]).call();

      for (let it = 0; it < projectsIds.length; it++) {
        try {
          let project = {};

          project.id = projectsIds[it];
          project.name = await crowdFunding.methods.getName(projectsIds[it]).call();
          project.goal = await crowdFunding.methods.getGoal(projectsIds[it]).call();
          project.balance = await crowdFunding.methods.getBalance(projectsIds[it]).call();
          project.approved = await crowdFunding.methods.isApproved(projectsIds[it]).call();
          project.open = await crowdFunding.methods.isOpen(projectsIds[it]).call();

          projects.push(project);
        } catch (err) {
          console.error("Err @ getCreatedProjects(): it =", it, ":", err.message);
        }
      }
    } catch (err) {
      console.error("Err @ getCreatedProjects():", err.message);
    }

    return projects;
  }

  generateCreatedProjectsView() {
    let listGroup = [];
    let listGroupItems = [];

    const { symbol, decimals } = this.state.token;
    const { createdProjects } = this.state.view.data;

    if ((null !== createdProjects.fetched) && (createdProjects.fetched.length > 0)) {
      let start = 0;
      let end = createdProjects.fetched.length;

      if (createdProjects.fetched.length > createdProjects.pagination.ITEMS_PER_PAGE) {
        start = createdProjects.pagination.ITEMS_PER_PAGE * (createdProjects.pagination.activePage - 1);
        end = createdProjects.pagination.ITEMS_PER_PAGE * createdProjects.pagination.activePage;

        if (end > createdProjects.fetched.length) {
          end = createdProjects.fetched.length;
        }
      }

      listGroupItems.push(
        <ListGroup.Item as="li">
          <Row>
            <Col><i>PROJECT</i></Col>
            <Col><i>FUNDING</i></Col>
            <Col><i>STATUS</i></Col>
          </Row>
        </ListGroup.Item>
      );

      for (let it = start; it < end; it++) {
        listGroupItems.push(
          <ListGroup.Item as="li">
            <Row>
              {
                //if
                (true === createdProjects.fetched[it].approved) ?
                  <>
                    <Col>
                      <Link to={{ pathname: `/viewProject/${ createdProjects.fetched[it].id }` }} className="btn fw-bold">
                        { createdProjects.fetched[it].name }
                      </Link>
                    </Col>
                    <Col>
                      {
                        createdProjects.fetched[it].balance / decimals
                      } / {
                        createdProjects.fetched[it].goal / decimals
                      } { symbol }
                    </Col>
                    <Col>
                      { (true === createdProjects.fetched[it].open) ? "Open" : "Closed" }
                    </Col>
                  </>
                //else
                :
                  <>
                    <Col>
                      { createdProjects.fetched[it].name }
                    </Col>
                    <Col>
                      {
                        createdProjects.fetched[it].balance / decimals
                      } / {
                        createdProjects.fetched[it].goal / decimals
                      } { symbol }
                    </Col>
                    <Col>
                      { "Not Approved Yet" }
                    </Col>
                  </>
                //endif
              }
            </Row>
          </ListGroup.Item>
        );
      }

      if (listGroupItems.length > 0) {
        let paginationItems = null;

        if (
          createdProjects.pagination.activePage > 1 &&
          createdProjects.pagination.ITEMS_PER_PAGE * createdProjects.pagination.activePage > createdProjects.fetched.length
        ) {
          for (let it = createdProjects.fetched.length; it < createdProjects.pagination.ITEMS_PER_PAGE * createdProjects.pagination.activePage; it++) {
            listGroupItems.push(
              <ListGroup.Item as="li">
                <Row>
                  <Col>-</Col>
                  <Col>-</Col>
                  <Col>-</Col>
                </Row>
              </ListGroup.Item>
            );
          }
        }

        if (createdProjects.pagination.ITEMS_PER_PAGE < createdProjects.fetched.length) {
          const { E_CREATED_PROJECTS_VIEW } = this.state.view.enumeration;

          paginationItems = this.generatePaginationItems(
            E_CREATED_PROJECTS_VIEW, createdProjects.fetched.length
          );
        }

        listGroup.push(
          <Row className="justify-content-md-center">
            <ListGroup as="ol" variant="flush" style={{ width: "70%" }}>
              { listGroupItems }
            </ListGroup>

            {
              //if
              (null !== paginationItems) ?
                <Pagination size="sm" className="mt-5 justify-content-md-center">
                  { paginationItems }
                </Pagination>
              //else
              : <></>
              //endif
            }
          </Row>
        );
      }
    }

    return listGroup;
  }

  fetchFundedProjects = async () => {
    let projects = [];

    try {
      const { accounts } = this.state;
      const { crowdFunding } = this.state.contracts;

      const projectsIds =
        await crowdFunding.methods.getUserFundedProjects(
          accounts[0]
        ).call();

        for (let it = 0; it < projectsIds.length; it++) {
          try {
            let project = {};

            project.id = projectsIds[it];

            project.name =
              await crowdFunding.methods.getName(projectsIds[it]).call();

            project.balance =
              await crowdFunding.methods.getFunderBalance(
                projectsIds[it], accounts[0]
              ).call();

            project.open = await crowdFunding.methods.isOpen(projectsIds[it]).call();

            const ownerAddr = await crowdFunding.methods.getOwner(projectsIds[it]).call();
            const userProfile = await this.getUserProfile(ownerAddr);
            project.owner = userProfile.username;

            projects.push(project);
          } catch (err) {
            console.error("Err @ getFundedProjects(): it =", it, ":", err.message);
          }
        }
    } catch(err) {
      console.error("Err @ getFundedProjects(): ", err.message);
    }

    return projects;
  }

  generateFundedProjectsView() {
    let listGroup = [];
    let listGroupItems = [];

    const { symbol, decimals } = this.state.token;
    const { fundedProjects } = this.state.view.data;

    if (fundedProjects.fetched.length > 0) {
      let start = 0;
      let end = fundedProjects.fetched.length;

      if (fundedProjects.fetched.length > fundedProjects.pagination.ITEMS_PER_PAGE) {
        start = fundedProjects.pagination.ITEMS_PER_PAGE * (fundedProjects.pagination.activePage - 1);
        end = fundedProjects.pagination.ITEMS_PER_PAGE * fundedProjects.pagination.activePage;

        if (end > fundedProjects.fetched.length) {
          end = fundedProjects.fetched.length;
        }
      }

      listGroupItems.push(
        <ListGroup.Item as="li">
          <Row>
            <Col><i>PROJECT</i></Col>
            <Col><i>OWNER</i></Col>
            <Col><i>STATUS</i></Col>
            <Col><i>YOUR FUNDING</i></Col>
          </Row>
        </ListGroup.Item>
      );

      for (let it = start; it < end; it++) {
        listGroupItems.push(
          <ListGroup.Item as="li">
            <Row>
              <Col>
                <Link to={{ pathname: `/viewProject/${ fundedProjects.fetched[it].id }` }} className="btn fw-bold">
                  { fundedProjects.fetched[it].name }
                </Link>
              </Col>
              <Col>
                Created by { fundedProjects.fetched[it].owner }
              </Col>
              <Col>
                { (true === fundedProjects.fetched[it].open) ? "Open" : "Closed" }
              </Col>
              <Col>
                { fundedProjects.fetched[it].balance / decimals } { symbol } Funded
              </Col>
            </Row>
          </ListGroup.Item>
        );
      }

      if (listGroupItems.length > 0) {
        let paginationItems = null;

        if (
          fundedProjects.pagination.activePage > 1 &&
          fundedProjects.pagination.ITEMS_PER_PAGE * fundedProjects.pagination.activePage > fundedProjects.fetched.length
        ) {
          for (let it = fundedProjects.fetched.length; it < fundedProjects.pagination.ITEMS_PER_PAGE * fundedProjects.pagination.activePage; it++) {
            listGroupItems.push(
              <ListGroup.Item as="li">
                <Row>
                  <Col>-</Col>
                  <Col>-</Col>
                  <Col>-</Col>
                  <Col>-</Col>
                </Row>
              </ListGroup.Item>
            );
          }
        }

        if (fundedProjects.pagination.ITEMS_PER_PAGE < fundedProjects.fetched.length) {
          const { E_FUNDED_PROJECTS_VIEW } = this.state.view.enumeration;

          paginationItems = this.generatePaginationItems(
            E_FUNDED_PROJECTS_VIEW, fundedProjects.fetched.length
          );
        }

        listGroup.push(
          <Row className="justify-content-md-center mb-3">
            <ListGroup as="ol" variant="flush" style={{ width: "70%" }}>
              { listGroupItems }
            </ListGroup>

            {
              //if
              (null !== paginationItems) ?
                <Pagination size="sm" className="mt-5 justify-content-md-center">
                  { paginationItems }
                </Pagination>
              //else
              : <></>
              //endif
            }

          </Row>
        );
      }
    }

    return listGroup;
  }

  generatePaginationItems(_forView, _numOfItems) {
    let paginationItems = [];

    const { createdProjects, fundedProjects } = this.state.view.data;
    const { E_CREATED_PROJECTS_VIEW, E_FUNDED_PROJECTS_VIEW } = this.state.view.enumeration;

    const activePage =
      (E_CREATED_PROJECTS_VIEW === _forView) ?
      createdProjects.pagination.activePage : fundedProjects.pagination.activePage;

    const itemsPerPage =
      (E_CREATED_PROJECTS_VIEW === _forView) ?
      createdProjects.pagination.ITEMS_PER_PAGE : fundedProjects.pagination.ITEMS_PER_PAGE;

    let lastPage = _numOfItems / itemsPerPage;

    if (_numOfItems % itemsPerPage !== 0) {
      lastPage += 1;
    }

    paginationItems.push(
      <>
        <Pagination.First />
        <Pagination.Prev />
      </>
    );

    for (let it = 1; it <= lastPage; it++) {
      paginationItems.push(
        <Pagination.Item
          key={ it }
          active={ it === activePage }
          onClick={ () => this.handlePageClick(_forView, it) }
        >
          { it }
        </Pagination.Item>,
      );
    }

    paginationItems.push(
      <>
        <Pagination.Next />
        <Pagination.Last />
      </>
    );

    return paginationItems;
  }

  handlePageClick(_forView, _page) {
    const {
      E_CREATED_PROJECTS_VIEW,
      E_FUNDED_PROJECTS_VIEW
    } = this.state.view.enumeration;

    const { createdProjects, fundedProjects } = this.state.view.data;

    const activePage =
      (E_CREATED_PROJECTS_VIEW === _forView) ?
      createdProjects.pagination.activePage : fundedProjects.pagination.activePage;

    if (_page !== activePage) {
      let { view } = this.state;

      if (E_CREATED_PROJECTS_VIEW === _forView) {
        view.data.createdProjects.pagination.activePage = _page;
        this.setState({ view });

        view.data.createdProjects.generated = this.generateCreatedProjectsView();
      } else if (E_FUNDED_PROJECTS_VIEW === _forView) {
        view.data.fundedProjects.pagination.activePage = _page;
        this.setState({ view });

        view.data.fundedProjects.generated = this.generateFundedProjectsView();
      }

      this.setState({ view });
    }
  }

  setActiveView(_view) {
    const {
      E_WALLET_VIEW,
      E_CREATED_PROJECTS_VIEW,
      E_FUNDED_PROJECTS_VIEW
    } = this.state.view.enumeration;

    let { view } = this.state;

    if (E_WALLET_VIEW === _view) {
      view.active.wallet = true;
      view.active.createdProjects = false;
      view.active.fundedProjects = false;
    } else if (E_CREATED_PROJECTS_VIEW === _view) {
      view.active.wallet = false;
      view.active.createdProjects = true;
      view.active.fundedProjects = false;
    } else if (E_FUNDED_PROJECTS_VIEW === _view) {
      view.active.wallet = false;
      view.active.createdProjects = false;
      view.active.fundedProjects = true;
    }

    this.setState({ view });
  }

  render() {
    const { web3, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md" className="MyAccount" style={{ width: "100%", height: "70%" }}>
        {/* <Row className="justify-content-md-center" style={{ width: "100%", height: "100%" }}> */}
          <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
            <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
              {
                //if
                (false === view.loaded) ?
                  <>
                    <Card.Title className="display-6 mb-5">
                      Loading Account...
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
                    (false === userAccount.isLoggedIn) ?
                      <Redirect to="/home" />
                    //else
                    :
                      <>
                        <Card.Title className="display-6 mb-5">
                          { userAccount.userProfile.username }'s Account
                        </Card.Title>

                        <ButtonGroup className="mb-5" style={{ width: "45%" }}>
                          <Button
                            type="submit"
                            variant="outline-secondary"
                            onClick={ () => this.setActiveView(view.enumeration.E_WALLET_VIEW) }
                            className="fw-bold"
                            style={{ width: "33%" }}
                            active={ view.active.wallet }
                          >
                            Profile
                          </Button>

                          <Button
                            type="submit"
                            variant="outline-secondary"
                            onClick={ () => this.setActiveView(view.enumeration.E_CREATED_PROJECTS_VIEW) }
                            className="fw-bold"
                            style={{ width: "33%" }}
                            active={ view.active.createdProjects }
                          >
                            Created Projects
                          </Button>

                          <Button
                            type="submit"
                            variant="outline-secondary"
                            onClick={ () => this.setActiveView(view.enumeration.E_FUNDED_PROJECTS_VIEW) }
                            className="fw-bold"
                            style={{ width: "33%" }}
                            active={ view.active.fundedProjects }
                          >
                            Funded Projects
                          </Button>
                        </ButtonGroup>

                        {
                          //if
                          (view.active.wallet === true) ?
                            <>
                              <Row className="mb-1">
                                <Col>
                                  <Card.Text className="lead">
                                    <b>Wallet Account Address:</b>
                                  </Card.Text>
                                </Col>
                                <Col>
                                  <Card.Text className="lead">
                                    <b>Wallet Balance:</b>
                                  </Card.Text>
                                </Col>
                              </Row>

                              <Row className="mb-3">
                                <Col>
                                  <Card.Text className="lead">
                                    { accounts[0] }
                                  </Card.Text>
                                </Col>
                                <Col>
                                  <Card.Text className="lead">
                                    { token.accountBalance.div(token.decimals).toString() } { token.symbol }
                                  </Card.Text>
                                </Col>
                              </Row>

                              <Row className="mb-3">
                                <Col>
                                  <Card.Text className="lead">
                                    <b>User Name:</b> { userAccount.userProfile.username }
                                  </Card.Text>
                                </Col>
                                <Col>
                                  <Card.Text className="lead">
                                    <b>E-Mail:</b> { userAccount.userProfile.email }
                                  </Card.Text>
                                </Col>
                              </Row>

                              <Row className="mb-3">
                                <Col>
                                  <Card.Text className="lead">
                                    <b>First Name:</b> { userAccount.userProfile.firstname }
                                  </Card.Text>
                                </Col>
                                <Col>
                                  <Card.Text className="lead">
                                    <b>Last Name:</b> { userAccount.userProfile.lastname }
                                  </Card.Text>
                                </Col>
                              </Row>

                              <Row>
                                <Col>
                                  <Card.Text className="lead">
                                    <b>State:</b> { userAccount.userProfile.state }
                                  </Card.Text>
                                </Col>
                                <Col>
                                  <Card.Text className="lead">
                                    <b>City:</b> { userAccount.userProfile.city }
                                  </Card.Text>
                                </Col>
                              </Row>
                            </>
                          //else
                          : <></>
                          //endif
                        }

                        {
                          //if
                          (view.active.createdProjects === true) ?
                            //if
                            (
                              (view.data.createdProjects.generated !== null) &&
                              (view.data.createdProjects.generated.length > 0)
                            ) ?
                              view.data.createdProjects.generated
                            //else
                            : <Card.Text className="lead">No projects available...</Card.Text>
                            //endif
                          //else
                          : <></>
                          //endif
                        }

                        {
                          //if
                          (view.active.fundedProjects === true) ?
                            //if
                            (
                              (view.data.fundedProjects.generated !== null) &&
                              (view.data.fundedProjects.generated.length > 0)
                            ) ?
                              view.data.fundedProjects.generated
                            //else
                            : <Card.Text className="lead">No projects available...</Card.Text>
                            //endif
                          //else
                          : <></>
                          //endif
                        }
                      </>
                    //endif
                  //else
                  :
                    <Row className="justify-content-md-center mt-5">
                      <Alert variant="light" style={{ width: "50%" }}>
                        <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
                        <p className="lead">Web3, accounts or contracts not loaded...</p>

                        <hr />

                        <p className="mb-0">
                          Make sure you have MetaMask installed and your account is connected to Crowd Funding ETH.
                        </p>
                      </Alert>
                    </Row>
                  //endif
                //endif
              }
            </Card.Body>
          </Card>
        {/* </Row> */}
      </Container>
    );
  }
}

export default MyAccount;
