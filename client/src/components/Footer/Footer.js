import React from "react";
import './Footer.css';

function Footer() {
  return (
    <div className="footer-basic">
      <footer>
        <div className="social">
          <a href="https://www.facebook.com"><i className="icon ion-social-facebook"></i></a>
          <a href="https://www.instagram.com"><i className="icon ion-social-instagram"></i></a>
          <a href="https://www.twitter.com"><i className="icon ion-social-twitter"></i></a>
          <a href="https://www.youtube.com"><i className="icon ion-social-youtube"></i></a>
        </div>

        <ul className="list-inline">
          <li className="list-inline-item"><a href="home">Home</a></li>
          <li className="list-inline-item"><a href="contact">Contact</a></li>
          <li className="list-inline-item"><a href="about">About</a></li>
          <li className="list-inline-item"><a href="terms">Terms</a></li>
          <li className="list-inline-item"><a href="privacyPolicy">Privacy Policy</a></li>
        </ul>
        <p className="copyright">CrowdFundingDApp © { new Date().getFullYear() }</p>
      </footer>
    </div>
  );
}

export default Footer;

/* <!-- Credit to https://epicbootstrap.com/snippets/footer-with-columns --> */
