import axios from "axios";
import * as passhubCrypto from "./crypto";
import WsConnection from "./wsConnection";


const consoleLog = console.log;
// const consoleLog = () => {};

console.log("background started");


let state = "login";
let theSafes = [];
let csrfToken = '';

let apiUrl="https://ext.passhub.net/";
let wsUrl="wss://ext.passhub.net/wsapp/";

function getApiUrl() {
  return apiUrl;
}

function getWsUrl() {
  return wsUrl;
}

const wsMessageInd = (message) => {
  try {
    const pMessage = JSON.parse(message);
    if (Array.isArray(pMessage)) {
      console.log("Safes total: " + pMessage.length);
      refreshUserData({ broadcast: false });
    }
  } catch (err) {
    console.log("catch 322" + err);
  }
}

const wsConnection = new WsConnection(getWsUrl(), wsMessageInd);

function setCsrfToken(t) {
  csrfToken = t;
  window.localStorage.setItem('csrf', t);
  consoleLog('csrfToken');
  consoleLog(csrfToken);
}

function getVerifier() {
    return csrfToken;
}

let popupConnected = false;
let popupConnectionPort;

function notifyPopup(m) {
  if(popupConnected) {
    popupConnectionPort.postMessage(m);
  }
} 

browser.runtime.onConnect.addListener(port =>  {
  popupConnectionPort = port;
  popupConnectionPort.onDisconnect.addListener(port =>  {
    console.log('background: popup disconnected');
    console.log(port);
    popupConnected = false;
  });
  
  console.log('bg got connection');
  console.log(popupConnectionPort);

  popupConnected = true;
  popupConnectionPort.onMessage.addListener(function(message,sender){
    console.log('received');
    console.log(message);
    if(message.id === "logout") {
      console.log('!!!!!!');

    }

    if(message.id === "loginCallback") {
      state = "signing in..";
      popupConnectionPort.postMessage({id: state});
      axios.get(`${getApiUrl()}loginSPA.php${message.urlQuery}`, {})
      .then( reply => {
        console.log(reply);
        console.log("csrf token:", reply.headers["x-csrf-token"]);
        setCsrfToken(reply.headers["x-csrf-token"]);
        const result = reply.data;
        if (result.status == "Ok") {
          state = "getting data..";
          popupConnectionPort.postMessage({id: state});
          downloadUserData();
        }
      })
      .catch(err => {
        console.log(err);
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
        console.log(advise(message.url));
        popupConnectionPort.postMessage({id: 'advise', found: advise(message.url), url: hostname});
        return;
      }
    }
    if(message.id === "logout") {
      wsConnection.close();

      console.log('logout received');
      state = "logout_request";
      console.log('state ' + state);
      try {
       popupConnectionPort.postMessage({id: state});
      } catch(err) {
        console.log('catch 144')
      }
      axios.get(`${getApiUrl()}logoutSPA.php`, {})
      .then((reply) => {
        console.log(reply);
        // console.log("csrf token:", reply.headers["x-csrf-token"]);
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
  popupConnectionPort.postMessage({id: state, urlBase: getApiUrl()})
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
  .post(`${getApiUrl()}get_user_datar.php`, {
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
          wsConnection.connect()
        });
      })
    }
  });
}

const refreshUserData = ({ safes = []} = {}) => {
  console.log(safes);
  const self = this;
  axios
    .post(`${getApiUrl()}get_user_datar.php`, {
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
        return;
      }
      /*
      if (result.data.status === "login") {
        window.location.href = "expired.php";
        return;
      }
      */
    })
    .catch((error) => {
      console.log(error);
    });
};




function advise(url) {
  const u = new URL(url);
  let hostname = u.hostname.toLowerCase();
  if (hostname.substring(0, 4) === "www.") {
    hostname = hostname.substring(4);
  }
  const result = [];
  if (hostname) {
    for (let s = 0; s < theSafes.length; s += 1) {
      const safe = theSafes[s];
      if (safe.key) {
        // key!= null => confirmed, better have a class
        const items = safe.rawItems;
        for (let i = 0; i < items.length; i += 1) {
          try {
            let itemUrl = items[i].cleartext[3].toLowerCase();
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
                title: items[i].cleartext[0],
                username: items[i].cleartext[1],
                password: items[i].cleartext[2],
              });
            }
          } catch (err) {}
        }
      }
    }
  }
  return result;
};


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
        sendResponse({id: state, urlBase: getApiUrl()});
        return;
      } else if(state === "signed") {
        console.log(advise(request.url));
        sendResponse({id: 'advise', advise: advise(request.url), url: hostname});
        return;
      }
      return;
    }
    if(request.id === "loginCallback") {
      state = "authenticating";
      sendResponse({id: state});
      axios.get(`${getApiUrl()}loginSPA.php${request.urlQuery}`)
      .then((reply) => {
        console.log(reply);
        // console.log("csrf token:", reply.headers["x-csrf-token"]);
        setCsrfToken(reply.headers["x-csrf-token"]);
        const result = reply.data;
        if (result.status == "Ok") {
          downloadUserData();
        }
      });
    }
  }
)




/*
const createWebSocket = () => {
  const self = this;

  const wsURL = getWsUrl();
  console.log(wsURL);

  try {
    webSocket = new WebSocket(wsURL);
  } catch(err) {
    console.log('catch 263');
  }
  console.log(webSocket);
  console.log(new Date());

  // Connection opened
  webSocket.addEventListener("open", function (event) {
    webSocket.send("Hello Server!");
  });

  webSocket.addEventListener("error", function (event) {
    console.log("websocket error");
  });

  webSocket.addEventListener("close", function (event) {
    console.log("Bye websocket Server!");
    console.log(webSocket);
    console.log(new Date());
  });

  webSocket.addEventListener("message", function (event) {
    console.log("Message from server ", event.data);
    const message = event.data.toString();
    console.log("sMessage from server ", message);
    if (message === "pong") {
      return;
    }
    try {
      const pMessage = JSON.parse(message);
      if (Array.isArray(pMessage)) {
        console.log("Safes total: " + pMessage.length);
        refreshUserData({ broadcast: false });
      }
    } catch (err) {
      console.log("catch 322" + err);
    }
  });

  // Chrome, no heart-beat: 1 min timeout
  webSocketInterval = setInterval(() => {
    if (webSocket) {
      webSocket.send("ping");
    }
  }, 15000);
};

*/