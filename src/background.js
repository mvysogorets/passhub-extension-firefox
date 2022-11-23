import axios from "axios";
import * as passhubCrypto from "./crypto";
import WsConnection from "./wsConnection";
import {getApiURL, getWsURL, setHostname, getHostname, consoleLog} from './utils';

let state = "login";
let theSafes = [];
let csrfToken = '';
let popupConnected = false;
let popupConnectionPort;
let wsConnection = null;


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
  let currentServer = {passhubHost:"passhub.net"};

  browser.storage.local.get("passhubHost")
  .then(data => {
    consoleLog("bg get storage");
    consoleLog(data);
    if(!data || !data.passhubHost ||(data.passhubHost == '')) {
      currentServer = {passhubHost:"passhub.net"};
    } else {
      currentServer = data;
    }
    setHostname(currentServer.passhubHost);
    if(wsConnection) {
      consoleLog('wsConnection');
      consoleLog(wsConnection);
      wsConnection.close();
      wsConnection = null;
    }
    state = "login";
  })

  .catch(err =>{
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
  if(popupConnected) {
    popupConnectionPort.postMessage(m);
  }
} 

browser.runtime.onConnect.addListener(port =>  {
  popupConnectionPort = port;

  popupConnectionPort.onDisconnect.addListener(port =>  {
    consoleLog('background: popup disconnected');
    consoleLog(port);
    popupConnected = false;
    if(state === "create account") {
      state="login";
    }
  });
  
  consoleLog('bg got connection with');
  consoleLog(popupConnectionPort);

  popupConnected = true;
  popupConnectionPort.onMessage.addListener(function(message,sender){
    consoleLog('bg received');
    consoleLog(message);

    if(message.id === "loginCallback") {
      state = "signing in..";
      popupConnectionPort.postMessage({id: state});
      axios.get(`${getApiURL()}loginSPA.php${message.urlQuery}`, {})
      .then( reply => {
        consoleLog(reply);
        const result = reply.data;

        if (result.status == "not found") {
          state = "create account";
          popupConnectionPort.postMessage({id: state});
          return;
        }

        if (result.status == "Ok") {
          consoleLog("csrf token:", reply.headers["x-csrf-token"]);
          setCsrfToken(reply.headers["x-csrf-token"]);
          state = "getting data..";
          popupConnectionPort.postMessage({id: state});
          if(wsConnection) {
            wsConnecttion.close();
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
    if(message.id === "advise request") {
      const url = new URL(message.url);
      let hostname = url.hostname.toLowerCase();
      if (hostname.substring(0, 4) === "www.") {
        hostname = hostname.substring(4);
      }
      if(hostname.length === 0) {
        hostname = url.pathname;
      }
      if(state === "signed") {
        let foundRecords = advise(message.url);
        if(foundRecords.length > 0) {
          consoleLog('bg advise:')
          consoleLog(foundRecords);
        } else {
          consoleLog('bg advise: nothing found')
        }
        popupConnectionPort.postMessage({id: 'advise', found: foundRecords, url: hostname,  serverName: getHostname()});
        return;
      }
    }

    if(message.id === "payment page") {
      if(state === "signed") {
        const cards=paymentCards();
        consoleLog(cards);
        popupConnectionPort.postMessage({id: 'payment', found: cards,  serverName: getHostname()});
        return;
      }
    }


    if(message.id === "logout") {
      wsConnection.close();

      consoleLog('logout received');
      state = "logout_request";
      consoleLog('state ' + state);
      try {
       popupConnectionPort.postMessage({id: state});
      } catch(err) {
        consoleLog('catch 144')
      }
      axios.get(`${getApiURL()}logoutSPA.php`, {})
      .then((reply) => {
        consoleLog(reply);
        // consoleLog("csrf token:", reply.headers["x-csrf-token"]);
        //setCsrfToken(reply.headers["x-csrf-token"]);
        const result = reply.data;
        if (result.status == "Ok") {
          state="login";
          try {
            popupConnectionPort.postMessage({id: state});
          } catch(err) {
            // do nothing
          }
          return;
        }
      });
    }
/*
    if(message.id === "openPasshubWindow") {
      browser.tabs.create({url:'./frontend/index.html'});
      return;
    }
*/
  });
  popupConnectionPort.postMessage({id: state, urlBase: getApiURL(), serverName: getHostname()})
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

function downloadUserData()  {
  axios
  .post(`${getApiURL()}get_user_datar.php`, {
    verifier: getVerifier(),
  })
  .then((result) => {
    if (result.data.status === "Ok") {
      state = "decrypting..";
      popupConnectionPort.postMessage({id: state});

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
          state = "signed";
          consoleLog("state = signed");
          popupConnectionPort.postMessage({id: state});
          wsConnection.connect();
        });
      })
    }
  });
}

const refreshUserData = ({ safes = []} = {}) => {
  consoleLog(safes);
  const self = this;
  axios
    .post(`${getApiURL()}get_user_datar.php`, {
      verifier: getVerifier(),
    })
    .then((response) => {
      const result = response.data;
      if (result.status === "Ok") {
        const data = result.data;
        // const safes = data.safes;
        return decryptSafes(data.safes).then(() => {
          data.safes.sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
          normalizeSafes(data.safes);
          theSafes = data.safes;
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
  
        if(item.version === 5 && item.cleartext[0] === "card") {
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


function advise(url) {

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

        for(const item of items) {

          try {
            if(item.version === 5 && item.cleartext[0] === "card") {
              continue;
            }

            let itemUrl = item.cleartext[3].toLowerCase().trim();
            if(itemUrl.length === 0) {
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
            if (itemHost == hostname) {
              result.push({
                safe: safe.name,
                title: item.cleartext[0],
                username: item.cleartext[1],
                password: item.cleartext[2],
              });
            }
          } catch (err) {
            consoleLog('catch 392');
            // consoleLog(err); 
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
