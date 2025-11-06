import * as WWPass from 'wwpass-frontend';
import { consoleLog, windowClose } from './utils';

let serverName = "passhub.net";

let activeTab = null;

let frameResponded = 0;
let validFrames = [];
let sameUrlFrames = [];
let paymentFrames = [];

let paymentStatus = "not a payment page";
let paymentHost = null;
let foundRecords = [];

function initSearch() {
  activeTab = null;
  frameResponded = 0;
  validFrames = [];
  sameUrlFrames = [];
  paymentFrames = [];

  paymentStatus = "not a payment page";
  paymentHost = null;
  foundRecords = [];
}

let bgConnectionPort;

function validFramesRemove(frame) {
  validFrames = validFrames.filter(e => e !== frame);
  consoleLog(`Removed frame from validFrames ${frame.url}`);
}

function gotPaymentStatus(tab, frame, response) {

  consoleLog(`gotPaymentStatus from frame ${frame.frameId} ${frame.url}`);

  consoleLog(`frameResponded ${frameResponded + 1} out of ${validFrames.length}`);

  consoleLog(response);

  if (response.payment == "payment page") {
    paymentStatus = response.payment;
    paymentFrames.push(frame);
  }

  if (response.payment == "not valid frame") {
    validFramesRemove(frame);
  } else {
    frameResponded++;
  }

  if (frameResponded == validFrames.length) {

    consoleLog('all frames responded');
    consoleLog('validFrames');
    consoleLog(validFrames);
    consoleLog('paymentFrames');
    consoleLog(paymentFrames);

    let mainURL = new URL(activeTab.url);

    const mainDomains = mainURL.host.split('.').reverse();
    if (mainDomains[mainDomains.length - 1] == 'www') {
      mainDomains.pop();
    }

    for (let frame of validFrames) {

      const frameURL = new URL(frame.url);
      const frameDomains = frameURL.host.split('.').reverse();
      if (frameDomains[frameDomains.length - 1] == 'www') {
        frameDomains.pop();
      }

      const minLength = mainDomains.length < frameDomains.length ? mainDomains.length : frameDomains.length;
      const maxLength = mainDomains.length > frameDomains.length ? mainDomains.length : frameDomains.length;
      consoleLog(`frame ${frame.frameId} ${frame.url} urllength ${frameDomains.length}`);
      if (maxLength - minLength > 1) {
        consoleLog('not same length');
        break;
      }
      let same = true;
      for (let i = 0; i < minLength; i++) {
        if (frameDomains[i] != mainDomains[i]) {
          same = false;
          consoleLog('not sameUrl');
          break;
        }
      }
      if (same) {
        consoleLog('sameUrl');
        sameUrlFrames.push(frame);
      }
    }

    consoleLog('sameUrlFrames');
    consoleLog(sameUrlFrames);

    if (paymentFrames.length) {
      const paymentUrl = new URL(paymentFrames[0].url);
      paymentHost = paymentUrl.host;
      consoleLog(`paymentHost1 ${paymentHost}`)

      for (let payFrame of paymentFrames) {
        const url = new URL(payFrame.url);
        const host = url.host;
        if (host != paymentHost) {
          paymentHost = null;
          paymentStatus = "not a payment page";
          break;
        }
      }
      consoleLog(`paymentHost ${paymentHost}`)
    }

    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        consoleLog("tabs");
        consoleLog(tabs);
        const tab = tabs[0];
        if (paymentStatus == "payment page") {
          bgConnectionPort.postMessage({ id: "payment page", url: tab.url, tabId: tab.id });
        } else {
          bgConnectionPort.postMessage({ id: "advise request", url: tab.url, tabId: tab.id });
        }
      })
      .catch(err => {
        consoleLog(err)
      });
  }
}

// does not work for *.co.uk and a like. Probably of no use

function paymentPlatform() {
  if (paymentHost) {
    let mainURL = new URL(activeTab.url);
    let mHost = mainURL.host;

    let parts = mainURL.host.split('.');

    if (parts.length > 1) {
      mHost = parts.slice(parts.length - 2).join('.');
    }
    parts = paymentHost.split('.');

    let pHost = paymentHost;

    if (parts.length > 1) {
      pHost = parts.slice(parts.length - 2).join('.')
    }
    consoleLog(`paymentPlatform pHost ${pHost} mHost ${mHost}`)
    if (pHost != mHost) {
      consoleLog(`paymentPlatform returns ${paymentHost}`)

      return paymentHost;
    }
  }
  return null;
}

function notRegularPage(url) {
  // a page where injectScript fails
  // e.g. about:debugging#/runtime/this-firefox
  consoleLog('not a regular page');
  showPage('.not-a-regular-page');

  //  document.querySelector(".icons").style.display = "none";
  document.querySelector("#not-a-regular-page-url").innerText = url;
}

function installScript(tab, frame) {
  consoleLog(`installScript for frame ${frame.frameId} ${frame.url}`);

  browser.tabs.sendMessage(tab.id, { id: 'payment status' }, { frameId: frame.frameId })  // in case the script is already instatelled
    .then(response => {
      consoleLog(`response ${response.payment} from frame ${frame.frameId} ${frame.url}`);
      consoleLog(response);
      gotPaymentStatus(tab, frame, response);
    })
    .catch(err => {
      consoleLog(`catch69 frame: ${frame.frameId}`);
      consoleLog(err);

      browser.tabs.executeScript(
        tab.id,
        { file: 'contentScript.js', frameId: frame.frameId }
      )
        .then(injectionResult => {
          consoleLog('injectionResult');
          consoleLog(injectionResult);

          browser.tabs.sendMessage(tab.id, { id: 'payment status' }, { frameId: frame.frameId })
            .then(response => {
              consoleLog(`response from frame ${frame.frameId} after executeScript/sendMessage`);
              consoleLog(response);
              gotPaymentStatus(tab, frame, response);
            })
            .catch(err => {
              consoleLog(`catch70 frame: ${frame.frameId} ${frame.url}`);
              consoleLog(err);
              gotPaymentStatus(tab, frame, { payment: "not valid frame" });
            })
        })
        .catch(err => {
          consoleLog(`catch71 frame: ${frame.frameId} ${frame.url}`);
          consoleLog(err);
          if (frame.frameId == 0) {
            notRegularPage(activeTab.url);
          }
          gotPaymentStatus(tab, frame, { payment: "not valid frame" });
        })
    })
}

const dial =
  `<svg style="transform: rotate(90deg) scale(-1,1)" width="24" viewBox="0 0 200 200" version="1.1"
    xmlns="http://www.w3.org/2000/svg">
    <circle r="90" cx="100" cy="100" fill="transparent" stroke-width="20">
    </circle>
    <circle class="otp-dial" r="85" cx="100" cy="100" fill="transparent"  stroke-width="30";
        stroke-dashoffset="0"></circle>
</svg>`

function setOtpDial(val) {
  const circles = document.querySelectorAll('svg .otp-dial');

  if (isNaN(val)) {
    val = 100;
  } else {
    if (val < 0) { val = 0; }
    if (val > 100) { val = 100; }


    for (const circle of circles) {
      const r = circle.getAttribute('r');
      const c = Math.PI * (r * 2);
      const pct = c - ((100 - val) / 100) * c;

      circle.style.strokeDashoffset = pct;
      circle.style.strokeDasharray = c;

    }
  }
}

let found = [];

function updateOtp() {
  for (let i = 0; i < found.length; i++) {
    if ('totp_next' in foundRecords[i]) {
      foundRecords[i].totp = foundRecords[i].totp_next;
      const record = document.querySelector(`[data-row = "${i}"]`)
      const totpValue = record.querySelector('.totp-value')
      if (totpValue) {
        totpValue.innerText = foundRecords[i].totp;
      }
    }
  }
}

setInterval(() => {
  const d = new Date();
  setOtpDial((d.getSeconds() % 30) * 10 / 3)
  if ((d.getSeconds() % 30) == 0) {
    updateOtp()
  }
}, 1000)

function hideTitles() {
  for (const foundEntry of document.querySelectorAll(".found-entry")) {
    foundEntry.setAttribute('data-save-title', foundEntry.title);
    foundEntry.title = '';
  }
}

function restoreTitles() {
  for (const foundEntry of document.querySelectorAll(".found-entry")) {
    foundEntry.title = foundEntry.getAttribute('data-save-title');
  }
}

document.querySelector('#modal-mask').addEventListener('click', (ev) => {
  ev.stopPropagation();
  ev.target.style.display = 'none';
  restoreTitles();

  const copyDialogs = document.querySelectorAll('.copy-dialog')
  for (const copyDialog of copyDialogs) {
    copyDialog.style.display = 'none'
  }
})

function copyDivEntryClick(ev, fieldName) {
  ev.stopPropagation();
  document.querySelector('#modal-mask').style.display = 'none';
  restoreTitles();
  const foundEntry = ev.target.closest('.found-entry');
  const row = parseInt(foundEntry.getAttribute('data-row'));
  if (paymentStatus == "payment page") {
    const card = foundRecords[row].card;
    if (fieldName == "cc-name") {
      navigator.clipboard.writeText(card[4].trim())
    }
    if (fieldName == "cc-number") {
      navigator.clipboard.writeText(card[3].trim())
    }
    if (fieldName == "cc-exp-month") {
      navigator.clipboard.writeText(card[5].trim())
    }
    if (fieldName == "cc-exp-year") {
      navigator.clipboard.writeText(card[6].trim())
    }
    if (fieldName == "cc-exp") {
      const exp = `${card[5]}/${card[6].slice(-2)}`
      navigator.clipboard.writeText(exp)
    }

    if (fieldName == "cc-csc") {
      navigator.clipboard.writeText(card[7].trim())
    }
  } else {
    const field = foundRecords[row][fieldName];
    navigator.clipboard.writeText(field.trim())
  }

  const p = ev.target.closest('.copy-dialog');
  p.style.display = 'none'
}

function startCopiedTimer() {
  //  consoleLog('323 timer started')
  setTimeout(() => {

    window.close();

    document
      .querySelectorAll(".copied")
      .forEach((e) => {
        consoleLog('-e- 327');
        consoleLog(e.style.display);
        e.style.display = "none";
      });
    //     windowClose();

    window.close();

  }, 1000);
}

function renderFoundEntry(entryData, row, mode) {
  const foundEntry = document.createElement('div');
  foundEntry.setAttribute('data-row', `${row}`);
  foundEntry.setAttribute('class', 'found-entry');

  const copyDialog = document.createElement('div');
  copyDialog.setAttribute('class', 'copy-dialog')

  if (mode == "payment") {
    const copyCcName = document.createElement('div');
    copyCcName.innerHTML = '<span>Copy name</span>';

    copyCcName.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'cc-name');
    })
    copyDialog.append(copyCcName);

    const copyCcNumber = document.createElement('div');
    copyCcNumber.innerHTML = '<span>Copy number</span>';

    copyCcNumber.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'cc-number');
    })
    copyDialog.append(copyCcNumber);

    const copyCcCSC = document.createElement('div');
    copyCcCSC.innerHTML = '<span>Copy CVC</span>';

    copyCcCSC.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'cc-csc');
    })
    copyDialog.append(copyCcCSC);
    const copyCcExp = document.createElement('div');
    const card = entryData.card;
    copyCcExp.innerHTML = `<span>Copy Exp. Date ${card[5]}/${card[6].slice(-2)}</span>`;

    copyCcExp.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'cc-exp');
    })
    copyDialog.append(copyCcExp);

  } else {
    const copyUsername = document.createElement('div');
    copyUsername.innerHTML = '<span>Copy Username</span>';

    copyUsername.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'username');
    })
    copyDialog.append(copyUsername);

    const copyPassword = document.createElement('div');
    copyPassword.innerHTML = '<span>Copy Password</span>';

    copyPassword.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'password');
    })
    copyDialog.append(copyPassword);
  }

  foundEntry.setAttribute('title', 'Click to fill the form');

  if ("totp" in entryData) {
    const copyTotp = document.createElement('div');
    copyTotp.innerHTML = '<span>Copy One-time Code</span>';

    copyTotp.addEventListener('click', (ev) => {
      copyDivEntryClick(ev, 'totp');
    })
    copyDialog.append(copyTotp);
    foundEntry.setAttribute('title', 'Click to fill the form & copy TOTP');
  }

  copyDialog.style.display = 'none';
  foundEntry.append(copyDialog);

  const fillSpan = document.createElement('span')
  fillSpan.setAttribute('class', 'three-dots')

  fillSpan.innerHTML = '<img src="images/three-dots-vertical.svg">'
  fillSpan.setAttribute('title', 'Details')
  foundEntry.append(fillSpan);

  fillSpan.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const p = ev.target.closest('.found-entry');
    const c = p.querySelector('.copy-dialog');
    c.style.display = 'block';
    document.querySelector('#modal-mask').style.display = 'block'
    hideTitles()
  })

  foundEntry.onclick = advItemClick;

  const titleDiv = document.createElement('div');
  titleDiv.setAttribute('class', 'found-title');
  titleDiv.innerText = entryData.title;
  foundEntry.appendChild(titleDiv);

  const safeDiv = document.createElement('div');
  safeDiv.setAttribute('class', 'found-safe');
  safeDiv.innerText = entryData.safe;
  foundEntry.appendChild(safeDiv);

  if ("totp" in entryData) {
    const totpDiv = document.createElement('div');
    totpDiv.setAttribute('class', 'found-totp');
    totpDiv.innerHTML = dial;
    totpDiv.innerHTML += '<div style="margin: 0 20px 0 10px; font-size: 14px">One-time code (TOTP)</div>';
    const totpValue = document.createElement('div');
    totpValue.setAttribute("title", "Copy one-time code");

    totpValue.innerHTML = `<code class="totp-value">${entryData.totp}
            <div class="copied" >
              <div>Copied &#10003;</div>
            </div>
          </code>`
      ;

    totpValue.addEventListener('click', (ev) => {
      ev.stopPropagation();

      totpValue.querySelector('.copied').style.display = 'initial';
      // ev.target.style.display = 'initial';
      startCopiedTimer();
      navigator.clipboard.writeText(entryData.totp.trim()).then(() => {
        // windowClose();
      })
    })
    totpDiv.appendChild(totpValue);
    foundEntry.appendChild(totpDiv);
  }
  return foundEntry;
}

for (const cardSwitch of document.querySelectorAll('.credit-card')) {
  cardSwitch.addEventListener('click', () => {
    bgConnectionPort.postMessage({ id: "payment page" });
  })
}

function onPasswordSwitchClick() {
  browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      consoleLog("tabs");
      consoleLog(tabs);
      const tab = tabs[0];
      bgConnectionPort.postMessage({ id: "advise request", url: tab.url, tabId: tab.id });
    })
    .catch(err => {
      consoleLog(err)
    });
}

for (const passwordsSwitch of document.querySelectorAll('.passwords-icon')) {
  passwordsSwitch.addEventListener('click', onPasswordSwitchClick)
}

function renderAccounts(message) {

  consoleLog('renderAccount found: ' + message.found.length);

  document.querySelector(".icons").style.display = "flex";

  if (message.id == "payment") {
    document.querySelector(".credit-card").style.display = 'none';
    document.querySelector(".passwords-icon").style.display = 'initial';

    if (paymentHost) {
      let platform = paymentPlatform();
      consoleLog(`platform ${platform}`)
      if (platform) {
        consoleLog(`platform1 ${platform}`);
        document.getElementById('paygate').style.display = 'block';
        document.getElementById('paygate-url').innerText = platform;
      }
    }
    if (message.found.length == 0) {
      showPage('.not-found-page')
      document.getElementById("not-found-password").style.display = "none";
      document.getElementById("no-card-records").style.display = "block";
      return;
    }
  }

  if (message.id == "advise") {
    document.querySelector(".credit-card").style.display = "initial";
    document.querySelector(".passwords-icon").style.display = 'none';

    if (message.found.length == 0) {
      showPage('.not-found-page')
      document.getElementById("not-found-password").style.display = "block";
      document.getElementById("no-card-records").style.display = "none";
      const notFoundHostName = document.getElementById("not-found-hostname");
      notFoundHostName.innerText = message.hostname;
      return;
    }
  }

  foundRecords = message.found;

  showPage('#advice-page');
  const adviceListDiv = document.querySelector('#advice-list');

  adviceListDiv.innerHTML = '';

  consoleLog(`renderAccount for ${message.id}`);
  try {
    for (let i = 0; i < message.found.length; i++) {
      consoleLog('rendering ' + i + 1);
      const foundEntry = renderFoundEntry(foundRecords[i], i, message.id);

      adviceListDiv.appendChild(foundEntry);
    }
  } catch (e) {
    consoleLog('catch 193');
    consoleLog(e);
  }
  adviceListDiv.style.display = 'block';
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

  browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (paymentStatus == "payment page") {
        consoleLog(`paymentHost ${paymentHost} `)
        if (paymentHost) {
          consoleLog('paymentFrames');
          consoleLog(paymentFrames);

          for (let frame of paymentFrames) {
            consoleLog('frame');
            consoleLog(frame);

            consoleLog(`sending card data to frameid ${frame.frameId} `)
            browser.tabs.sendMessage(
              tabs[0].id,
              {
                id: 'card',
                card: foundRecords[row].card,
              },
              { frameId: frame.frameId })
              .then(response => {
                consoleLog('response');
                consoleLog(response);
                window.close();
              })
              .catch(err => {
                consoleLog('catched 169');
                consoleLog(err);
              })
          }
        }
        return;
      }

      for (let frame of sameUrlFrames) {
        consoleLog('frame');
        consoleLog(frame);
        if ("totp" in foundRecords[row]) {
          navigator.clipboard.writeText(foundRecords[row].totp.trim())
        }

        browser.tabs.sendMessage(
          tabs[0].id,
          {
            id: 'loginRequest',
            username: foundRecords[row].username,
            password: foundRecords[row].password,
          },
          { frameId: frame.frameId }
        )
          .then(response => {
            consoleLog('response');
            consoleLog(response);
            window.close();
          })
          .catch(err => {
            consoleLog('catched 169');
            consoleLog(err);
          })
      }
    });
}

function showPage(pageSelector) {
  const pages = document.querySelectorAll('.page');
  for (const page of pages) {
    page.style.display = "none";
  }
  const thePage = document.querySelector(pageSelector);
  thePage.style.display = 'block';

  if (pageSelector != '.not-a-regular-page') {
    document.querySelector(".refresh").style.display = "initial";
    consoleLog('656')
  } else {
    document.querySelector(".refresh").style.display = "none";
    document.querySelector(".passwords-icon").style.display = "none";
    document.querySelector(".credit-card").style.display = "none";
  }

  document.querySelector(".logout").style.display = "initial";
  document.querySelector(".icons").style.display = "flex";
}

function activatePassHubDocTab() {
  browser.tabs.query({ url: 'https://passhub.net/doc/browser-extension#firefox', currentWindow: true }, tabs => {
    for (let tab of tabs) {
      browser.tabs.update(tab.id, { active: true });
      return;
    }
    window.open('https://passhub.net/doc/browser-extension#firefox');
    window.close();
  });
}

for (let e of document.querySelectorAll('.help-link')) {
  e.onclick = activatePassHubDocTab;
}

function activatePassHubTab() {

  consoleLog(`server name is ${serverName}`)
  browser.tabs.query({ url: `https://${serverName}/*`, currentWindow: true })
    .then(passHubTabs => {
      for (let tab of passHubTabs) {
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

document.querySelector('.close-popup').onclick = () => window.close();

for (let e of document.querySelectorAll('.open-passhub-tab')) {
  e.onclick = activatePassHubTab;
}

document.querySelector('.contact-us').onclick = function () {
  window.open('https://passhub.net/feedback19.php', 'passhub_contact_us');
}


function loginCallback(urlQuery) {
  bgConnectionPort.postMessage({ id: 'loginCallback', urlQuery });
}


document.querySelector('.logout').onclick = function () {
  bgConnectionPort.postMessage({ id: 'logout' });
  window.close();
}

document.querySelector('.refresh').addEventListener('click', () => {
  bgConnectionPort.postMessage({ id: 'refresh' });
})

function explorePage() {
  browser.tabs.query({ active: true, currentWindow: true, })
    .then(tabs => {
      activeTab = tabs[0];

      consoleLog('activeTab');
      consoleLog(activeTab);

      let mainURL = new URL(activeTab.url);

      consoleLog('mainURL');
      consoleLog(mainURL);

      if (mainURL.host == "") {
        notRegularPage(activeTab.url);
        return;
      }

      if (mainURL.protocol != "https:") {
        document.querySelector("#danger-http").style.display = "block";
      }

      let mainUrlFrames = [];  // do we need it?

      browser.webNavigation.getAllFrames({ tabId: activeTab.id })
        .then(frameList => {

          consoleLog(`frameList with ${frameList.length} frames`);

          for (let frame of frameList) {
            consoleLog(`${frame.frameId} ${frame.url}`)
            let frameURL = new URL(frame.url);

            if ((frameURL.host !== "") || (frameURL.protocol == "https:")) {
              validFrames.push(frame);
              if (frameURL.host == mainURL.host) {
                mainUrlFrames.push(frame);
              }
            }
          }

          consoleLog('mainUrlFrames');
          consoleLog(mainUrlFrames);

          if (mainUrlFrames.length == 0) {
            notRegularPage(activeTab.url);
            return;
          }

          consoleLog('Sending message "payment status"');

          for (let frame of validFrames) {
            installScript(activeTab, frame)
          }
        })
        .catch(err => {
          consoleLog('catch 105');
          consoleLog(err);

        })
    });
}

function setServerName(name) {
  serverName = name;
  if (name === "passhub.net") {
    document.querySelector("#server-name-element").parentElement.style.display = "none";
    return;
  }
  document.querySelector("#server-name-element").parentElement.style.display = "block";
  document.querySelector("#server-name-element").setAttribute("href", `https://${serverName}`);
  document.querySelector("#server-name-element").innerText = serverName;
}

function processBgMessage(m) {
  consoleLog(`popup received message from background script, id ${m.id}`);
  consoleLog(m);

  if (m.id === "logout_request") {
    return; //????
  }

  if (m.id === "login") {
    showPage(".login-page");

    document.querySelector(".icons").style.display = "none";

    const ticketURL = `${m.urlBase}getticket.php`;

    document.querySelector("#logo").title = `Open page ${m.serverName}`;
    setServerName(m.serverName);

    WWPass.authInit({
      qrcode: document.querySelector('#qrcode'),
      ticketURL,
      callbackURL: loginCallback,
      log: consoleLog
    });
    return;
  }

  if (m.id == "create account") {
    showPage(".create-account-page");
    document.querySelector(".icons").style.display = "none";
    document.querySelector(".create-account-page .open-passhub-tab").innerText = serverName;
    return;
  }

  if ((m.id === "signing in..") || (m.id === "getting data..") || (m.id === "decrypting..")) {
    consoleLog('- ' + m.id);
    showPage('.wait-page');
    document.querySelector(".icons").style.display = "none";
    document.querySelector("#wait-message").innerText = m.id;
    return;
  }

  if (m.id === "signed") {
    document.querySelector(".login-page").style.display = "none";
    initSearch();
    explorePage();
    return;
  }

  if ((m.id === "advise") || (m.id === "payment")) {
    document.querySelector(".refresh").style.display = "initial";

    if (m.serverName) {
      document.querySelector("#logo").title = `Open page ${m.serverName}`;
      setServerName(m.serverName);
    }
    renderAccounts(m);
    return;
  }


  // ?????
}



bgConnectionPort = browser.runtime.connect({ name: "popup" });
bgConnectionPort.onMessage.addListener(processBgMessage);


/* 
  1. connect to background, login if necessary, 
  2. explorePage by installing contentsripts-> collect individual frame results though gotPaymentStatus (actually = page status: payment, login or not found)
  3. 

*/

