const serverURL = 'passhub.net';

function getApiURL() {
  return `https://ext.${serverURL}/`;
}

function getWsURL() {
  return `wss://ext.${serverURL}/wsapp/`;
}

function getServerURL() {
  return `https://${serverURL}/`;
}


export {
  getApiURL,
  getWsURL,
  getServerURL
}
