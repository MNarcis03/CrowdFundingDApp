import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Header from "../Header/Header";
import Footer from "../Footer/Footer";
import Home from "../Home/Home";
import StartProject from "./../StartProject/StartProject";
import DiscoverProjects from "./../DiscoverProjects/DiscoverProjects";
import Crowdsale from "../Crowdsale/Crowdsale";
import Login from "../Login/Login";
import Register from "../Register/Register";
import Logout from "../Logout/Logout";

import "./App.css";

function App() {
  return (
    <div className="App">
      <Switch>
        <Route exact path="/">
          <Redirect to="/home" />
        </Route>

        <Route exact path="/home">
          <Header />
          <Home />
        </Route>

        <Route exact path="/startProject">
          <Header />
          <StartProject />
        </Route>

        <Route exact path="/discoverProjects">
          <Header />
          <DiscoverProjects />
        </Route>

        <Route exact path="/crowdsale">
          <Header />
          <Crowdsale />
        </Route>

        <Route exact path="/login">
          <Header />
          <Login />
        </Route>

        <Route exact path="/register">
          <Header />
          <Register />
        </Route>

        <Route exact path="/logout">
          <Logout />
        </Route>
      </Switch>

      <Footer />
    </div>
  );
}

export default App;
