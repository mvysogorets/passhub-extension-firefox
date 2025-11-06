


//production  mode

const consoleLog = () => { };
const windowClose = window.close;




// Debug mode:
/*
const consoleLog = console.log;
const windowClose = () => { consoleLog('windowClose') };
*/


let hostname = 'passhub.net';

function getApiURL() {
  return `https://ext.${hostname}/`;
}


function getWsURL() {
  return `wss://ext.${hostname}/wsapp/`;
}

function setHostname(newName) {
  consoleLog(`setHostname ${newName}`)
  hostname = newName;
}

function getHostname() {
  return hostname;
}

export {
  getApiURL,
  getWsURL,
  setHostname,
  getHostname,
  consoleLog,
  windowClose
}
