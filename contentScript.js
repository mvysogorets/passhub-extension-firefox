// GPL: https://github.com/passff/passff

// const consoleLog = console.log;
const consoleLog = () => {};

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

function fillCredentials(loginData = null) {
  if (loginData) {
    loginRequestJson = loginData;
  }
  if (typeof loginRequestJson == 'undefined') {
    // not quite clear why, e.g. immediate redirect
    clearInterval(intervalID);
    return false;
  }

  if (fillCredentials.counter == undefined) {
    fillCredentials.counter = 0;
  }

  let usernameInput = null;
  let passwordInput = null;

  const inputs = document.querySelectorAll('input');

  if (fillCredentials.counter < 20) {
    consoleLog(inputs.length);
  }
  fillCredentials.counter++;

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
    consoleLog('done: username & password');
    setInputValue(usernameInput, loginRequestJson.username);
    setInputValue(passwordInput, loginRequestJson.password);
    clearInterval(intervalID);
    return true;
  }
  if (passwordInput) {
    consoleLog('done: password');
    setInputValue(passwordInput, loginRequestJson.password);
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
      return false;
    }
    consoleLog('username only');
    setInputValue(usernameInput, loginRequestJson.username);

    if (typeof usernameInput.id != 'undefined') {
      usernameID = usernameInput.id;
    }
    return false;
  }

  if (usernameInput == null && passwordInput == null) {
    if (fillCredentials.counter > 20) {
      consoleLog('nothing found');
      clearInterval(intervalID);
      return false;
    }
  }
  return false;
}

intervalID = setInterval(fillCredentials, 200);

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  consoleLog('contentScript');
  consoleLog(message);
  sendResponse({ farewell: `goodbye` });
  usernameID = null;
  fillCredentials(message);
  return true;
});
