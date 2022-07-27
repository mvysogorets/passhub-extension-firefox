import * as WWPass from 'wwpass-frontend';
import {getServerURL, consoleLog} from './utils';


let paymentStatus = "not a payment page";

browser.tabs.query({ active: true, currentWindow: true, })
.then( tabs => {
  if(!tabs[0].url.startsWith('https://')) {
    consoleLog('not https page ' + tabs[0].url);
    backgroundConnect();
    return;
  } 
  consoleLog(tabs[0]);

  browser.tabs.sendMessage(tabs[0].id, {id:'payment status'})
  .then (response => {
    consoleLog('xxx');
    if((response.payment == "payment page")||("not a payment page")) {
      consoleLog(response);
      paymentStatus = response.payment;
      backgroundConnect(); 
      return;
    }
  })
  .catch (e => {
    browser.tabs.executeScript(tabs[0].id, { file: 'contentScript.js' })
    .then(() => {
      consoleLog('executeScript started');
    })
    .catch(err => {  // not a normal page
      consoleLog('executeScript err');
      consoleLog(err);
      backgroundConnect();
      return;
    })
  })
})
.catch(err =>{
  consoleLog('Err');
  consoleLog(err);
}) 

browser.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    consoleLog('popup');
    consoleLog(request);
    consoleLog(sender);
    if((request.payment == "payment page")||("not a payment page")) {
      paymentStatus = request.payment;
      backgroundConnect(); 
    }
  });


let bgConnectionPort;
let tabId;

function loginCallback(urlQuery) {
  bgConnectionPort.postMessage( { id: 'loginCallback', urlQuery});
}

function backgroundConnect() {
  consoleLog("connecting with bg");
  bgConnectionPort = browser.runtime.connect({name:"popup"});



  bgConnectionPort.onMessage.addListener( m => {
    consoleLog(`popup received message from background script, id ${m.id}`);
    consoleLog(m);
  
  
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
  
    if(m.id == "create account") {
      document.querySelector(".login-page").style.display = "none";
      document.querySelector("#wait").style.display = "none";
      document.querySelector(".lower-tab").style.display = "none";
      document.querySelector(".create-account").style.display = "block";
      return;
    }
  
    if(m.id === "signed") {
      document.querySelector(".login-page").style.display = "none";
      document.querySelector(".logout-div").style.display = "block";
      document.querySelector(".lower-tab").style.justifyContent = "space-between";

       browser.tabs.query({active: true, currentWindow: true})
      .then(tabs => {
        consoleLog("tabs");
        consoleLog(tabs);
        const tab = tabs[0];
        if(paymentStatus == "payment page") {
          bgConnectionPort.postMessage({id: "payment page", url: tab.url, tabId: tab.id});
        }  else {
          bgConnectionPort.postMessage({id: "advise request", url: tab.url, tabId: tab.id});
        }
      })
      .catch( err => {
        consoleLog(err)
      });
    }
  
    if((m.id === "advise")||(m.id === "payment")) {
      renderAccounts(m);
      return;
    }
 
    if((m.id === "signing in..") || (m.id === "getting data..") || (m.id === "decrypting..")) {
      consoleLog('yy ' + m.id);
      document.querySelector(".login-page").style.display = "none";
      document.querySelector("#wait-message").innerText = m.id;
      document.querySelector("#wait").style.display = "block";
      return;
    }
  });

}

let found = [];

function renderAccounts(m) {


  document.querySelector("#wait").style.display = "none";
  document.querySelector(".login-page").style.display = "none";

  found = m.found;

  consoleLog('renderAccount found: ' + m.found.length);

  if(found.length === 0) {
    const notFound = document.getElementById('not-found');
    notFound.style.display = 'block';
    if(m.id === "payment") {
      document.getElementById("not-found-password").style.display  = "none";
      document.getElementById("no-card-records").style.display  = "block";
    } else {
      document.getElementById("not-found-password").style.display  = "block";
      document.getElementById("no-card-records").style.display  = "none";
      const notFoundHostName = document.getElementById('not-found-hostname');
      notFoundHostName.innerText = m.url;
    }
    return;
  }

  const p = document.querySelector('#advise');
  consoleLog('renderAccount in advise');
  try {
    for (let i = 0; i < found.length; i++) {
      consoleLog('rendering ' + i +1);
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
  
  } catch (e) {
    consoleLog('catch 193');
    consoleLog(e);
  }
  p.style.display = 'block';
  consoleLog('renderAccount advise rendered');
}


function advItemClick(e) {
  consoleLog(this);
  consoleLog('----');
  consoleLog(e);
  consoleLog('----');
  const row = parseInt(this.getAttribute('data-row'));
  consoleLog(row);

  browser.tabs.query({active: true, currentWindow: true})
  .then( tabs => {
    tabId = tabs[0].id;
    if(paymentStatus == "payment page") {
      browser.tabs.sendMessage(
        tabs[0].id,
        {
          id: 'card',
          card: found[row]. card,
        })
        .then (response => {
          consoleLog(response.farewell);
          window.close();
        })
        .catch(err => {
          consoleLog('catched 216');
          consoleLog(err);
        })
      return;
    }

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




function activatePassHubTab() {
  //const manifest = chrome.runtime.getManifest();
  // const urlList = manifest.externally_connectable.matches;

  // chrome.tabs.query({url: ['https://passhub.net/*', 'http://localhost:8080/*:'] }, function(passHubTabs) {
    browser.tabs.query({ url: `${getServerURL()}*`, currentWindow: true })
  .then( tabs => {

    for(const tab of tabs ) {
      if (tab.url.includes('doc')) {
        continue;
      }
      browser.tabs.update(tab.id, { active: true });
      window.close();
      return;
    }
    window.open(getServerURL(), 'target="_blank"');
    window.close();
  })
  .catch(err => {
    consoleLog('tabs query error');
    consoleLog(err);
  });
}

function activatePassHubDocTab() {
  browser.tabs.query({ url: 'https://passhub.net/doc/browser-extension#firefox', currentWindow: true }, function (tabs) {
    for (let tab of tabs) {
        browser.tabs.update(tab.id, { active: true });
        return;
    }
    window.open('https://passhub.net/doc/browser-extension#firefox');
  });
}

for(let e of document.querySelectorAll('.help-link')) {
  e.onclick = activatePassHubDocTab;
}

document.querySelector('.close-popup').onclick = () => window.close();

document.querySelector('.logout-div').onclick = function (){
  bgConnectionPort.postMessage( { id: 'logout'});
  window.close();
}

for (const e of document.querySelectorAll('.open-passhub-tab')) {
  e.onclick = activatePassHubTab;
}

document.querySelector('.contact-us').onclick = function (){
  window.open('https://passhub.net/feedback19.php','passhub_contact_us');
}

