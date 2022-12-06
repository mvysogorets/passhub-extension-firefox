// const consoleLog = consoleLog;
const consoleLog = () => {};

let error_message = '';
let currentServer = ''; 


function onFormSubmit(e) {
  e.preventDefault();
  try {
    consoleLog("form");
    consoleLog(document.querySelector("form"));
    consoleLog(document.querySelector("#url"));
  
    consoleLog(document.querySelector("#url").value);
  
    let val = document.getElementById('url').value;
    const protoPos = val.search('://');
    if(protoPos >=0) {
      val = val.substr(protoPos+3);
    }
    val = 'https://' + val;

    const newUrl = new URL(val);
    const newHostName= newUrl.hostname;

    consoleLog(newUrl);

    consoleLog('url value to store ' + val);
    if(newHostName == currentServer.passhubHost) {
      consoleLog('same name');
      return;
    }
    consoleLog('changed from ' + currentServer.passhubHost);
  
    browser.storage.local.set({
      passhubHost: newHostName,
    })
    .then(initForm);
  } 
  catch(err) {
    consoleLog('catch 37');
    consoleLog(err);
    error_message = 'not a valid host name';
    document.getElementById('error-message').innerText=error_message;
  }
}

function initForm() {
  consoleLog('initForm');

  browser.storage.local.get("passhubHost")
  .then(data => {
    consoleLog("storage");
    consoleLog(data);
    if(!data || !data.passhubHost ||(data.passhubHost == '')) {
      currentServer = {passhubHost:"passhub.net"};
    } else {
      currentServer = data;
    }

    document.getElementById('url').value=currentServer.passhubHost;
    document.getElementById('current-server').innerText=currentServer.passhubHost;

  })
  .catch (err =>{
    consoleLog('catch 19');
    consoleLog(err);
  });
}

consoleLog('options JS started');

const form = document.querySelector("form");

form.addEventListener("submit", onFormSubmit);



document.getElementById('url').addEventListener('input',  e => {
  consoleLog('change event fired');
  error_message='';
  document.getElementById('error-message').innerText=error_message;
}); 


document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === 'visible') {
    consoleLog('options visible');
  } else {
    consoleLog('options hidden');
  }
});


initForm();
