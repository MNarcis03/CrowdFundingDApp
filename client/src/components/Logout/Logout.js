import React, { Component } from "react";
import { Redirect } from "react-router-dom";
import session from "./../../utils/session";

class Logout extends Component {
  constructor(props) {
    super(props);

    this.state = {
      session: session
    };
  }

  render() {
    const { session } = this.state;

    session.endSession();

    return (
      <Redirect to="/" />
    );
  }
}

export default Logout;
