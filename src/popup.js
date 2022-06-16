import * as WWPass from 'wwpass-frontend';

const passhubPageUrl = 'https://trial.passhub.net/';

const consoleLog = console.log;
// const consoleLog = () => {};

function activatePassHubTab() {
  //const manifest = chrome.runtime.getManifest();
  // const urlList = manifest.externally_connectable.matches;

  // chrome.tabs.query({url: ['https://passhub.net/*', 'http://localhost:8080/*:'] }, function(passHubTabs) {
  browser.tabs.query({ url: [`${passhubPageUrl}*`] })
  .then( passHubTabs => {
    for (const tab of passHubTabs) {
      if (tab.url.includes('doc')) {
        continue;
      }
      browser.tabs.update(tab.id, { active: true });
      window.close();
      return;
    }
    window.open(`${passhubPageUrl}`, 'target="_blank"');
    window.close();
  })
  .catch(err => {
    console.log('tabs query error');
    console.log(err);
  });
}

function activatePassHubDocTab() {
  browser.tabs.query({ url: 'https://passhub.net/doc/browser-extension/' }, function (tabs) {
    for (let tab of tabs) {
        browser.tabs.update(tab.id, { active: true });
        return;
    }
    window.open('https://passhub.net/doc/browser-extension/');
  });
}

for(let e of document.querySelectorAll('.help-link')) {
  e.onclick = activatePassHubDocTab;
}


document.querySelector('.close-popup').onclick = function () {
  window.close();
};

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


let tabId;

const queryInfo = {
  active: true,
  currentWindow: true,
};


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



/*
function contentScriptCb(result) {
  const lastErr = browser.runtime.lastError;
  if (lastErr) {
    consoleLog(' lastError: ' + JSON.stringify(lastErr));
  }
}



browser.tabs.query(queryInfo)
  .then(
    tabs => {
      const tab = tabs[0];
      tabId = tab.id;
      
    }
  )
  .catch(
    e => consoleLog("tabs query error " + e)
  );




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
  }
  return;
}



function openPasshubWindow() {
  bgConnectionPort.postMessage( { id: 'openPasshubWindow'});
}
 document.querySelector(".help").onclick  = openPasshubWindow;

function loginCallback1(urlQuery) {
  
  consoleLog("loginCallback urlQuery");
  consoleLog(urlQuery);

  browser.runtime.sendMessage( { id: 'loginCallback', urlQuery})
  .then( reply => {
    consoleLog("loginCallback reply");
    consoleLog(reply);
  })
}



*/
