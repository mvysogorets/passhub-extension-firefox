import * as WWPass from 'wwpass-frontend';

const consoleLog = console.log;
// const consoleLog = () => {};

function activatePassHubTab() {
  //const manifest = chrome.runtime.getManifest();
  // const urlList = manifest.externally_connectable.matches;

  // chrome.tabs.query({url: ['https://passhub.net/*', 'http://localhost:8080/*:'] }, function(passHubTabs) {
  browser.tabs.query({ url: ['https://trial.passhub.net/*'] })
  .then( passHubTabs => {
    for (const tab of passHubTabs) {
      if (tab.url.includes('doc')) {
        continue;
      }
      browser.tabs.update(tab.id, { active: true });
      window.close();
      return;
    }
    window.open('https://trial.passhub.net/', 'target="_blank"');
    window.close();
  })
  .catch(err => {
    console.log('tabs query error');
    console.log(err);
  });
}


document.querySelector('.close-popup').onclick = function () {
  window.close();
};

document.querySelector('.help-link').onclick = function (){
  window.open('https://passhub.net/doc/browser-extension','passhub_doc');
}

document.querySelector('.logout-div').onclick = function (){
  bgConnectionPort.postMessage( { id: 'logout'});
  window.close();
}

document.querySelector('.open-passhub-tab').onclick = function (){
  activatePassHubTab();

}

document.querySelector('.contact-us').onclick = function (){
  window.open('https://passhub.net/feedback19.php','passhub_contact_us');
}

let bgConnectionPort = browser.runtime.connect({name:"popup"});

function loginCallback(urlQuery) {
  bgConnectionPort.postMessage( { id: 'loginCallback', urlQuery});
}

bgConnectionPort.onMessage.addListener( m => {
  console.log("popup received message from background script: ");
  console.log(m);
  console.log("***");
  console.log("m.id " + m.id);


  if(m.id === "login") {
    document.querySelector(".login-page").style.display = "block";
    document.querySelector(".logout-div").style.display = "none";
    document.querySelector(".lower-tab").style.justifyContent = "center";
    const ticketURL = `${m.urlBase}getticket.php`;

    WWPass.authInit({
      qrcode: document.querySelector('#qrcode'),
      //passkey: document.querySelector('#button--login'),
      ticketURL,
      callbackURL: loginCallback,
    });
    return;            
  }
  if(m.id === "signed") {
    document.querySelector(".login-page").style.display = "none";
    document.querySelector(".logout-div").style.display = "block";
    document.querySelector(".lower-tab").style.justifyContent = "space-between";
    const queryInfo = {
      active: true,
      currentWindow: true,
    };
    browser.tabs.query(queryInfo)
    .then(tabs => {
      console.log("tabs");
      console.log(tabs);
      const tab = tabs[0];
      tabId = tab.id;
      bgConnectionPort.postMessage({id: "advise request", url: tab.url, tabId: tab.id});
    })
    .catch( err => {
      console.log(err)
    });
  }

  if(m.id === "advise") {
    renderAccounts(m);
    return;
  }

  if((m.id === "signing in..") || (m.id === "getting data..") || (m.id === "decrypting..")) {
    console.log('yy ' + m.id);
    document.querySelector(".login-page").style.display = "none";
    document.querySelector("#wait-message").innerText = m.id;
    document.querySelector("#wait").style.display = "block";
    return;
  }
});


function openPasshubWindow() {
  bgConnectionPort.postMessage( { id: 'openPasshubWindow'});
}

document.querySelector(".help").onclick  = openPasshubWindow;

function activatePassHubDocTab() {
  const manifest = browser.runtime.getManifest();
  const urlList = manifest.externally_connectable.matches;

  // browser.tabs.query({url: ['https://passhub.net/*', 'http://localhost:8080/*:'] }, function(passHubTabs) {
  browser.tabs.query({ url: urlList }, function (tabs) {
    for (tab of tabs) {
      if (tab.url.includes('/doc/browser-extension')) {
        browser.tabs.update(tab.id, { active: true });
        return;
      }
    }
    window.open('https://passhub.net/doc/browser-extension', 'passhub_doc');
  });
}



function contentScriptCb(result) {
  const lastErr = browser.runtime.lastError;
  if (lastErr) {
    consoleLog(' lastError: ' + JSON.stringify(lastErr));
  }
}

let tabId;

const queryInfo = {
  active: true,
  currentWindow: true,
};

/*
function advItemClick(e) {
  consoleLog(this);
  consoleLog('----');
  consoleLog(e);
  consoleLog('----');
  const row = parseInt(this.getAttribute('data-row'));
  consoleLog(row);

  browser.tabs.query(queryInfo)
  .then(tabs => {
    tabId = tabs[0].id;
    browser.tabs.sendMessage(
      tabs[0].id,
      {
        greeting: 'loginRequest',
        username: found[row].username,
        password: found[row].password,
      })
    .then(response => {
        if (browser.runtime.lastError) {
          consoleLog('SendMessage rintime.error');
          consoleLog(browser.runtime.lastError);
        }

        if (response == undefined) {
          browser.tabs.executeScript(
            tabId,
            {
              code: `loginRequestJson = ${JSON.stringify(found[row])}`,
            })
          .then(() => {
              browser.tabs.executeScript(
                tabId,
                { file: 'contentScript.js' },
                contentScriptCb
              );
            }
          );
        } else {
          consoleLog(response.farewell);
          window.close();
        }
      }
    );
  });
}


browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  consoleLog(request);
  if (request.id == 'advise') {
    if (request.found.length) {
      const p = document.querySelector('#advice');
      found = request.found;
      for (let i = 0; i < request.found.length; i++) {
        const d = document.createElement('div');
        d.setAttribute('data-row', `${i}`);
        d.setAttribute('class', 'found-entry');
        d.onclick = advItemClick;

        const titleDiv = document.createElement('div');
        titleDiv.setAttribute('class', 'found-title');
        titleDiv.innerText = request.found[i].title;
        d.appendChild(titleDiv);

        const safeDiv = document.createElement('div');
        safeDiv.setAttribute('class', 'found-safe');
        safeDiv.innerText = request.found[i].safe;
        d.appendChild(safeDiv);

        p.appendChild(d);
      }
      p.style.display = 'block';
    } else {
      const notFound = document.getElementById('not-found');
      notFound.style.display = 'block';
      const notFoundHostName = document.getElementById('not-found-hostname');
      notFoundHostName.innerText = request.hostname;

      // p.innerHTML = `<p style='margin:30px 0'>No suitable accounts found for <br>${request.hostname}</p>`;
    }
  }
  return true;
});
 */


function loginCallback1(urlQuery) {
  
  consoleLog("loginCallback urlQuery");
  consoleLog(urlQuery);

  browser.runtime.sendMessage( { id: 'loginCallback', urlQuery})
  .then( reply => {
    consoleLog("loginCallback reply");
    consoleLog(reply);
  })
}


function advItemClick(e) {
  consoleLog(this);
  consoleLog('----');
  consoleLog(e);
  consoleLog('----');
  const row = parseInt(this.getAttribute('data-row'));
  consoleLog(row);

  browser.tabs.query(queryInfo)
  .then( tabs => {
    tabId = tabs[0].id;
    browser.tabs.sendMessage(
      tabs[0].id,
      {
        greeting: 'loginRequest',
        username: found[row].username,
        password: found[row].password,
      })
      .then (response => {
        consoleLog(response.farewell);
        window.close();
      })
      .catch (e => {
        browser.tabs.executeScript(
          tabId,
          {
            code: `loginRequestJson = ${JSON.stringify(found[row])}`,
          }
        )
        .then( () => {
            browser.tabs.executeScript(
              tabId,
              { file: 'contentScript.js' },
            )
            .then(result => {
              const lastErr = browser.runtime.lastError;
              if (lastErr) {
                consoleLog(' lastError: ' + JSON.stringify(lastErr));
              }
            });
          }
        );
      });
  });
}

browser.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    consoleLog("popup got message");
    consoleLog(request);
  });


let found = [];

function renderAccounts(m) {

  document.querySelector("#wait").style.display = "none";
  document.querySelector(".login-page").style.display = "none";

  found = m.found;
  if(found.length === 0) {
    const notFound = document.getElementById('not-found');
    notFound.style.display = 'block';
    const notFoundHostName = document.getElementById('not-found-hostname');
    notFoundHostName.innerText = m.url;
    return;
  }

  const p = document.querySelector('#advise');
  
  for (let i = 0; i < found.length; i++) {
    const d = document.createElement('div');
    d.setAttribute('data-row', `${i}`);
    d.setAttribute('class', 'found-entry');
    d.onclick = advItemClick;

    const titleDiv = document.createElement('div');
    titleDiv.setAttribute('class', 'found-title');
    titleDiv.innerText = found[i].title;
    d.appendChild(titleDiv);

    const safeDiv = document.createElement('div');
    safeDiv.setAttribute('class', 'found-safe');
    safeDiv.innerText = found[i].safe;
    d.appendChild(safeDiv);

    p.appendChild(d);
  }
  p.style.display = 'block';
}

function backgroundReply(reply) {
  consoleLog("popup got reply")
  consoleLog(reply);
  if(reply.id === "login") {
    document.querySelector(".login-page").style.display = "block";
    document.querySelector(".logout-div").style.display = "none";
    document.querySelector(".lower-tab").style.justifyContent = "center";

    const ticketURL = `${reply.urlBase}getticket.php`;

    WWPass.authInit({
      qrcode: document.querySelector('#qrcode'),
      //passkey: document.querySelector('#button--login'),
      ticketURL,
      callbackURL: loginCallback,
    });
    return;            
  } 
  if(reply.id === "authenticating") {
    document.querySelector(".login-page").style.display = "none";
    document.querySelector("#wait").style.display = "block";
    return;
  }
  
  if(reply.id === "advise") {
    found = reply.advise;
    renderAccounts(found);

    /*

    if(found.length === 0) {
      const notFound = document.getElementById('not-found');
      notFound.style.display = 'block';
      const notFoundHostName = document.getElementById('not-found-hostname');
      notFoundHostName.innerText = reply.url;
      return;
    }

    const p = document.querySelector('#advise');
    
    for (let i = 0; i < found.length; i++) {
      const d = document.createElement('div');
      d.setAttribute('data-row', `${i}`);
      d.setAttribute('class', 'found-entry');
      d.onclick = advItemClick;

      const titleDiv = document.createElement('div');
      titleDiv.setAttribute('class', 'found-title');
      titleDiv.innerText = found[i].title;
      d.appendChild(titleDiv);

      const safeDiv = document.createElement('div');
      safeDiv.setAttribute('class', 'found-safe');
      safeDiv.innerText = found[i].safe;
      d.appendChild(safeDiv);

      p.appendChild(d);
    }
    p.style.display = 'block';
    */
  }
  return;
}


browser.tabs.query(queryInfo)
  .then(
    tabs => {
      const tab = tabs[0];
      tabId = tab.id;
      
      // bgConnectionPort.postMessage({id: "popup connected", url: tab.url, tabId: tab.id});
/*
      browser.runtime.sendMessage( { id: 'popup shown', url: tab.url, tabId: tab.id })
      .then(reply => backgroundReply(reply))
      .catch( // handleError 
        e => consoleLog("Send PopUp shown message: error " + e)
      );
      */
    }
  )
  .catch(
    e => consoleLog("tabs query error " + e)
  );


/*
      /*
          reply => {
          consoleLog("popup got reply")
          consoleLog(reply);
          if(reply.id === "login") {
            document.querySelector(".login-page").style.display = "block";
            const ticketURL = `${reply.urlBase}getticket.php`;

            WWPass.authInit({
              qrcode: document.querySelector('#qrcode'),
              //passkey: document.querySelector('#button--login'),
              ticketURL,
              callbackURL: loginCallback,
            });
            return;            
          } 
          if(reply.id === "advise") {
            found = reply.advise;

            if(found.length === 0) {
              const notFound = document.getElementById('not-found');
              notFound.style.display = 'block';
              const notFoundHostName = document.getElementById('not-found-hostname');
              notFoundHostName.innerText = reply.url;
              return;
            }

            const p = document.querySelector('#advise');
            
            for (let i = 0; i < found.length; i++) {
              const d = document.createElement('div');
              d.setAttribute('data-row', `${i}`);
              d.setAttribute('class', 'found-entry');
              d.onclick = advItemClick;

              const titleDiv = document.createElement('div');
              titleDiv.setAttribute('class', 'found-title');
              titleDiv.innerText = found[i].title;
              d.appendChild(titleDiv);

              const safeDiv = document.createElement('div');
              safeDiv.setAttribute('class', 'found-safe');
              safeDiv.innerText = found[i].safe;
              d.appendChild(safeDiv);

              p.appendChild(d);
            }
            p.style.display = 'block';
          }
          return;
          */


/*
          const p = document.querySelector('#status-text');
          if (reply.response == 'not connected') {
            const signIn = document.getElementById('sign-in');
            signIn.style.display = 'block';
            document.querySelector('#passhub-link').onclick = activatePassHubTab;
          } else if (reply.response == 'Hi popup') {
            p.innerHTML = 'Connected';
          }
*/          



  /*
  tabs => {
  const tab = tabs[0];
  tabId = tab.id;

  consoleLog("popup " + tab.url);
  browser.runtime.sendMessage( { id: 'popup shown', url: tab.url, tabId: tab.id })
  .then(
      (reply => {
      consoleLog(reply);
      const p = document.querySelector('#status-text');
      if (reply.response == 'not connected') {
        const signIn = document.getElementById('sign-in');
        signIn.style.display = 'block';
        document.querySelector('#passhub-link').onclick = activatePassHubTab;
      } else if (reply.response == 'Hi popup') {
        p.innerHTML = 'Connected';
      }
    }))
  .catch( // handleError 
    e => {consoleLog("Send PopUp shown message: error " + e)}
  );
});
*/


/*
const getSubtle = () => {
  const crypto = window.crypto || window.msCrypto;
  return crypto ? (crypto.webkitSubtle || crypto.subtle) : null;
};

const subtle = getSubtle();
console.log("popup subtle ", subtle);

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
  console.log("Popup Keypair generated")
  
});

bkg_log('popup hello');

*/