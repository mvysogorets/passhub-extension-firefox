import axios from "axios";

import * as passhubCrypto from "./crypto";

const consoleLog = console.log;
// const consoleLog = () => {};

console.log("background started");


let state = "login";
let theSafes = [];
let csrfToken = '';

const urlBase = "https://trial.passhub.net/";
function getApiUrl() {
  return urlBase;
}

function setCsrfToken(t) {
  csrfToken = t;
  consoleLog('csrfToken');
  consoleLog(csrfToken);
}

function getVerifier() {
    return csrfToken;
}

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

/*          
          let activeFolder = getFolderById(data.safes, activeFolderID);
          if (activeFolder === null) {
            console.log("old activesafe not found");
            activeFolder = getFolderById(data.safes, data.currentSafe);
          }
          if (activeFolder === null) {
            console.log("recommended activesafe not found");
            activeFolder = safes[0];
          }
          console.log("setting new state with updated data");
*/
        });
      })
    }
  });
}

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
      axios.get(`${getApiUrl()}loginSPA.php${request.urlQuery}`, {})
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
let portFromCS;

const getSubtle = () => {
  const crypto = window.crypto || window.msCrypto;
  return crypto ? (crypto.webkitSubtle || crypto.subtle) : null;
};

const subtle = getSubtle();
console.log("background subtle ", subtle);
subtle.generateKey(
  {
  name: "RSA-OAEP",
  // Consider using a 4096-bit key for systems that require long-term security
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
  },
  true,
  ["encrypt", "decrypt"]
).then((keyPair) => {
    console.log("background Keypair generated")
  });

browser.runtime.getBackgroundPage().then( www => {
  console.log("Background page");

  console.log("www");
  console.log(www);
  console.log("www.document");
  console.log(www.document);
  const body=www.document.querySelector('body');
  const newDiv = www.document.createElement("div");
  console.log(newDiv);
  newDiv.innerHTML="Hello1";
  body.appendChild(newDiv);
  console.log(body);
  
});

function bkg_log(message) {
  console.log("Bkg log ", message);
}

browser.runtime.onConnect.addListener(port => {
  console.log("background connected");
  connected = true;
  portFromCS = port;
  portFromCS.postMessage({greeting: "hi there content script!"});
  portFromCS.onMessage.addListener( m => {
    console.log("In background script, received message from content script")
    console.log(m.greeting);
  });
});  
*/