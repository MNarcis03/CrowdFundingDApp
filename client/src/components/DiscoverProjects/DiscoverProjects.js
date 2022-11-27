import React, { Component } from "react";
// eslint-disable-next-line
import {
  Container, Row, Col,
  Alert,
  Pagination, PageItem,
  Card,
  Form,
  Button,
  Spinner
} from "react-bootstrap";
import { Link } from "react-router-dom";

import ipfs from "./../../utils/ipfs";
import getWeb3 from "./../../utils/getWeb3";

import CrowdFunding from "./../../contracts/CrowdFunding.json";
import IpfsHashStorage from "./../../contracts/IpfsHashStorage.json";
import TokenCrowdsale from "./../../contracts/TokenCrowdsale.json";
import CrowdFundingToken from "./../../contracts/CrowdFundingToken.json";

import "./DiscoverProjects.css";

class DiscoverProjects extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      contracts: {
        crowdFunding: null,
        ipfsHashStorage: null,
      },
      token: {
        symbol: "",
        decimals: 0,
      },
      view: {
        loaded: false,
        data: {
          projects: {
            fetched: null,
            generated: null,
            pagination: {
              ITEMS_PER_PAGE: 3,
              activePage: 1,
            },
          },
          form: {
            inputEnumeration: {
              E_CATEGORY_INPUT: 0,
              E_SORTED_BY_INPUT: 1,
            },
            categoryDefines: {
              ALL_CATEGORIES: "ALL Categories",
              CRYPTO: "Crypto",
              GAMING: "Gaming",
              GREEN_FUTURE: "Green Future",
              SCIENCE: "Science",
            },
            sortedByDefines: {
              OPEN_FOR_FUNDING: "Open For Funding",
              FUNDING_FINISHED: "Funding Finished"
            },
            input: {
              category: "ALL Categories",
              sortedBy: "Open For Funding",
            },
          },
        },
      },
    };

    this.fetchProjects = this.fetchProjects.bind(this);
    this.generateProjectsView = this.generateProjectsView.bind(this);
    this.generatePaginationItems = this.generatePaginationItems.bind(this);
    this.handlePageClick = this.handlePageClick.bind(this);
    this.getOwnerName = this.getOwnerName.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.changeFilter = this.changeFilter.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();

      const accounts = await web3.eth.getAccounts();

      let networkId = await web3.eth.net.getId();
      let deployedNetwork = CrowdFunding.networks[networkId];

      const crowdFunding = new web3.eth.Contract(
        CrowdFunding.abi,
        deployedNetwork && deployedNetwork.address,
      );

      const crowdsale = new web3.eth.Contract(
        TokenCrowdsale.abi,
        TokenCrowdsale.networks[networkId] && TokenCrowdsale.networks[networkId].address,
      );

      const ipfsHashStorage = new web3.eth.Contract(
        IpfsHashStorage.abi,
        IpfsHashStorage.networks[networkId] && IpfsHashStorage.networks[networkId].address,
      );

      const crowdsaleToken = await crowdsale.methods.token().call();

      const token = new web3.eth.Contract(
        CrowdFundingToken.abi, crowdsaleToken
      );

      const symbol = await token.methods.symbol().call();
      const decimals = await token.methods.decimals().call();

      this.setState({
        web3,
        accounts,
        contracts: {
          crowdFunding,
          ipfsHashStorage,
        },
        token: {
          symbol: symbol,
          decimals: 10 ** decimals
        },
      });

      let { view } = this.state;

      view.data.projects.fetched = await this.fetchProjects();

      if (view.data.projects.fetched.length > 0) {
        this.setState({ view });
        view.data.projects.generated = this.generateProjectsView();
        this.setState({ view });
      }
    } catch (error) {
      console.error(error);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }

    let { view } = this.state;
    view.loaded = true;
    this.setState({ view });
  }

  fetchProjects = async () => {
    let projects = [];

    const { crowdFunding } = this.state.contracts;

    const lastProjectId = await crowdFunding.methods.getLastProjectId().call();

    if (lastProjectId > 0) {
      for (let it = 0; it < lastProjectId; it++) {
        try {
          let project = {};

          project.approved = await crowdFunding.methods.isApproved(it).call();

          if (true === project.approved) {
            project.id = it;

            const ownerAddr = await crowdFunding.methods.getOwner(it).call();
            project.owner = await this.getOwnerName(ownerAddr);

            project.name = await crowdFunding.methods.getName(it).call();
            project.approved = await crowdFunding.methods.isApproved(it).call();
            project.open = await crowdFunding.methods.isOpen(it).call();
            project.goal = await crowdFunding.methods.getGoal(it).call();
            project.balance = await crowdFunding.methods.getBalance(it).call();
            project.ipfsHash = await crowdFunding.methods.getIpfsHash(it).call();

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
          console.error("Err @ fetchProjects(): it =", it, ":", err.message);
        }
      }
    }

    return projects;
  }

  generateProjectsView() {
    let projectsView = null;

    const { token } = this.state;
    const { projects, form } = this.state.view.data;

    if (projects.fetched.length > 0) {
      let cards = [];
      let shouldBeOpen = true;

      if (form.sortedByDefines.FUNDING_FINISHED === form.input.sortedBy) {
        shouldBeOpen = false;
      }

      let filteredProjects = [];

      for (let it = 0; it < projects.fetched.length; it++) {
        if (projects.fetched[it].open === shouldBeOpen) {
          if (
            (form.categoryDefines.ALL_CATEGORIES === form.input.category) ||
            (projects.fetched[it].category === form.input.category)
          ) {
            filteredProjects.push(projects.fetched[it]);
          }
        }
      }

      let start = projects.pagination.ITEMS_PER_PAGE * (projects.pagination.activePage - 1);
      let end = projects.pagination.ITEMS_PER_PAGE * projects.pagination.activePage;

      if (end > filteredProjects.length) {
        end = filteredProjects.length;
      }

      for (let it = start; it < end; it++) {
        const card =
          <Col>
            <Card className="text-center justify-content-md-center" style={{ width: "22rem", height: "24rem" }}>
              <Card.Img
                variant="top"
                src={ filteredProjects[it].imageUrl }
                style={{ width: "100%", height: "50%" }}
              />
              <Card.Body>
                <Card.Title className="lead">
                  <b>{ filteredProjects[it].name }</b>
                </Card.Title>

                <Card.Text className="text-muted mb-1">
                  <i>Created by { filteredProjects[it].owner }</i>
                </Card.Text>

                <Card.Text className="text-muted mb-1">
                  { filteredProjects[it].category }
                </Card.Text>

                <Card.Text className="text-muted mb-1">
                  {
                    //if
                    (true === filteredProjects[it].open) ?
                      <b>
                        {
                          Math.floor(
                            (filteredProjects[it].balance / token.decimals) * 100 /
                            (filteredProjects[it].goal / token.decimals)
                          )
                        }% Funded
                      </b>
                    //else
                    : "Funding Finished"
                    //endif
                  }
                </Card.Text>

                <Link to={{ pathname: `/viewProject/${ filteredProjects[it].id }` }} className="btn btn-secondary mt-1">
                  View More
                </Link>
              </Card.Body>
            </Card>
          </Col>;

        if (filteredProjects[it].open === shouldBeOpen) {
          if (
            (form.categoryDefines.ALL_CATEGORIES === form.input.category) ||
            (filteredProjects[it].category === form.input.category)
          ) {
            cards.push(card);
          }
        }
      }

      if (cards.length > 0) {
        let paginationItems = null;
        let numOfItems = filteredProjects.length;

        if (projects.pagination.ITEMS_PER_PAGE < numOfItems) {
          paginationItems = this.generatePaginationItems(numOfItems);
        }

        projectsView =
          <Row className="text-center justify-content-md-center">
            <Row>
              { cards }
            </Row>

            {
              //if
              (null !== paginationItems) ?
                <Row>
                  <Pagination size="sm" className="justify-content-md-center mt-3">
                    { paginationItems }
                  </Pagination>
                </Row>
              //else
              : <></>
              //endif
            }

          </Row>
        ;
      }
    }

    return projectsView;
  }

  generatePaginationItems(_numOfItems) {
    let paginationItems = [];

    const { pagination } = this.state.view.data.projects;

    paginationItems.push(
      <>
        <Pagination.First />
        <Pagination.Prev />
      </>
    );

    let lastPage = _numOfItems / pagination.ITEMS_PER_PAGE;

    if (_numOfItems % pagination.ITEMS_PER_PAGE !== 0) {
      lastPage += 1;
    }

    for (let it = 1; it <= lastPage; it++) {
      paginationItems.push(
        <Pagination.Item key={ it } active={ it === pagination.activePage } onClick={ () => this.handlePageClick(it) }>
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

  handlePageClick = async (_page) => {
    const { view } = this.state;

    if (_page !== view.data.projects.pagination.activePage) {
      view.data.projects.pagination.activePage = _page;
      this.setState({ view });
      view.data.projects.generated = this.generateProjectsView();
      this.setState({ view });
    }
  }

  getOwnerName = async (_ownerAddr) => {
    let ownerName = "";

    try {
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_ownerAddr).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (null !== decodedIpfsContent) {
        ownerName = decodedIpfsContent.username;
      }
    } catch (err) {
      console.error("Err @ getOwnerName():", err.message);
    }

    return ownerName;
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

  changeFilter(_inputType, _value) {
    let { view } = this.state;

    if (view.data.form.inputEnumeration.E_CATEGORY_INPUT === _inputType) {
      if (_value !== view.data.form.input.category) {
        view.data.form.input.category = _value;
        this.setState({ view });
        view.data.projects.generated = this.generateProjectsView();
        this.setState({ view });
      }
    } else if (view.data.form.inputEnumeration.E_SORTED_BY_INPUT === _inputType) {
      if (_value !== view.data.form.input.sortedBy) {
        view.data.form.input.sortedBy = _value;
        this.setState({ view });
        view.data.projects.generated = this.generateProjectsView();
        this.setState({ view });
      }
    }
  }

  render () {
    const { web3, accounts, contracts, view } = this.state;

    return (
      <Container fluid="md auto" className="DiscoverProjects" style={{ width: "100%", height: "85%" }}>
        {/* <Row className="justify-content-md-center" style={{ width: "100%", height: "100%" }}> */}
          <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
            <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
              {
                //if
                (false === view.loaded) ?
                  <>
                    <Card.Title className="display-6 mb-5">
                      Loading Projects...
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
                    <>
                      <Card.Title className="display-6 mb-3">
                        <b>Invest In Projects</b>
                      </Card.Title>

                      <Card.Text className="lead mb-3">All Projects List</Card.Text>

                      <hr/>

                      <Card.Text className="lead mb-5">
                        <i>
                          Browse current investment opportunities on Crowd Funding DApp.
                          All companies are vetted and they pass the approval process due diligence.
                        </i>
                      </Card.Text>

                      <Row className="justify-content-md-center mb-5">
                        <Form
                          style={{ width: "80%" }}
                        >
                          <Row>
                            <Form.Group as={ Col } controlId="formProjectCategory">
                              <Row>
                                <Form.Label column sm={ 4 } className="lead"><b>Show Me:</b></Form.Label>

                                <Col sm={ 6 }>
                                  <Form.Control
                                    required
                                    as="select"
                                    onChange={
                                      e => this.changeFilter(
                                        view.data.form.inputEnumeration.E_CATEGORY_INPUT,
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value={ view.data.form.categoryDefines.ALL_CATEGORIES }>
                                      ALL Categories
                                    </option>
                                    <option value={ view.data.form.categoryDefines.CRYPTO }>
                                      Crypto
                                    </option>
                                    <option value={ view.data.form.categoryDefines.GAMING }>
                                      Gaming
                                    </option>
                                    <option value={ view.data.form.categoryDefines.GREEN_FUTURE }>
                                      Green Future
                                    </option>
                                    <option value={ view.data.form.categoryDefines.SCIENCE }>
                                      Science
                                    </option>
                                  </Form.Control>
                                </Col>
                              </Row>
                            </Form.Group>

                            <Form.Group as={ Col } controlId="formProjectSortedBy">
                              <Row>
                                <Form.Label column sm={ 4 } className="lead"><b>Sorted By:</b></Form.Label>

                                <Col sm={ 6 }>
                                  <Form.Control
                                    required
                                    as="select"
                                    onChange={
                                      e => this.changeFilter(
                                        view.data.form.inputEnumeration.E_SORTED_BY_INPUT,
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value={ view.data.form.sortedByDefines.OPEN_FOR_FUNDING }>
                                      Open For Funding
                                    </option>
                                    <option value={ view.data.form.sortedByDefines.FUNDING_FINISHED }>
                                      Funding Finished
                                    </option>
                                  </Form.Control>
                                </Col>
                              </Row>
                            </Form.Group>
                          </Row>
                        </Form>
                      </Row>

                      {
                        //if
                        (
                          (null !== view.data.projects.generated)
                        ) ?
                          view.data.projects.generated
                        //else
                        : <Card.Text className="lead">No projects available...</Card.Text>
                        //endif
                      }
                    </>
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

export default DiscoverProjects;
