import * as WWPass from 'wwpass-frontend';
import {getHostname, consoleLog} from './utils';

let serverName = "passhub.net";

let paymentStatus = "not a payment page";

let activeTab = null;

let validFrames = []
let sameUrlFrames = [];
let paymentFrames = [];

let frameResponded = 0;
let paymentHost = null;

function validFramesRemove(frame) {
  validFrames = validFrames.filter(e => e !== frame);
  consoleLog(`Removed frfme from validFrames ${frame.url}`);
}

function gotPaymentStatus(tab, frame, response) {
  
  consoleLog(`gotPaymentStatus from frame ${frame.frameId}`);

  consoleLog(`frameResponded ${frameResponded + 1} out of ${validFrames.length}`);

  consoleLog(response);

  if(response.payment == "payment page") {
    paymentStatus = response.payment;
    paymentFrames.push(frame);
  }

  if(response.payment == "not valid frame") {
    validFramesRemove(frame);
  } else {
    frameResponded++;    
  }


  if(frameResponded == validFrames.length) {

    consoleLog('all frames responded');
    consoleLog('validFrames');
    consoleLog(validFrames);
    consoleLog('sameUrlFrames');
    consoleLog(sameUrlFrames);
    consoleLog('paymentFrames');
    consoleLog(paymentFrames);

    if(paymentFrames.length) {
      const paymentUrl = new URL(paymentFrames[0].url);
      paymentHost = paymentUrl.host;
      consoleLog(`paymentHost1 ${paymentHost}`)

      for(let payFrame of paymentFrames) {
        const url = new URL(payFrame.url);
        const host = url.host;
        if(host != paymentHost) {
          paymentHost = null;
          paymentStatus = "not a payment page";
          break;
        }
      }
      consoleLog(`paymentHost ${paymentHost}`)
    }
    backgroundConnect();
  }
}

function paymentPlatform() {
  if(paymentHost) {
    let mainURL = new URL(activeTab.url);
    let mHost = mainURL.host;

    let parts = mainURL.host.split('.');

    if(parts.length > 1) {
      mHost =  parts.slice(parts.length-2).join('.');
    }
    parts = paymentHost.split('.');

    let pHost = paymentHost;

    if(parts.length > 1) {
      pHost =  parts.slice(parts.length-2).join('.')
    }
    consoleLog(`paymentPlatform pHost ${pHost} mHost ${mHost}`)
    if(pHost != mHost) {
      consoleLog(`paymentPlatform returns ${paymentHost}`)

      return paymentHost;
    }
  }
  return null;
}

function notRegularPage(url)  {
  consoleLog('not a regular page');  

/* !!!!!!!!!!!!!!!!!!! */

  backgroundConnect();
/*  
  document.getElementById('not-a-regular-page').style.display='block';
  document.getElementById('not-a-regular-page-url').innerText = url;   
*/  
}

function installScript(tab, frame) {
  consoleLog(`installScript for frame ${frame.frameId} ${frame.url}`);

  browser.tabs.sendMessage(tab.id, {id:'payment status'}, {frameId: frame.frameId})
  .then( response => {

    consoleLog(`response from frame ${frame.frameId}`);
    consoleLog(response);

    gotPaymentStatus(tab, frame, response);
  })
  .catch( err =>{
    consoleLog(`catch69 frame: ${frame.frameId}`);
    consoleLog(err);
//    consoleLog(frame);

    browser.tabs.executeScript(
      tab.id,
        {file: 'contentScript.js', frameId: frame.frameId }
      )
      .then( injectionResult => {
        consoleLog('injectionResult');
        consoleLog(injectionResult);

        browser.tabs.sendMessage(tab.id,  {id:'payment status'}, {frameId: frame.frameId})
        .then( response =>  {
          consoleLog(`response from frame ${frame.frameId} after executeScript/sendMessage`);
          consoleLog(response);

          gotPaymentStatus(tab, frame, response);
        })
        .catch(err => {
          consoleLog(`catch70 frame: ${frame.frameId} ${frame.url}`);
          consoleLog(err);
          gotPaymentStatus(tab, frame, {payment: "not valid frame"});
        })
      })
      .catch( err => {
        consoleLog(`catch71 frame: ${frame.frameId} ${frame.url}`);
        consoleLog(err);

        if(frame.frameId == 0) {
          notRegularPage(activeTab.url);
        } 
        gotPaymentStatus(tab, frame, {payment: "not valid frame"});
      })
  })
}

browser.tabs.query({ active: true, currentWindow: true, })
.then(tabs => {
  activeTab = tabs[0];

  consoleLog('activeTab');  
  consoleLog(activeTab);
  
  let mainURL = new URL(activeTab.url);

  consoleLog('mainURL');
  consoleLog(mainURL);

  if((mainURL.host == "") || (mainURL.protocol != "https:")) {
    notRegularPage(activeTab.url);
    return;
  }

  browser.webNavigation.getAllFrames( {tabId: activeTab.id} )
  .then(frameList => {

    consoleLog(`frameList with ${frameList.length} frames`);

    for(let frame of frameList) {
      consoleLog(`${frame.frameId} ${frame.url}`)
      let frameURL = new URL(frame.url);

//      if((frameURL.host !== "") || (frameURL.protocol == "https:")) {
      if(true) {
        validFrames.push(frame);
        if(frameURL.host == mainURL.host) {
          sameUrlFrames.push(frame);
        }
      }
    }

    consoleLog('sameUrlFrames');
    consoleLog(sameUrlFrames);

    if(sameUrlFrames.length == 0) {
      notRegularPage(activeTab.url);
      return;
    }

    consoleLog('Sending message "payment status"');

    // for(let frame of sameUrlFrames) {
    for(let frame of validFrames) {
      installScript(activeTab, frame)
    }
  })
  .catch(err => {
    consoleLog('catch 105');
    consoleLog(err);

  })
});  


let bgConnectionPort;

//let tabId;

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

      document.querySelector("#server-name").innerText = m.serverName;
      document.querySelector("#logo").title=`Open page ${m.serverName}`;
      serverName = m.serverName; 


      document.querySelector("#wait").style.display = "none";

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

      if(m.serverName) {
        document.querySelector("#server-name").innerText = m.serverName;
        document.querySelector("#logo").title=`Open page ${m.serverName}`;
        serverName = m.serverName; 
      }

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

  if(paymentHost) {
    let platform = paymentPlatform();
    consoleLog(`platform ${platform}`)
    if(platform) {
      consoleLog(`platform1 ${platform}`);

      document.getElementById('paygate').style.display='block';
      document.getElementById('paygate-url').innerText=platform;



    }
  }

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
  consoleLog('adwItem this');
  consoleLog(this);
  consoleLog('----');
  consoleLog(e);
  consoleLog('----');
  const row = parseInt(this.getAttribute('data-row'));
  consoleLog(`clicked ${row} row`);

  browser.tabs.query({active: true, currentWindow: true})
  .then( tabs => {
    let tabId = tabs[0].id;
    if(paymentStatus == "payment page") {
      consoleLog(`paymentHost ${paymentHost}`)
      if(paymentHost) {
        consoleLog('paymentFrames');
        consoleLog(paymentFrames);

        for(let frame of paymentFrames ) {
          consoleLog('frame');
          consoleLog(frame);

          consoleLog(`sending card data to frameid ${frame.frameId}`)
          browser.tabs.sendMessage(
            tabs[0].id,
            {
              id: 'card',
              card: found[row]. card,
            },
            {frameId: frame.frameId})
            .then (response => {
              consoleLog('response');
              consoleLog(response);
              window.close();
            })
            .catch(err => {
              consoleLog('catched 216');
              consoleLog(err);
            })
        }
        return;
      }
    }

    browser.tabs.sendMessage(
      tabs[0].id,
      {
        id: 'loginRequest',
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

  browser.tabs.query({ url: `https://${getHostname()}/*`, currentWindow: true })
  .then( tabs => {

    for(const tab of tabs ) {
      if (tab.url.includes('doc')) {
        continue;
      }
      browser.tabs.update(tab.id, { active: true });
      window.close();
      return;
    }
    window.open(`https://${serverName}`, 'target="_blank"');
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






/*
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

*/
