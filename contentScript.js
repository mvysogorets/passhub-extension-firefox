// GPL: https://github.com/passff/passff

// const consoleLog = console.log;
const consoleLog = () => {};


consoleLog('content script start');

const ccNumber= document.querySelectorAll('[autocomplete="cc-number"]');
if(ccNumber.length > 0) {
  consoleLog('contentScript: cc-number element found');
  consoleLog(ccNumber);
} else {
  consoleLog('contentScript: cc-number element not found');
}

const msg = 
browser.runtime.sendMessage({payment: ccNumber.length > 0 ?  "payment page": "not a payment page" });


function fillCardData(card) {
  const cardnum= document.querySelectorAll('[autocomplete="cc-number"]');
  if(ccNumber.length > 0) {
    setInputValue(cardnum[0], card[3]);    
  }

  let name= document.querySelectorAll('[autocomplete="cc-name"]');
  if(name.length > 0) {
    setInputValue(name[0], card[4]);    
  } else {
    name= document.querySelectorAll('[autocomplete="ccname"]');
    if(name.length > 0) {
      setInputValue(name[0], card[4]);    
    }
  }

  let exp= document.querySelectorAll('[autocomplete="cc-exp"]');
  if(exp.length > 0) {
    setInputValue(exp[0], `${card[5]}/${card[6]}`);    
  } else {
    let month = document.querySelectorAll('[autocomplete="cc-exp-month"]');
    if(month.length > 0) {
      setInputValue(month[0], card[5]);
    }
    let year = document.querySelectorAll('[autocomplete="cc-exp-year"]');
    if(year.length > 0) {
      setInputValue(year[0], card[6]);
    }
  }

  const csc= document.querySelectorAll('[autocomplete="cc-csc"]');
  if(csc.length > 0) {
    setInputValue(csc[0], card[7]);    
  }
}


function fireEvent(el, name) {
  el.dispatchEvent(
    new Event(name, {
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
}

function setInputValue(input, value) {
  input.value = value;
  fireEvent(input, 'input');
  fireEvent(input, 'change');
}

function isUsernameCandidate(input) {
  if (i.id.toLowerCase().search('search') != -1) {
    return false;
  }
  if (i.placeholder.toLowerCase().search('search') != -1) {
    return false;
  }
  return true;
}

let intervalID;
let usernameID = null;
let fcCounter = 0;


function fillCredentials(loginData = null) {
  fcCounter++;
  consoleLog(`fillCredentials started`);

  if (loginData) {
    loginRequestJson = loginData;
  }
  if (typeof loginRequestJson == 'undefined') {
    // not quite clear why, e.g. immediate redirect
    consoleLog(`clearInterval 1`);
    clearInterval(intervalID);
    return false;
  }
  let usernameInput = null;
  let passwordInput = null;

  const inputs = document.querySelectorAll('input');

  if (fcCounter < 20) {

    consoleLog(`contentScript: inputs.length: ${inputs.length}`);
  }

  consoleLog(`fcCounter ${fcCounter}`);


  for (i of inputs) {
    if (i.offsetParent === null) {
      continue;
    }
    if (i.disabled === true) {
      continue;
    }
    if (window.getComputedStyle(i).visibility == 'hidden') {
      continue;
    }

    const itype = i.type.toLowerCase();
    if (itype === 'text' && passwordInput == null) {
      if (isUsernameCandidate(i)) usernameInput = i;
    }
    if (itype === 'email' && passwordInput == null) {
      usernameInput = i;
    }

    if (itype === 'password') {
      passwordInput = i;
    }

    if (usernameInput && passwordInput) {
      break;
    }
  }

  if (usernameInput && passwordInput) {
    consoleLog('contentScript done: username & password');
    setInputValue(usernameInput, loginRequestJson.username);
    setInputValue(passwordInput, loginRequestJson.password);
    consoleLog(`clearInterval 2`);
    clearInterval(intervalID);
    return true;
  }
  if (passwordInput) {
    consoleLog('contentScript done: password');
    setInputValue(passwordInput, loginRequestJson.password);
    consoleLog(`clearInterval 3`);
    clearInterval(intervalID);
    return true;
  }

  if (usernameInput) {
    if (
      usernameID != null &&
      typeof usernameInput.id != 'undefined' &&
      usernameInput.id == usernameID
    ) {
      // do nothing, already set
      consoleLog(`gettingOut 189`);
      return false;
    }
    consoleLog('contentScript: username only');
    setInputValue(usernameInput, loginRequestJson.username);

    if (typeof usernameInput.id != 'undefined') {
      usernameID = usernameInput.id;
    }
    consoleLog(`gettingOut 198`);
    return false;
  }

  if (usernameInput == null && passwordInput == null) {
    if (fillCredentials.counter > 20) {
      consoleLog('contentScript: nothing found');
      consoleLog(`clearInterval 4`);
      clearInterval(intervalID);
      return false;
    }
  }
  consoleLog(`gettingOut 210`);
  return false;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  consoleLog('contentScript received:');
  consoleLog(message);
  if(message.id==="payment status") {
    sendResponse({ payment: ccNumber.length > 0 ?  "payment page": "not a payment page"  });
    return;
  }
  if(message.id === 'card'){
    fillCardData(message.card);
    return;
  }

  clearInterval(intervalID);
  usernameID = null;
  fcCounter = 0;

  fillCredentials(message);
  intervalID = setInterval(() => {fillCredentials(); consoleLog(`fcounter ${fcCounter}`)}, 1000);
  return true;
});
