class Session {
  constructor() {
    this.LOCAL_STORAGE_KEY = "CFD_$3$$10#";
    this.SESSION_TIMEOUT = 86400000;
  }

  startSession() {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, Date.now());
  }

  sessionExpired() {
    const sessionTime = localStorage.getItem(this.LOCAL_STORAGE_KEY);

    if (sessionTime) {
      const currentTime = Date.now();

      const expiredTime = currentTime - parseInt(sessionTime);

      if (expiredTime < this.SESSION_TIMEOUT) {
        return false;
      }
    }

    this.endSession();

    return true;
  }

  endSession() {
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
  }
}

const session = new Session();
Object.freeze(session);

export default session;
