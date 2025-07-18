import axios from "axios";
import * as passhubCrypto from "./crypto";
import WsConnection from "./wsConnection";
import { getTOTP2 } from "./totp";

import { getApiURL, getWsURL, setHostname, getHostname, consoleLog } from './utils';

let state = "login";
let theSafes = [];
let csrfToken = '';
let popupConnected = false;
let popupConnectionPort;
let wsConnection = null;

const IDLE_TIMEOUT = 60 * 60 * 8;
let activityTimestamp = 0;
let activityTimer = null;


function stopActivityTimer() {
  if (activityTimer) {
    clearTimeout(activityTimer)
    activityTimer = null;
  }
}

function startActivityTimer() {
  stopActivityTimer()
  activityTimer = setTimeout(logout, IDLE_TIMEOUT * 1000)
}

consoleLog("background started");

const wsMessageInd = (message) => {
  try {
    const pMessage = JSON.parse(message);
    if (Array.isArray(pMessage)) {
      consoleLog("Safes total: " + pMessage.length);
      refreshUserData({ broadcast: false });
    }
  } catch (err) {
    consoleLog("catch 322" + err);
  }
}

function initServerUrl() {
  consoleLog('initServerURL');
  let currentServer = { passhubHost: "passhub.net" };

  browser.storage.local.get("passhubHost")
    .then(data => {
      consoleLog("bg get storage");
      consoleLog(data);
      if (!data || !data.passhubHost || (data.passhubHost == '')) {
        currentServer = { passhubHost: "passhub.net" };
      } else {
        currentServer = data;
      }
      setHostname(currentServer.passhubHost);
      if (wsConnection) {
        consoleLog('wsConnection');
        consoleLog(wsConnection);
        wsConnection.close();
        wsConnection = null;
      }
      state = "login";
    })

    .catch(err => {
      consoleLog('catch 19');
      consoleLog(err);
      setHostname("passhub.net");
    });
}

initServerUrl();

function logStorageChange(changes, area) {
  consoleLog(`Change in storage area: ${area}`);

  const changedItems = Object.keys(changes);

  for (const item of changedItems) {
    consoleLog(`${item} has changed:`);
    consoleLog("Old value: ", changes[item].oldValue);
    consoleLog("New value: ", changes[item].newValue);
  }
  state = "login";
  initServerUrl()
  // setHistname(changes['passhubHost'].newValue);
}

browser.storage.onChanged.addListener(logStorageChange)


function setCsrfToken(t) {
  csrfToken = t;
  //window.localStorage.setItem('csrf', t);
  consoleLog('csrfToken');
  consoleLog(csrfToken);
}

function getVerifier() {
  return csrfToken;
}

function notifyPopup(m) {
  if (popupConnected) {
    popupConnectionPort.postMessage(m);
  }
}

function logout() {
  stopActivityTimer()
  wsConnection.close();

  consoleLog('logout received');
  state = "logout_request";
  consoleLog('state ' + state);
  /*  
    try {
      popupConnectionPort.postMessage({ id: state });
    } catch (err) {
      consoleLog('catch 144')
    }
  */
  axios.get(`${getApiURL()}logoutSPA.php`, {})
    .then((reply) => {
      consoleLog(reply);
      // consoleLog("csrf token:", reply.headers["x-csrf-token"]);
      //setCsrfToken(reply.headers["x-csrf-token"]);
      const result = reply.data;
      if (result.status == "Ok") {
        state = "login";
        try {
          //          popupConnectionPort.postMessage({ id: state });
          popupConnectionPort.postMessage({ id: state, urlBase: getApiURL(), serverName: getHostname() })

        } catch (err) {
          // do nothing
        }
        return;
      }
    });
}

browser.runtime.onConnect.addListener(port => {
  popupConnectionPort = port;

  popupConnectionPort.onDisconnect.addListener(port => {
    consoleLog('background: popup disconnected');
    consoleLog(port);
    popupConnected = false;
    if (state === "create account") {
      state = "login";
    }
  });

  consoleLog('bg got connection with');
  consoleLog(popupConnectionPort);



  popupConnected = true;

  if (state === "signed") {
    let timeNow = Date.now();
    if (((timeNow - activityTimestamp) / 1000) > IDLE_TIMEOUT) {
      logout();
      return;
    }
  }

  popupConnectionPort.onMessage.addListener(function (message, sender) {
    consoleLog('bg received');
    consoleLog(message);

    if (message.id === "loginCallback") {
      state = "signing in..";
      popupConnectionPort.postMessage({ id: state });
      axios.get(`${getApiURL()}loginSPA.php${message.urlQuery}`, {})
        .then(reply => {
          consoleLog(reply);
          const result = reply.data;

          if (result.status == "not found") {
            state = "create account";
            popupConnectionPort.postMessage({ id: state });
            return;
          }

          if (result.status == "Ok") {
            consoleLog("csrf token:", reply.headers["x-csrf-token"]);
            setCsrfToken(reply.headers["x-csrf-token"]);
            state = "getting data..";
            popupConnectionPort.postMessage({ id: state });
            if (wsConnection) {
              wsConnection.close();
              wsConnection = null;
            }
            wsConnection = new WsConnection(getWsURL(), wsMessageInd);

            downloadUserData();
          }
        })
        .catch(err => {
          consoleLog(err);
        });
      return;
    }
    if (message.id === "advise request") {
      const url = new URL(message.url);
      let hostname = url.hostname.toLowerCase();
      if (hostname.substring(0, 4) === "www.") {
        hostname = hostname.substring(4);
      }
      if (hostname.length === 0) {
        hostname = url.pathname;
      }
      if (state === "signed") {
        let timeNow = Date.now();
        if (((timeNow - activityTimestamp) / 1000) > IDLE_TIMEOUT) {
          logout();
          return;
        }
        activityTimestamp = Date.now();

        startActivityTimer()


        /*
                let foundRecords = await advise(message.url);
                if (foundRecords.length > 0) {
                  consoleLog('bg advise:')
                  consoleLog(foundRecords);
                } else {
                  consoleLog('bg advise: nothing found')
                }
                popupConnectionPort.postMessage({ id: 'advise', found: foundRecords, hostname, serverName: getHostname() });
                return;
        */
        advise(message.url)
          .then(foundRecords => {
            if (foundRecords.length > 0) {
              consoleLog('bg advise:')
              consoleLog(foundRecords);
            } else {
              consoleLog('bg advise: nothing found')
            }
            popupConnectionPort.postMessage({ id: 'advise', found: foundRecords, hostname, serverName: getHostname() });
            return;
          })
        return;
      }
    }

    if (message.id === "payment page") {
      if (state === "signed") {

        let timeNow = Date.now();
        if (((timeNow - activityTimestamp) / 1000) > IDLE_TIMEOUT) {
          logout();
          return;
        }
        activityTimestamp = Date.now();
        startActivityTimer()

        const cards = paymentCards();
        consoleLog(cards);
        popupConnectionPort.postMessage({ id: 'payment', found: cards, serverName: getHostname() });
        return;
      }
    }

    if (message.id === "refresh") {
      refreshUserData();
      return;
    }

    if (message.id === "logout") {
      logout();
      return;
    }
    /*
        if(message.id === "openPasshubWindow") {
          browser.tabs.create({url:'./frontend/index.html'});
          return;
        }
    */
  });
  popupConnectionPort.postMessage({ id: state, urlBase: getApiURL(), serverName: getHostname() })
});


function normalizeFolder(folder, items, folders) {
  folder.contentModificationDate = folder.lastModified
    ? folder.lastModified
    : "-";
  folder.name = folder.cleartext[0];
  folder.id = folder._id;
  folder.path = [...folder.path, folder.cleartext[0]];

  folder.items = [];
  for (const item of items) {
    if (item.folder === folder.id) {
      folder.items.push(item);
      item.path = folder.path;
      if (
        item.lastModified &&
        item.lastModified > folder.contentModificationDate
      ) {
        folder.contentModificationDate = item.lastModified;
      }
    }
  }
  folder.items.sort((a, b) =>
    a.cleartext[0].toLowerCase().localeCompare(b.cleartext[0].toLowerCase())
  );

  folder.folders = [];
  for (const f of folders) {
    if (f.parent === folder.id) {
      folder.folders.push(f);
      f.path = folder.path;
      f.safe = folder.safe;
      normalizeFolder(f, items, folders);
      if (
        f.contentModificationDate &&
        f.contentModificationDate > folder.contentModificationDate
      ) {
        folder.contentModificationDate = f.contentModificationDate;
      }
    }
  }
  folder.folders.sort((a, b) =>
    a.cleartext[0].toLowerCase().localeCompare(b.cleartext[0].toLowerCase())
  );
}

function normalizeSafes(safes) {
  for (const safe of safes) {
    safe.rawItems = safe.items;
    safe.path = [safe.name];
    safe.items = [];
    for (const item of safe.rawItems) {
      if (!item.folder || item.folder == "0") {
        safe.items.push(item);
        item.path = [safe.name];
      }
    }
    safe.items.sort((a, b) =>
      a.cleartext[0].toLowerCase().localeCompare(b.cleartext[0].toLowerCase())
    );

    safe.rawFolders = safe.folders;
    safe.folders = [];
    for (const folder of safe.rawFolders) {
      if (!folder.parent || folder.parent == "0") {
        safe.folders.push(folder);
        folder.path = [safe.name];
        folder.safe = safe;
        normalizeFolder(folder, safe.rawItems, safe.rawFolders);
      }
    }
    safe.folders.sort((a, b) =>
      a.cleartext[0].toLowerCase().localeCompare(b.cleartext[0].toLowerCase())
    );
  }
}

function decryptSafeData(safe, aesKey) {
  for (let i = 0; i < safe.items.length; i += 1) {
    safe.items[i].cleartext = passhubCrypto.decodeItem(safe.items[i], aesKey);
  }

  for (let i = 0; i < safe.folders.length; i += 1) {
    safe.folders[i].cleartext = passhubCrypto.decodeFolder(
      safe.folders[i],
      aesKey
    );
  }
}

function decryptSafes(eSafes) {
  const promises = [];
  for (let i = 0; i < eSafes.length; i++) {
    const safe = eSafes[i];
    if (safe.key) {
      promises.push(
        passhubCrypto.decryptAesKey(safe.key).then((bstringKey) => {
          safe.bstringKey = bstringKey;
          safe.name = passhubCrypto.decryptSafeName(safe, safe.bstringKey);
          return decryptSafeData(safe, safe.bstringKey);
        })
      );
    }
  }
  return Promise.all(promises);
}

function downloadUserData() {
  axios
    .post(`${getApiURL()}get_user_datar.php`, {
      verifier: getVerifier(),
    })
    .then((result) => {
      if (result.data.status === "Ok") {
        state = "decrypting..";
        popupConnectionPort.postMessage({ id: state });

        const data = result.data.data;
        passhubCrypto
          .getPrivateKey(data)
          .then(() => {
            const safes = data.safes;
            return decryptSafes(data.safes).then(() => {
              safes.sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
              );
              normalizeSafes(safes);
              theSafes = safes;
              activityTimestamp = Date.now();
              state = "signed";
              consoleLog("state = signed");
              if (('websocket' in data) && (data.websocket == true)) {
                wsConnection.connect();
              }

              popupConnectionPort.postMessage({ id: state })
              /*              
                              .catch(err => {
                                consoleLog("popup already closed, do not bother")
                                consoleLog(err)
                              });
              */
            });
          })
      }
    });
}

const refreshUserData = ({ safes = [] } = {}) => {
  consoleLog(safes);
  state = "getting data..";
  popupConnectionPort.postMessage({ id: state });

  const self = this;
  axios
    .post(`${getApiURL()}get_user_datar.php`, {
      verifier: getVerifier(),
    })
    .then((response) => {
      const result = response.data;
      if (result.status === "Ok") {
        state = "decrypting..";
        popupConnectionPort.postMessage({ id: state });

        const data = result.data;
        // const safes = data.safes;
        return decryptSafes(data.safes).then(() => {
          data.safes.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
          normalizeSafes(data.safes);
          theSafes = data.safes;
          state = "signed";
          consoleLog("state = signed");
          popupConnectionPort.postMessage({ id: state })

        });
      }
      /*
      if (result.data.status === "login") {
        window.location.href = "expired.php";
        return;
      }
      */
    })
    .catch((error) => {
      consoleLog(error);
    });
};


function paymentCards() {
  const result = [];
  for (let s = 0; s < theSafes.length; s += 1) {
    const safe = theSafes[s];
    if (safe.key) {
      // key!= null => confirmed, better have a class
      for (const item of safe.rawItems) {

        if (item.version === 5 && item.cleartext[0] === "card") {
          result.push({
            safe: safe.name,
            title: item.cleartext[1],
            card: item.cleartext
          })
        }
      }
    }
  }
  consoleLog('paymentCard returns');
  consoleLog(result);

  return result;
}


function hostInItem(hostname, item) {
  const urls = item.cleartext[3].split("\x01");

  for (let url of urls) {
    try {
      url = url.toLowerCase();
      if (url.substring(0, 4) != "http") {
        url = "https://" + url;
      }
      url = new URL(url);
      let itemHost = url.hostname.toLowerCase();
      if (itemHost.substring(0, 4) === "www.") {
        itemHost = itemHost.substring(4);
      }
      if (itemHost == hostname) {
        return true;
      }
    } catch (err) { }
  }
  return false
}

async function advise(url) {

  const u = new URL(url);
  let hostname = u.hostname.toLowerCase();
  if (hostname.substring(0, 4) === "www.") {
    hostname = hostname.substring(4);
  }
  const result = [];
  if (hostname) {
    for (const safe of theSafes) {
      if (safe.key) {
        // key!= null => confirmed, better have a class
        const items = safe.rawItems;

        for (const item of items) {
          if (hostInItem(hostname, item)) {
            try {
              if (item.version === 5 && item.cleartext[0] === "card") {
                continue;
              }
              /*
                            let itemUrl = item.cleartext[3].toLowerCase().trim();
                            if (itemUrl.length === 0) {
                              continue;
                            }
              
                            if (itemUrl.substring(0, 4) != "http") {
                              itemUrl = "https://" + itemUrl;
                            }
              
                            itemUrl = new URL(itemUrl);
                            let itemHost = itemUrl.hostname.toLowerCase();
                            if (itemHost.substring(0, 4) === "www.") {
                              itemHost = itemHost.substring(4);
                            }
                              */
              //              if (itemHost == hostname) {
              if ((item.cleartext.length > 5) && (item.cleartext[5].length > 0)) {
                const secret = item.cleartext[5];

                let [totp, totp_next] = await getTOTP2(secret)
                result.push({
                  safe: safe.name,
                  title: item.cleartext[0],
                  username: item.cleartext[1],
                  password: item.cleartext[2],
                  totp,
                  totp_next
                });
              } else {
                result.push({
                  safe: safe.name,
                  title: item.cleartext[0],
                  username: item.cleartext[1],
                  password: item.cleartext[2],
                })
                //                }
              }
            } catch (err) {
              consoleLog('catch 392');
              // consoleLog(err); 
            }
          }
        }
      }
    }
  }
  return result;
};



/* probably we do not need it

browser.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    consoleLog("background got message in state " + state);
    consoleLog(request);
    if(request.id === "popup shown") {
      const url = new URL(request.url);
      let hostname = url.hostname.toLowerCase();
      if (hostname.substring(0, 4) === "www.") {
        hostname = hostname.substring(4);
      }

      if((state === "login")) {
        sendResponse({id: state, urlBase: getApiURL()});
        return;
      } else if(state === "signed") {
        consoleLog(advise(request.url));
        sendResponse({id: 'advise', advise: advise(request.url), url: hostname});
        return;
      }
      return;
    }
    if(request.id === "loginCallback") {
      state = "authenticating";
      sendResponse({id: state});
      axios.get(`${getApiURL()}loginSPA.php${request.urlQuery}`)
      .then((reply) => {
        consoleLog(reply);
        // consoleLog("csrf token:", reply.headers["x-csrf-token"]);
        setCsrfToken(reply.headers["x-csrf-token"]);
        const result = reply.data;
        if (result.status == "Ok") {
          downloadUserData();
        }
      });
    }
  }
)

*/
