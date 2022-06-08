import React, { Component } from "react";
import { withRouter } from "react-router";
import {
  Alert,
  Container, Row, Col,
  Card,
  ButtonGroup, Button,
  Form, FormControl,
  InputGroup,
  Accordion,
  Image,
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

import "./ViewProject.css";

class ViewProject extends Component {
  constructor(props) {
    super(props);

    this.state = {
      web3: null,
      accounts: null,
      networkId: null,
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
        isOwner: false,
      },
      view: {
        loaded: false,
        active: {
          campaign: true,
          forFunders: false,
          updates: false,
          addUpdate: false,
          edit: false,
        },
        data: {
          project: {
            fetched: null,
          },
          form: {
            validated: false,
            submitted: false,
            failed: false,
            input: {
              depositAmount: 0,
              withdrawAmount: 0,
            },
            errors: {
              depositAmount: null,
              withdrawAmount: null,
            },
            view: {
              deposit: true,
              withdraw: false,
            },
            viewEnumeration: {
              E_DEPOSIT_VIEW: 0,
              E_WITHDRAW_VIEW: 1,
            },
          },
          addUpdateForm: {
            validated: false,
            submitted: false,
            failed: false,
            input: {
              updateTitle: null,
              updateDescription: null,
            },
            errors: {
              updateTitle: null,
              updateDescription: null,
            },
            fieldEnumeration: {
              E_TITLE_FIELD: 0,
              E_DESCRIPTION_FIELD: 1,
            },
          },
          updates: {
            generated: null,
          }
        },
        enumeration: {
          E_CAMPAIGN_VIEW: 0,
          E_FOR_FUNDERS_VIEW: 1,
          E_UPDATES_VIEW: 2,
          E_ADD_UPDATE_VIEW: 3,
          E_EDIT_VIEW: 4,
        },
      },
    };

    this.fetchProject = this.fetchProject.bind(this);
    this.getOwnerName = this.getOwnerName.bind(this);
    this.decodeIpfsContent = this.decodeIpfsContent.bind(this);
    this.userIsLoggedIn = this.userIsLoggedIn.bind(this);
    this.userHasAccount = this.userHasAccount.bind(this);
    this.userIsOwner = this.userIsOwner.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.checkErrors = this.checkErrors.bind(this);
    this.handleDeposit = this.handleDeposit.bind(this);
    this.deposit = this.deposit.bind(this);
    this.changeDepositAmount = this.changeDepositAmount.bind(this);
    this.withdraw = this.withdraw.bind(this);
    this.changeWithdrawAmount = this.changeWithdrawAmount.bind(this);
    this.handleAddUpdate = this.handleAddUpdate.bind(this);
    this.checkAddUpdateErrors = this.checkAddUpdateErrors.bind(this);
    this.handleAddUpdateToIpfs = this.handleAddUpdateToIpfs.bind(this);
    this.addUpdateToIpfs = this.addUpdateToIpfs.bind(this);
    this.setAddUpdateField = this.setAddUpdateField.bind(this);
    this.resetAddUpdateForm = this.resetAddUpdateForm.bind(this);
    this.generateUpdatesView = this.generateUpdatesView.bind(this);
    this.close = this.close.bind(this);
    this.resetForFundersView = this.resetForFundersView.bind(this);
    this.setFormView = this.setFormView.bind(this);
    this.setView = this.setView.bind(this);
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();

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
        networkId,
        accounts,
        contracts: {
          crowdFunding, ipfsHashStorage,
          crowdsale, token,
        },
        token: {
          symbol,
          decimals: 10 ** decimals,
          accountBalance
        },
      });

      let { view } = this.state;

      const projectId = this.props.match.params.id;
      view.data.project.fetched = await this.fetchProject(projectId);

      if (null !== view.data.project.fetched) {
        this.setState({ view });

        view.data.updates.generated = this.generateUpdatesView();
        this.setState({ view });

        const isLoggedIn = await this.userIsLoggedIn();

        if (true === isLoggedIn) {
          const isOwner = await this.userIsOwner(projectId);

          this.setState({
            userAccount: {
              isLoggedIn, isOwner,
            }
          });
        }
      }

      view.loaded = true;
      this.setState({ view });
    } catch (err) {
      let { view } = this.state;

      view.loaded = true;
      this.setState({ view });

      console.error("Err @ ComponentDidMount():", err.message);

      alert (
        `Failed to load web3, accounts, contract or data from blockchain. Check console for details.`,
      );
    }
  }

  fetchProject = async (_projectId) => {
    let project = {};

    if (_projectId && _projectId >= 0) {
      try {
        const { accounts } = this.state;
        const { crowdFunding } = this.state.contracts;

        const lastProjectId = await crowdFunding.methods.getLastProjectId().call();

        if (_projectId < lastProjectId) {
          const isApproved = await crowdFunding.methods.isApproved(_projectId).call();

          if (true === isApproved) {
            project.id = _projectId;
            project.isApproved = isApproved;

            const ownerAddr = await crowdFunding.methods.getOwner(_projectId).call();
            project.owner = await this.getOwnerName(ownerAddr);

            project.name = await crowdFunding.methods.getName(_projectId).call();
            project.isOpen = await crowdFunding.methods.isOpen(_projectId).call();
            project.goal = await crowdFunding.methods.getGoal(_projectId).call();
            project.balance = await crowdFunding.methods.getBalance(_projectId).call();
            project.funderBalance =
              await crowdFunding.methods.getFunderBalance(
                _projectId, accounts[0]
              ).call();

            const funders = await crowdFunding.methods.getFunders(_projectId).call();
            project.funders = funders.length;

            project.ipfsHash = await crowdFunding.methods.getIpfsHash(_projectId).call();

            const ipfsContent = ipfs.cat(project.ipfsHash);
            const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

            if (decodedIpfsContent && decodedIpfsContent.description) {
              project.description = decodedIpfsContent.description;
            }

            if (decodedIpfsContent && decodedIpfsContent.category) {
              project.category = decodedIpfsContent.category;
            }

            if (decodedIpfsContent && decodedIpfsContent.updates) {
              project.updates = decodedIpfsContent.updates;
            }

            if (decodedIpfsContent && decodedIpfsContent.imageUrl) {
              project.imageUrl = decodedIpfsContent.imageUrl;
            }
          }
        }
      } catch (err) {
        console.error("Err @ fetchProject():", err.message);
        project = null;
      }
    }

    return project;
  }

  getOwnerName = async (_ownerAddr) => {
    let ownerName = "";

    try {
      const { ipfsHashStorage } = this.state.contracts;

      const ipfsHash = await ipfsHashStorage.methods.getAccountIpfsHash(_ownerAddr).call();

      const ipfsContent = ipfs.cat(ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (decodedIpfsContent.username) {
        ownerName = decodedIpfsContent.username;
      }
    } catch(err) {
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
      const { accounts } = this.state;
      const { ipfsHashStorage } = this.state.contracts;

      const response = await ipfsHashStorage.methods.accountHasIpfsHash(accounts[0]).call();

      if (true === response) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userHasAccount():", err.message);
    }

    return false;
  }

  userIsOwner = async (_projectId) => {
    try {
      const { accounts } = this.state;
      const { crowdFunding } = this.state.contracts;

      const ownerAddr = await crowdFunding.methods.getOwner(_projectId).call();

      if (ownerAddr === accounts[0]) {
        return true;
      }
    } catch (err) {
      console.error("Err @ userIsOwner():", err.message);
    }

    return false;
  }

  handleSubmit(_event) {
    const form = _event.currentTarget;

    if (true === form.checkValidity()) {
      let { view } = this.state;

      const errors = this.checkErrors();

      view.data.form.errors = errors;
      this.setState({ view });

      if (Object.keys(errors).length < 1) {
        view.data.form.validated = true;
        this.setState({ view });

        (async () => {
          if (true === view.data.form.view.deposit) {
            await this.handleDeposit();
          } else if (true === view.data.form.view.withdraw) {
            await this.handleWithdraw();
          }
        })();
      }
    }

    _event.preventDefault();
    _event.stopPropagation();
  }

  checkErrors() {
    let errors = {};

    const { token } = this.state;
    const { fetched } = this.state.view.data.project;
    const { depositAmount, withdrawAmount } = this.state.view.data.form.input;
    const { deposit, withdraw } = this.state.view.data.form.view;

    if (true === deposit) {
      if (depositAmount < 1) {
        errors.depositAmount = "Funding Amount Should Be Greater Than Zero.";
      } else if (depositAmount > (token.accountBalance / token.decimals)) {
        errors.depositAmount = "Funding Amount Exceeds Account's Balance";
      }
    } else if (true === withdraw) {
      if (withdrawAmount < 1) {
        errors.withdrawAmount = "Withdraw Amount Should Be Greater Than Zero.";
      } else if (withdrawAmount > (fetched.funderBalance / token.decimals)) {
        errors.withdrawAmount = "Withdraw Amount Exceeds Your Funding";
      }
    }

    return errors;
  }

  handleDeposit = async () => {
    let { view } = this.state;

    const response = await this.deposit();

    if (true === response) {
      view.data.form.submitted = true;
    } else {
      view.data.form.validated = false;
      view.data.form.failed = true;
    }

    this.setState({ view });
  }

  deposit = async () => {
    try {
      const { accounts, networkId, contracts } = this.state;
      let { token, view } = this.state;

      const crowdFundingAddress =
        CrowdFunding.networks[networkId] &&
        CrowdFunding.networks[networkId].address;

      await contracts.token.methods.approve(
        crowdFundingAddress,
        view.data.form.input.depositAmount * token.decimals
      ).send({ from: accounts[0] });

      await contracts.crowdFunding.methods.deposit(
        view.data.project.fetched.id,
        view.data.form.input.depositAmount * token.decimals
      ).send({ from: accounts[0] });

      const accountBalance = await contracts.token.methods.balanceOf(accounts[0]).call();
      token.accountBalance = new BigNumber(accountBalance);
      this.setState({ token });

      view.data.project.fetched.balance =
        await contracts.crowdFunding.methods.getBalance(
          view.data.project.fetched.id
        ).call();

      view.data.project.fetched.funderBalance =
        await contracts.crowdFunding.methods.getFunderBalance(
          view.data.project.fetched.id, accounts[0]
        ).call();

      const funders = await contracts.crowdFunding.methods.getFunders(view.data.project.fetched.id).call();
      view.data.project.fetched.funders = funders.length;

      this.setState({ view });
    } catch (err) {
      console.error("Err @ deposit():", err.message);
      return false;
    }

    return true;
  }

  changeDepositAmount(_event) {
    let { view } = this.state;

    if (_event && _event.target.value) {
      const { token } = this.state;

      const balance = token.accountBalance / token.decimals;

      if ((_event.target.value >= 1) && (_event.target.value <= balance)) {
        view.data.form.input.depositAmount = _event.target.value;
        this.setState({ view });
      }
    } else {
      view.data.form.input.depositAmount = 0;
      this.setState({ view });
    }
  }

  handleWithdraw = async () => {
    let { view } = this.state;

    const response = await this.withdraw();

    if (true === response) {
      view.data.form.submitted = true;
    } else {
      view.data.form.validated = false;
      view.data.form.failed = true;
    }

    this.setState({ view });
  }

  withdraw = async () => {
    try {
      const { accounts, networkId, contracts } = this.state;
      let { token, view } = this.state;

      const crowdFundingAddress =
        CrowdFunding.networks[networkId] && CrowdFunding.networks[networkId].address;

      await contracts.crowdFunding.methods.withdraw(
        view.data.project.fetched.id,
        view.data.form.input.withdrawAmount * token.decimals
      ).send({ from: accounts[0] });

      await contracts.token.methods.transferFrom(
        crowdFundingAddress, accounts[0],
        view.data.form.input.withdrawAmount * token.decimals
      ).send({ from: accounts[0] });;

      const accountBalance = await contracts.token.methods.balanceOf(accounts[0]).call();
      token.accountBalance = new BigNumber(accountBalance);
      this.setState({ token });

      view.data.project.fetched.balance =
        await contracts.crowdFunding.methods.getBalance(
          view.data.project.fetched.id
        ).call();

      view.data.project.fetched.funderBalance =
        await contracts.crowdFunding.methods.getFunderBalance(
          view.data.project.fetched.id, accounts[0]
        ).call();

      this.setState({ view });
    } catch (err) {
      console.error("Err @ withdraw():", err.message);
      return false;
    }

    return true;
  }

  changeWithdrawAmount(_event) {
    let { view } = this.state;

    if (_event && _event.target.value) {
      const { token } = this.state;

      const balance = view.data.project.fetched.funderBalance / token.decimals;

      if ((_event.target.value >= 1) && (_event.target.value <= balance)) {
        view.data.form.input.withdrawAmount = _event.target.value;

        if (!!view.data.form.errors.withdrawAmount) {
          view.data.form.errors.withdrawAmount = null;
        }

        this.setState({ view });
      }
    } else {
      view.data.form.input.withdrawAmount = 0;
      this.setState({ view });
    }
  }

  handleAddUpdate(_event) {
    const form = _event.currentTarget;

    if (true === form.checkValidity()) {
      let { view } = this.state;

      const addUpdateErrors = this.checkAddUpdateErrors();

      view.data.addUpdateForm.errors = addUpdateErrors;
      this.setState({ view });

      if (!addUpdateErrors.updateTitle && !addUpdateErrors.updateDescription) {
        view.data.addUpdateForm.validated = true;
        this.setState({ view });

        (async () => {
          await this.handleAddUpdateToIpfs();
        })();
      }
    }

    _event.preventDefault();
    _event.stopPropagation();
  }

  checkAddUpdateErrors() {
    let addUpdateErrors = {
      updateTitle: null,
      updateDescription: null,
    };

    const { updateTitle, updateDescription } = this.state.view.data.addUpdateForm.input;

    if (!updateTitle) {
      addUpdateErrors.updateTitle = "Please fill out this field.";
    } else if (updateTitle.length > 30) {
      addUpdateErrors.updateTitle = "Update Title Too Long.";
    }

    if (!updateDescription) {
      addUpdateErrors.updateDescription = "Please fill out this field.";
    } else if (updateDescription.length < 10 || updateDescription > 30) {
      addUpdateErrors.updateDescription = "Update Description must have between 100 and 300 characters.";
    }

    return addUpdateErrors;
  }

  handleAddUpdateToIpfs = async () => {
    let { view } = this.state;

    const response = await this.addUpdateToIpfs();

    if (true === response) {
      view.data.addUpdateForm.submitted = true;
    } else {
      view.data.addUpdateForm.validated = false;
      view.data.addUpdateForm.failed = true;
    }

    this.setState({ view });
  }

  addUpdateToIpfs = async () => {
    try {
      let { view } = this.state;

      const ipfsContent = ipfs.cat(view.data.project.fetched.ipfsHash);

      const decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);

      if (decodedIpfsContent) {
        const { accounts } = this.state;
        const { crowdFunding } = this.state.contracts;

        let updates = [];
        let update = {
          title: view.data.addUpdateForm.input.updateTitle,
          description: view.data.addUpdateForm.input.updateDescription,
        };

        if (decodedIpfsContent.updates) {
          updates = decodedIpfsContent.updates;
        }

        updates.push(update);
        decodedIpfsContent.updates = updates;

        const buffer = [Buffer.from(JSON.stringify(decodedIpfsContent))];
        const ipfsHash = await ipfs.add(buffer);

        const response = await crowdFunding.methods.setIpfsHash(
          view.data.project.fetched.id, ipfsHash.cid.toString()
        ).send({ from: accounts[0] });

        const ipfsContent = ipfs.cat(ipfsHash.cid.toString());
        const _decodedIpfsContent = await this.decodeIpfsContent(ipfsContent);
        
        view.data.project.fetched.updates = updates;
        this.setState({ view });
        view.data.updates.generated = this.generateUpdatesView();
        this.setState({ view });
      }
    } catch (err) {
      console.error("Err @ addUpdateToIpfs():", err.message);
      return false;
    }

    return true;
  }

  setAddUpdateField(_field, _value) {
    let { view } = this.state;

    if (view.data.addUpdateForm.fieldEnumeration.E_TITLE_FIELD === _field) {
      view.data.addUpdateForm.input.updateTitle = _value;

      if (!!view.data.addUpdateForm.errors.updateTitle) {
        view.data.addUpdateForm.errors.updateTitle = null;
      }
    } else if (view.data.addUpdateForm.fieldEnumeration.E_DESCRIPTION_FIELD === _field) {
      view.data.addUpdateForm.input.updateDescription = _value;

      if (!!view.data.addUpdateForm.errors.updateDescription) {
        view.data.addUpdateForm.errors.updateDescription = null;
      }
    }

    this.setState({ view });
  }

  resetAddUpdateForm() {
    let { view } = this.state;

    view.data.addUpdateForm.validated = false;
    view.data.addUpdateForm.submitted = false;
    view.data.addUpdateForm.failed = false;
    view.data.addUpdateForm.input.updateTitle = null;
    view.data.addUpdateForm.input.updateDescription = null;
    view.data.addUpdateForm.errors.updateTitle = null;
    view.data.addUpdateForm.errors.updateDescription = null;

    this.setState({ view });
  }

  generateUpdatesView() {
    let updatesView = null;

    const { project } = this.state.view.data;

    if (project.fetched.updates && project.fetched.updates.length > 0) {
      let updates = [];

      for (let it = 0; it < project.fetched.updates.length; it++) {
        const update =
          <Card>
            <Accordion.Toggle as={ Card.Header } eventKey={ it + 1 }>
              #{ it + 1 } Update: { project.fetched.updates[it].title }
            </Accordion.Toggle>

            <Accordion.Collapse eventKey={ it + 1 }>
              <Card.Body>{ project.fetched.updates[it].description }</Card.Body>
            </Accordion.Collapse>
          </Card>
        ;
        updates.push(update);
      }

      if (updates.length > 0) {
        updatesView =
          <Row className="justify-content-md-center">
            <Accordion style={{ width: "60%" }}>{ updates }</Accordion>
          </Row>;
      }
    }

    return updatesView;
  }

  close = async () => {
    try {
      const { accounts, contracts } = this.state;
      let { view } = this.state;

      await contracts.crowdFunding.methods.close(
        view.data.project.fetched.id
      ).send({ from: accounts[0] });

      

      view.data.project.fetched.isOpen = false;
      this.setState({ view });
    } catch (err) {
      console.error("Err @ close():", err.message);
    }
  }

  resetForFundersView() {
    let { view } = this.state;

    view.data.form.input.depositAmount = 0;
    view.data.form.errors.depositAmount = null;
    view.data.form.validated = false;
    view.data.form.submitted = false;
    view.data.form.failed = false;

    this.setState({ view });
  }

  setFormView(_formView) {
    let { view } = this.state;

    if (view.data.form.viewEnumeration.E_DEPOSIT_VIEW === _formView) {
      if (false === view.data.form.view.deposit) {
        view.data.form.view.deposit = true;
        view.data.form.view.withdraw = false;
        this.setState({ view });
      }
    } else if (view.data.form.viewEnumeration.E_WITHDRAW_VIEW === _formView) {
      if (false === view.data.form.view.withdraw) {
        view.data.form.view.deposit = false;
        view.data.form.view.withdraw = true;
        this.setState({ view });
      }
    }
  }

  setView(_view) {
    let { view } = this.state;

    if (_view === view.enumeration.E_CAMPAIGN_VIEW) {
      view.active.campaign = true;
      view.active.forFunders = false;
      view.active.updates = false;
      view.active.addUpdate = false;
      view.active.edit = false;
    } else if (_view === view.enumeration.E_FOR_FUNDERS_VIEW) {
      view.active.campaign = false;
      view.active.forFunders = true;
      view.active.updates = false;
      view.active.addUpdate = false;
      view.active.edit = false;
    } else if (_view === view.enumeration.E_UPDATES_VIEW) {
      view.active.campaign = false;
      view.active.forFunders = false;
      view.active.updates = true;
      view.active.addUpdate = false;
      view.active.edit = false;
    } else if (_view === view.enumeration.E_ADD_UPDATE_VIEW) {
      view.active.campaign = false;
      view.active.forFunders = false;
      view.active.updates = false;
      view.active.addUpdate = true;
      view.active.edit = false;
    } else if (_view === view.enumeration.E_EDIT_VIEW) {
      view.active.campaign = false;
      view.active.forFunders = false;
      view.active.updates = false;
      view.active.addUpdate = false;
      view.active.edit = true;
    }

    this.setState({ view });
  }

  render() {
    const { web3, accounts, contracts, token, userAccount, view } = this.state;

    return (
      <Container fluid="md auto" className="ViewProject" style={{ width: "100%", height: "80%" }}>
        <Card border="light" className="text-center" style={{ width: "100%", height: "100%" }}>
          <Card.Body className="mt-3 mb-3" style={{ width: "100%", height: "100%" }}>
            {
              //if
              (false === view.loaded) ?
                <>
                  <Card.Title className="display-6 mb-5">
                    Loading Project...
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
                  (null !== view.data.project.fetched) ?
                    <>
                      <Card.Title className="display-6 mb-3">
                        { view.data.project.fetched.name }
                      </Card.Title>

                      <Card.Text className="text-muted mb-3">
                        Created by { view.data.project.fetched.owner }
                      </Card.Text>

                      <Card.Text className="text-muted mb-3">
                        {
                          //if
                          (true === view.data.project.fetched.isOpen) ?
                            <>Funding Ongoing</>
                          //else
                          :
                            <>Funding Finished</>
                          //endif
                        }
                      </Card.Text>

                      <Row className="justify-content-md-center mb-3">
                        <Col>
                          <Card.Text className="text-muted">
                            Funding Goal: { view.data.project.fetched.goal / token.decimals } { token.symbol }
                          </Card.Text>
                        </Col>
                        <Col>
                          <Card.Text className="text-muted">
                            Raised Capital: { view.data.project.fetched.balance / token.decimals } { token.symbol }
                          </Card.Text>
                        </Col>
                        <Col>
                          <Card.Text className="text-muted">
                            { view.data.project.fetched.funders } Funders
                          </Card.Text>
                        </Col>
                      </Row>

                      {
                        //if
                        (view.data.project.fetched.funderBalance / token.decimals > 0) ?
                          <Card.Text className="text-muted mb-3">
                            You Funded { view.data.project.fetched.name } With { view.data.project.fetched.funderBalance / token.decimals } { token.symbol }.
                          </Card.Text>
                        //else
                        : <></>
                        //endif
                      }

                      <ButtonGroup className="mb-5" style={{ width: "50%" }}>
                        <Button
                          type="submit"
                          onClick={ () => this.setView(view.enumeration.E_CAMPAIGN_VIEW) }
                          active={ view.active.campaign }
                          variant="outline-secondary"
                          className="fw-bold"
                          style={{ width: "20%" }}
                        >
                          Campaign
                        </Button>

                        <Button
                          type="submit"
                          onClick={ () => this.setView(view.enumeration.E_FOR_FUNDERS_VIEW) }
                          active={ view.active.forFunders }
                          variant="outline-secondary"
                          className="fw-bold"
                          style={{ width: "20%" }}
                        >
                          For Funders
                        </Button>

                        <Button
                          type="submit"
                          onClick={ () => this.setView(view.enumeration.E_UPDATES_VIEW) }
                          active={ view.active.updates }
                          variant="outline-secondary"
                          className="fw-bold"
                          style={{ width: "20%" }}
                        >
                          Updates
                        </Button>

                        {
                          //if
                          (true === userAccount.isOwner) ?
                            <>
                            <Button
                              type="submit"
                              onClick={ () => this.setView(view.enumeration.E_ADD_UPDATE_VIEW) }
                              active={ view.active.addUpdate }
                              variant="outline-secondary"
                              className="fw-bold"
                              style={{ width: "20%" }}
                            >
                              Add Update
                            </Button>

                            <Button
                              type="submit"
                              variant="outline-secondary"
                              className="fw-bold"
                              style={{ width: "20%" }}
                              disabled={
                                !userAccount.isOwner ||
                                !view.data.project.fetched.isOpen ||
                                view.data.project.fetched.balance < view.data.project.fetched.goal
                              }
                              onClick={ this.close }
                            >
                              Close Project
                            </Button>

                            {/* <Button
                              type="submit"
                              onClick={ () => this.setView(view.enumeration.E_EDIT_VIEW) }
                              active={ view.active.edit }
                              variant="outline-secondary"
                              className="fw-bold"
                              style={{ width: "20%" }}
                            >
                              Close Project
                            </Button> */}
                            </>
                          //else
                          : <></>
                          //endif
                        }
                      </ButtonGroup>

                      {
                        //if
                        (true === view.active.campaign) ?
                          <Row className="justify-content-md-center">
                            <Image
                              src={ view.data.project.fetched.imageUrl }
                              fluid
                              className="mb-3"
                              style={{ width: "30%" }}
                            />
                            
                            <Card.Text>
                              { view.data.project.fetched.description }
                            </Card.Text>
                          </Row>
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.forFunders) ?
                          //if
                          (false === view.data.form.submitted) ?
                            <>
                              <Row className="justify-content-md-center">
                                {
                                  //if
                                  (true === view.data.form.failed) ?
                                    <Card.Text className="lead mb-3" style={{ color: "red" }}>
                                      Transaction Failed OR Was Rejected!
                                    </Card.Text>
                                  //else
                                  : <></>
                                  //endif
                                }

                                <Form
                                  validated={ view.data.form.validated }
                                  onSubmit={ this.handleSubmit }
                                  style={{ width: "80%" }}
                                >
                                  <Form.Group as={ Row } className="mb-3" controlId="formAccountAddress">
                                    <Form.Label column sm="4">Account Address</Form.Label>

                                    <Col sm="6">
                                      <Form.Control plaintext readOnly defaultValue={ accounts[0] }/>
                                    </Col>
                                  </Form.Group>

                                  <Form.Group as={ Row } className="mb-3" controlId="formAccountBalance">
                                    <Form.Label column sm="4">Account { token.symbol } Balance</Form.Label>

                                    <Col sm="6">
                                      <Form.Control plaintext readOnly defaultValue={ token.accountBalance / token.decimals }/>
                                    </Col>
                                  </Form.Group>

                                  <Form.Group as={ Row } className="mb-5" controlId="formAmount">
                                    <Form.Label column sm="4">
                                      {
                                        //if
                                        (true === view.data.form.view.deposit) ?
                                          <>Funding Amount</>
                                        //else
                                        : <>Withdraw Amount</>
                                        //endif
                                      }
                                    </Form.Label>

                                    <Col sm="6">
                                      <InputGroup>
                                        <FormControl
                                          required
                                          type="number"
                                          placeholder={ `Enter ${ token.symbol } Amount` }
                                          value={
                                            //if
                                            (true === view.data.form.view.deposit) ?
                                              view.data.form.input.depositAmount
                                            //else
                                            : view.data.form.input.withdrawAmount
                                            //endif
                                          }
                                          min="0"
                                          onChange={
                                            //if
                                            (true === view.data.form.view.deposit) ?
                                              this.changeDepositAmount
                                            //else
                                            : this.changeWithdrawAmount
                                            //endif
                                          }
                                          isInvalid={
                                            //if
                                            (true === view.data.form.view.deposit) ?
                                              !!view.data.form.errors.depositAmount
                                            //else
                                            : !!view.data.form.errors.withdrawAmount
                                            //endif
                                          }
                                        />

                                        <InputGroup.Text>{ token.symbol }</InputGroup.Text>

                                        {
                                          //if
                                          (false === view.data.form.validated) ?
                                            <Form.Control.Feedback type="invalid">
                                              {
                                                //if
                                                (true === view.data.form.view.deposit) ?
                                                  view.data.form.errors.depositAmount
                                                //else
                                                : view.data.form.errors.withdrawAmount
                                                //endif
                                              }
                                            </Form.Control.Feedback>
                                          //else
                                          : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                          //endif
                                        }
                                      </InputGroup>
                                    </Col>
                                  </Form.Group>

                                  {
                                    //if
                                    (true === view.data.form.validated) ?
                                      <Spinner animation="border" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                      </Spinner>
                                    //else
                                    :
                                      <Button
                                        type="submit"
                                        variant="outline-secondary"
                                        disabled={
                                          !userAccount.isLoggedIn ||
                                          !view.data.project.fetched.isOpen ||
                                          (userAccount.balance / token.decimals < 1)
                                        }
                                      >
                                        {
                                          //if
                                          (true === view.data.form.view.deposit) ?
                                            <>Fund { view.data.project.fetched.name }</>
                                          //else
                                          :
                                            <>Withdraw Funds</>
                                          //endif
                                        }
                                      </Button>
                                    //endif
                                  }
                                </Form>
                              </Row>

                              {
                                //if
                                (
                                  (view.data.project.fetched.funderBalance / token.decimals > 0) &&
                                  (false === view.data.form.validated)
                                ) ?
                                  <Row className="justify-content-md-center">
                                    <Button
                                      variant="link"
                                      className="mt-3"
                                      style={{ width: "25%", color: "black" }}
                                      onClick={
                                        //if
                                        (true === view.data.form.view.deposit) ?
                                          () => this.setFormView(view.data.form.viewEnumeration.E_WITHDRAW_VIEW)
                                        //else
                                        :
                                          () => this.setFormView(view.data.form.viewEnumeration.E_DEPOSIT_VIEW)
                                        //endif
                                      }
                                    >
                                      {
                                        //if
                                        (true === view.data.form.view.deposit) ?
                                          <>Click Here To Withdraw Funds.</>
                                        //else
                                        :
                                          <>Click Here To Fund { view.data.project.fetched.name }.</>
                                        //endif
                                      }
                                    </Button>
                                  </Row>
                                //else
                                : <></>
                                //endif
                              }
                            </>
                            //else
                            :
                              <>
                                <Card.Text className="lead">
                                  Thank You For Supporting { view.data.project.fetched.name }!
                                </Card.Text>

                                <Card.Text className="text-muted">
                                  {
                                    //if
                                    (true === view.data.form.view.deposit) ?
                                      <>
                                        You Successfuly Funded { view.data.form.input.depositAmount } { token.symbol }.
                                      </>
                                    //else
                                    :
                                      <>
                                        { view.data.form.input.withdrawAmount } { token.symbol } Fallback Into Your Account.
                                      </>
                                    //endif
                                  }
                                </Card.Text>

                                <Button onClick={ this.resetForFundersView } variant="outline-secondary" className="mt-3">
                                  Go Back
                                </Button>
                              </>
                            //endif
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.addUpdate) ?
                          //if
                          (false === view.data.addUpdateForm.submitted) ?
                            <Row className="justify-content-md-center">
                              {
                                //if
                                (true === view.data.addUpdateForm.failed) ?
                                  <Card.Text className="lead mb-3" style={{ color: "red" }}>
                                    Transaction Failed OR Was Rejected!
                                  </Card.Text>
                                //else
                                : <></>
                                //endif
                              }

                              <Form
                                validated={ view.data.addUpdateForm.validated }
                                onSubmit={ this.handleAddUpdate }
                                style={{ width: "80%" }}
                              >
                                <Form.Group as={ Row } className="mb-3" controlId="formUpdateTitle">
                                  <Form.Label column sm="4">Title</Form.Label>

                                  <Col sm="6">
                                    <Form.Control
                                      required
                                      type="text"
                                      placeholder="Update Title"
                                      onChange={
                                        e => this.setAddUpdateField(
                                          view.data.addUpdateForm.fieldEnumeration.E_TITLE_FIELD,
                                          e.target.value
                                        )
                                      }
                                      isInvalid={ !!view.data.addUpdateForm.errors.updateTitle }
                                    />

                                    {
                                      //if
                                      (false === view.data.addUpdateForm.validated) ?
                                        <Form.Control.Feedback type="invalid">
                                          { view.data.addUpdateForm.errors.updateTitle }
                                        </Form.Control.Feedback>
                                      //else
                                      : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                      //endif
                                    }
                                  </Col>

                                  
                                </Form.Group>

                                <Form.Group as={ Row } className="mb-3" controlId="formUpdateDescription">
                                  <Form.Label column sm="4">Description</Form.Label>

                                  <Col sm="6">
                                    <Form.Control
                                      required
                                      as="textarea"
                                      placeholder="Update Description"
                                      onChange={
                                        e => this.setAddUpdateField(
                                          view.data.addUpdateForm.fieldEnumeration.E_DESCRIPTION_FIELD,
                                          e.target.value
                                        )
                                      }
                                      isInvalid={ !!view.data.addUpdateForm.errors.updateDescription }
                                    />

                                    {
                                      //if
                                      (false === view.data.addUpdateForm.validated) ?
                                        <Form.Control.Feedback type="invalid">
                                          { view.data.addUpdateForm.errors.updateDescription }
                                        </Form.Control.Feedback>
                                      //else
                                      : <Form.Control.Feedback>Looks good!</Form.Control.Feedback>
                                      //endif
                                    }
                                  </Col>
                                </Form.Group>

                                {
                                  //if
                                  (true === view.data.addUpdateForm.validated) ?
                                    <Spinner animation="border" role="status" className="mt-3">
                                      <span className="visually-hidden">Loading...</span>
                                    </Spinner>
                                  //else
                                  :
                                    <Button variant="secondary" type="submit" className="mt-3">
                                      Add Update
                                    </Button>
                                  //endif
                                }
                              </Form>
                            </Row>
                          //else
                          :
                            <>
                              <Card.Text className="lead">
                                Update { view.data.addUpdateForm.input.updateTitle } Successfully Added To { view.data.project.fetched.name }!
                              </Card.Text>

                              <Button onClick={ this.resetAddUpdateForm } variant="outline-secondary" className="mt-3">
                                Go Back
                              </Button>
                            </>
                          //endif
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.updates) ?
                          //if
                          (null !== view.data.updates.generated) ?
                            view.data.updates.generated
                          //else
                          : <></>
                          //endif
                        //else
                        : <></>
                        //endif
                      }

                      {
                        //if
                        (true === view.active.edit) ?
                          <>
                            <Row className="text-center justify-content-md-center">
                              <Button
                                  type="submit"
                                  variant="outline-secondary"
                                  disabled={
                                    !userAccount.isOwner ||
                                    view.data.project.fetched.balance < view.data.project.fetched.goal
                                  }
                                  onClick={ this.close }
                                  style={
                                    (view.data.project.fetched.balance < view.data.project.fetched.goal) ?
                                      { width: "25%" }
                                    :
                                      { width: "10%" }
                                  }
                                >
                                  {
                                    //if
                                    (view.data.project.fetched.balance < view.data.project.fetched.goal) ?
                                    //else
                                      <>
                                        Requires {
                                          (view.data.project.fetched.goal / token.decimals) -
                                          (view.data.project.fetched.balance / token.decimals)
                                        } More { token.symbol } For Closing
                                      </>
                                    : <>Close Project</>
                                    //endif
                                  }
                                </Button>
                            </Row>
                          </>
                        //else
                        : <></>
                        //endif
                      }
                    </>
                  //else
                  :
                    <Row className="justify-content-md-center mt-5">
                      <Alert variant="light" style={{ width: "50%" }}>
                        <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
                        <p className="lead">Project not loaded...</p>

                        <hr />

                        <p className="mb-0">
                          Invalid project ID / Failed to load project from Blockchain.
                        </p>
                      </Alert>
                    </Row>
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
      </Container>
    );
  }
}

export default withRouter(ViewProject);
