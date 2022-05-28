import React, { Component } from "react";
// eslint-disable-next-line
import {
  Container, Row, Col,
  Alert,
  Pagination, PageItem,
  Card,
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
              ITEMS_PER_PAGE: 4,
              activePage: 1,
            }
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
    let projectsView = [];

    const { token } = this.state;
    const { projects } = this.state.view.data;

    if (projects.fetched.length > 0) {
      let cards = [];

      let start = projects.pagination.ITEMS_PER_PAGE * (projects.pagination.activePage - 1);
      let end = projects.pagination.ITEMS_PER_PAGE * projects.pagination.activePage;
  
      if (end > projects.fetched.length) {
        end = projects.fetched.length;
      }

      for (let it = start; it < end; it++) {
        cards.push(
          <Col>
            <Card className="text-center justify-content-md-center" style={{ width: "14rem", height: "10rem" }}>
              <Card.Body className="mt-1 mb-2">
                <Card.Title className="lead">
                  { projects.fetched[it].name }
                </Card.Title>

                <Card.Text className="text-muted mb-1">
                  Created by { projects.fetched[it].owner }
                </Card.Text>

                <Card.Text className="text-muted">
                  { (projects.fetched[it].balance / token.decimals) * 100
                  / (projects.fetched[it].goal / token.decimals) }% Funded
                </Card.Text>

                <Link to={{ pathname: `/viewProject/${ projects.fetched[it].id }` }} className="btn btn-secondary">
                  View More
                </Link>
              </Card.Body>
            </Card>
          </Col>
        );
      }

      if (cards.length > 0) {
        let paginationItems = null;

        if (projects.pagination.ITEMS_PER_PAGE < cards.length) {
          paginationItems = this.generatePaginationItems(cards.length);
        }

        projectsView.push(
          <Row className="text-center justify-content-md-center">
            <Row>
              { cards }
            </Row>

            {
              //if
              (null !== paginationItems) ?
                <Row>
                  <Pagination size="sm" className="justify-content-md-center mt-5">
                    { paginationItems }
                  </Pagination>
                </Row>
              //else
              : <></>
              //endif
            }
            
          </Row>
        );
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

    const { ipfsHashStorage } = this.state.contracts;

    const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_ownerAddr).call();

    const ipfsContent = ipfs.cat(ipfsHash);

    const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

    if (decodedIpfsContent.username) {
      ownerName = decodedIpfsContent.username;
    }

    return ownerName;
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

  render () {
    const { web3, accounts, contracts, view } = this.state;

    return (
      <Container fluid="md auto" className="DiscoverProjects" style={{ width: "100%", height: "60%" }}>
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
                        Invest In Projects
                      </Card.Title>

                      <Card.Text className="text-muted mb-3">All Projects List</Card.Text>

                      <hr/>

                      <Card.Text className="lead mb-5">
                        Browse current investment opportunities on Crowd Funding DApp.
                        All companies are vetted and they pass the approval process due diligence.
                      </Card.Text>
                      {
                        //if
                        (
                          (null !== view.data.projects.generated) &&
                          (view.data.projects.generated.length > 0)
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
