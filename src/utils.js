// const consoleLog = console.log;
const consoleLog = () => { };

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
  consoleLog
}
