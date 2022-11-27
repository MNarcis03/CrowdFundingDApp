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

import getWeb3 from "../../utils/getWeb3";
import ipfs from "../../utils/ipfs";
import session from "../../utils/session";

import CrowdFunding from "../../contracts/CrowdFunding.json";
import IpfsHashStorage from "../../contracts/IpfsHashStorage.json";
import TokenCrowdsale from "../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "../../contracts/CrowdFundingToken.json";

import "./AdminControlCenter.css";

class AdminControlCenter extends Component {
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
        balance: 0,
      },
      userAccount: {
        username: "",
        isAdmin: false,
      },
      view: {
        loaded: false,
        enumeration: {
          E_PROJECTS_VIEW: 0,
          E_USERS_VIEW: 1,
        },
        active: {
          projects: true,
          users: false,
        },
        data: {
          projects: {
            fetched: null,
            generated: null,
            pagination: {
              ITEMS_PER_PAGE: 4,
              activePage: 1,
            },
          },
          users: {
            fetched: null,
            generated: null,
            pagination: {
              ITEMS_PER_PAGE: 4,
              activePage: 1,
            },
          },
        },
      },
    };

    this.userIsAdmin = this.userIsAdmin.bind(this);
    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userExists = this.userExists.bind(this);
    this.getUsername = this.getUsername.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.fetchProjects = this.fetchProjects.bind(this);
    this.generateProjectsView = this.generateProjectsView.bind(this);
    this.generatePaginationItems = this.generatePaginationItems.bind(this);
    this.handlePageClick = this.handlePageClick.bind(this);
    this.approveProject = this.approveProject.bind(this);
    this.fetchUsers = this.fetchUsers.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
    this.generateUsersView = this.generateUsersView.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      let networkId = await web3.eth.net.getId();

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
      const balance = await token.methods.balanceOf(accounts[0]).call();

      this.setState({
        web3,
        accounts,
        contracts: {
          crowdFunding,
          ipfsHashStorage,
          crowdsale,
          token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          balance: new BigNumber(balance),
        },
      });

      let isAdmin = false;

      if (true === this.userIsLoggedIn()) {
        if (true === await this.userExists()) {
          const username = await this.getUsername(accounts[0]);
          isAdmin = this.userIsAdmin(username);

          this.setState({
            userAccount: {
              username, isAdmin,
            },
          });
        }
      }

      if (true === isAdmin) {
        let { view } = this.state;

        const lastProjectId = await crowdFunding.methods.getLastProjectId().call();

        if (lastProjectId > 0) {
          view.data.projects.fetched = await this.fetchProjects(lastProjectId);

          if (view.data.projects.fetched.length > 0) {
            view.data.projects.generated = this.generateProjectsView(view.data.projects.fetched);

            this.setState({ view });
          }
        }

        view.data.users.fetched = await this.fetchUsers();

        if (view.data.users.fetched && view.data.users.fetched.length > 0) {
          view.data.users.generated = this.generateUsersView(view.data.users.fetched);

          this.setState({ view });
        }
      }
    } catch (err) {
      console.error("Err @ ComponentDidMount():", err.message);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }

    let { view } = this.state;
    view.loaded = true;
    this.setState({ view });
  }

  userIsAdmin(_username) {
    return true;
  }

  userIsLoggedIn() {
    return (session.sessionExpired() === false) ? true : false;
  }

  userExists = async () => {
    const  { ipfsHashStorage } = this.state.contracts;
    const { accounts } = this.state;

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

  setView(_view) {
    const { view } = this.state;

    if (view.enumeration.E_PROJECTS_VIEW === _view) {
      if (false === view.active.projects) {
        view.active.projects = true;
        view.active.users = false;
        this.setState({ view });
      }
    } else if (view.enumeration.E_USERS_VIEW === _view) {
      if (false === view.active.users) {
        view.active.users = true;
        view.active.projects = false;
        this.setState({ view });
      }
    }
  }

  fetchProjects = async (_lastProjectId) => {
    let projects = [];

    const { crowdFunding } = this.state.contracts;

    for (let it = 0; it < _lastProjectId; it++) {
      try {
        let project = {};

        project.id = it;

        const ownerAddr = await crowdFunding.methods.getOwner(it).call();
        project.owner = await this.getUsername(ownerAddr);

        project.name = await crowdFunding.methods.getName(it).call();
        project.approved = await crowdFunding.methods.isApproved(it).call();
        project.open = await crowdFunding.methods.isOpen(it).call();
        project.goal = await crowdFunding.methods.getGoal(it).call();
        project.balance = await crowdFunding.methods.getBalance(it).call();

        projects.push(project);
      } catch (err) {
        console.error("Err @ fetchProjects(): it =", it, ":", err.message);
      }
    }

    return projects;
  }

  generateProjectsView(_projects) {
    let listGroup = [];
    let listGroupItems = [];

    const { pagination } = this.state.view.data.projects;
    const { token } = this.state;

    let start = pagination.ITEMS_PER_PAGE * (pagination.activePage - 1);
    let end = pagination.ITEMS_PER_PAGE * pagination.activePage;

    if (end > _projects.length) {
      end = _projects.length;
    }

    listGroupItems.push(
      <ListGroup.Item as="li">
        <Row>
          <Col><i>PROJECT</i></Col>
          <Col><i>OWNER</i></Col>
          <Col><i>FUNDING</i></Col>
          <Col><i>STATUS</i></Col>
        </Row>
      </ListGroup.Item>
    );

    for (let it = start; it < end; it++) {
      listGroupItems.push(
        <ListGroup.Item as="li">
          <Row>
            <Col>
              <Link to={{ pathname: `/viewProject/${ _projects[it].id }` }} className="btn fw-bold">
                { _projects[it].name }
              </Link>
            </Col>
            <Col>
              Created by { _projects[it].owner }
            </Col>
            <Col>
              { _projects[it].balance / token.decimals }/
              { _projects[it].goal / token.decimals } { token.symbol } Funded
            </Col>
            {
              // if
              (false === _projects[it].approved) ?
                <Col>
                  <Button
                    type="submit"
                    variant="outline-secondary"
                    onClick={ () => this.approveProject(_projects[it].id) }
                  >
                    Needs Approval
                  </Button>
                </Col>
              // else
              :
              <Col>
                { (true === _projects[it].open) ? "Open" : "Closed" }
              </Col>
            }
          </Row>
        </ListGroup.Item>
      );
    }

    if (listGroupItems.length > 0) {
      let paginationItems = null;

      if (pagination.activePage > 1 && pagination.ITEMS_PER_PAGE * pagination.activePage > _projects.length) {
        for (let it = _projects.length; it < pagination.ITEMS_PER_PAGE * pagination.activePage; it++) {
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

      if (pagination.ITEMS_PER_PAGE < _projects.length) {
        const { E_PROJECTS_VIEW } = this.state.view.enumeration;

        paginationItems = this.generatePaginationItems(
          E_PROJECTS_VIEW, _projects.length
        );
      }

      listGroup.push(
        <Row className="justify-content-md-center">
          <ListGroup as="ol" variant="flush" style={{ width: "90%" }}>
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

    return listGroup;
  }

  generatePaginationItems(_view, _numOfItems) {
    let paginationItems = [];

    const { projects, users } = this.state.view.data;
    const { enumeration } = this.state.view;

    paginationItems.push(
      <>
        <Pagination.First />
        <Pagination.Prev />
      </>
    );

    let lastPage =
      (_view === enumeration.E_PROJECTS_VIEW) ?
      _numOfItems / projects.pagination.ITEMS_PER_PAGE
      :
      _numOfItems / users.pagination.ITEMS_PER_PAGE;

    if (
      (_view === enumeration.E_PROJECTS_VIEW &&
      _numOfItems % projects.pagination.ITEMS_PER_PAGE !== 0)
      ||
      (_view === enumeration.E_USERS_VIEW &&
      _numOfItems % users.pagination.ITEMS_PER_PAGE !== 0)
    ) {
      lastPage += 1;
    }

    for (let it = 1; it <= lastPage; it++) {
      if (enumeration.E_PROJECTS_VIEW === _view) {
        paginationItems.push(
          <Pagination.Item
            key={ it }
            active={ it === projects.pagination.activePage }
            onClick={ () => this.handlePageClick(_view, it) }
          >
            { it }
          </Pagination.Item>,
        );
      } else if (enumeration.E_USERS_VIEW === _view) {
        paginationItems.push(
          <Pagination.Item
            key={ it }
            active={ it === users.pagination.activePage }
            onClick={ () => this.handlePageClick(_view, it) }
          >
            { it }
          </Pagination.Item>,
        );
      }
    }

    paginationItems.push(
      <>
        <Pagination.Next />
        <Pagination.Last />
      </>
    );

    return paginationItems;
  }

  handlePageClick = async (_view, _page) => {
    const { view } = this.state;

    const activePage =
      (view.enumeration.E_PROJECTS_VIEW === _view) ?
      view.data.projects.pagination.activePage : view.data.users.pagination.activePage;

    if (_page !== activePage) {
      if (view.enumeration.E_PROJECTS_VIEW === _view) {
        view.data.projects.pagination.activePage = _page;
        this.setState({ view });

        view.data.projects.generated = this.generateProjectsView(view.data.projects.fetched);
      } else if (view.enumeration.E_USERS_VIEW === _view) {
        view.data.users.pagination.activePage = _page;
        this.setState({ view });

        view.data.users.generated = this.generateUsersView(view.data.users.fetched);
      }

      this.setState({ view });
    }
  }

  approveProject(_projectId) {
    (async () => {
      const { accounts, contracts, view } = this.state;

      try {
        await contracts.crowdFunding.methods.approve(_projectId).send({ from: accounts[0] });

        view.data.projects.fetched[_projectId].approved =
          await contracts.crowdFunding.methods.isApproved(_projectId).call();

        view.data.projects.generated =
          this.generateProjectsView(view.data.projects.fetched);

        this.setState({ view });
      } catch (err) {
        console.err("Err @ approveProject():", err.message);

        alert(
          `Transaction failed or was rejected. Check console for details.`,
        );
      }
    })();
  }

  fetchUsers = async () => {
    let fetched = [];

    try {
      const { crowdFunding, ipfsHashStorage, token } = this.state.contracts;

      const accounts = await ipfsHashStorage.methods.getAccounts().call();

      for (let it = 0; it < accounts.length; it++) {
        let userProfile = await this.getUserProfile(accounts[it]);

        if (userProfile !== null) {
          userProfile.balance = await token.methods.balanceOf(accounts[it]).call();

          fetched.push(userProfile);
        }
      }
    } catch (err) {
      console.error("Err @ fetchUsers():", err.message);
      return null;
    }

    return fetched;
  }

  getUserProfile = async (_accountAddress) => {
    try {
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_accountAddress).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      return decodedIpfsContent;
    } catch (err) {
      console.error("Err @ getUserProfile():", err.message);
    }

    return null;
  }

  generateUsersView(_users) {
    let listGroup = [];
    let listGroupItems = [];

    const { pagination } = this.state.view.data.users;
    const { token } = this.state;

    let start = pagination.ITEMS_PER_PAGE * (pagination.activePage - 1);
    let end = pagination.ITEMS_PER_PAGE * pagination.activePage;

    if (end > _users.length) {
      end = _users.length;
    }

    listGroupItems.push(
      <ListGroup.Item as="li">
        <Row>
          <Col><b>USERNAME</b></Col>
          <Col><b>E-MAIL</b></Col>
          <Col><b>FIRSTNAME</b></Col>
          <Col><b>SECONDNAME</b></Col>
          <Col><b>{ token.symbol } BALANCE</b></Col>
          <Col><b>STATE</b></Col>
          <Col><b>CITY</b></Col>
        </Row>
      </ListGroup.Item>
    );

    for (let it = start; it < end; it++) {
      listGroupItems.push(
        <ListGroup.Item as="li">
          <Row>
            <Col>{ _users[it].username }</Col>
            <Col>{ _users[it].email }</Col>
            <Col>{ _users[it].firstname }</Col>
            <Col>{ _users[it].lastname }</Col>
            <Col>{ _users[it].balance / token.decimals }</Col>
            <Col>{ _users[it].state }</Col>
            <Col>{ _users[it].city }</Col>
          </Row>
        </ListGroup.Item>
      );
    }

    if (listGroupItems.length > 0) {
      let paginationItems = null;

      if (pagination.activePage > 1 && pagination.ITEMS_PER_PAGE * pagination.activePage > _users.length) {
        for (let it = _users.length; it < pagination.ITEMS_PER_PAGE * pagination.activePage; it++) {
          listGroupItems.push(
            <ListGroup.Item as="li">
              <Row>
                <Col>-</Col>
                <Col>-</Col>
                <Col>-</Col>
                <Col>-</Col>
                <Col>-</Col>
                <Col>-</Col>
                <Col>-</Col>
              </Row>
            </ListGroup.Item>
          );
        }
      }

      if (pagination.ITEMS_PER_PAGE < _users.length) {
        const { E_USERS_VIEW } = this.state.view.enumeration;

        paginationItems = this.generatePaginationItems(
          E_USERS_VIEW, _users.length
        );
      }

      listGroup.push(
        <Row className="justify-content-md-center">
          <ListGroup as="ol" variant="flush" style={{ width: "100%" }}>
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

    return listGroup;
  }

  render() {
    const { web3, accounts, contracts, userAccount, view } = this.state;

    return (
      <Container fluid="md" className="AdminControlCenter" style={{ width: "100%", height: "70%" }}>
        {/* <Row className="justify-content-md-center" style={{ width: "100%", height: "100%" }}> */}
          <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
            <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
              {
                //if
                (false === view.loaded) ?
                  <>
                    <Card.Title className="display-6 mb-5">
                      Loading Admin Space...
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
                    (false === userAccount.isAdmin) ?
                      <Redirect to="/home" />
                    //else
                    :
                      <>
                        <Card.Title className="display-6 mb-5">
                          <b>Admin Space</b>
                        </Card.Title>

                        <ButtonGroup className="mb-5" style={{ width: "20%" }}>
                          <Button
                            type="submit"
                            onClick={ () => this.setView(view.enumeration.E_PROJECTS_VIEW) }
                            active={ view.active.projects }
                            variant="outline-secondary"
                            className="fw-bold"
                            style={{ width: "50%" }}
                          >
                            Projects
                          </Button>

                          <Button
                            type="submit"
                            onClick={ () => this.setView(view.enumeration.E_USERS_VIEW) }
                            active={ view.active.users }
                            variant="outline-secondary"
                            className="fw-bold"
                            style={{ width: "50%" }}
                          >
                            Users
                          </Button>
                        </ButtonGroup>

                        {
                          //if
                          (true === view.active.projects) ?
                            //if
                            ((null !== view.data.projects.generated) && (view.data.projects.generated.length > 0)) ?
                              view.data.projects.generated
                            //else
                            : <Card.Text className="lead">No projects available...</Card.Text>
                            //endif
                          //else
                          : <></>
                          //endif
                        }

                        {
                          //if
                          (true === view.active.users) ?
                            //if
                            ((null !== view.data.users.generated) && (view.data.users.generated.length > 0)) ?
                              view.data.users.generated
                            //else
                            : <Card.Text className="lead">No users available...</Card.Text>
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

export default AdminControlCenter;
