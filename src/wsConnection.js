import {consoleLog} from './utils';

class WsConnection {

  constructor(URL, messageInd) {
    this.URL = URL;
    this.state = 'idle'; // idle,connect_request, connected
    this.retryTimeout = 30*1000;
    this.keepAliveTimeout = 15000;
    this.retryTimer = null;
    this.keepAliveTimer = null;
    this.websocket = null;
    this.messageInd = messageInd;
  }

  close = () => {
    consoleLog('websocket got request close');
    clearTimeout(this.retryTimer);
    clearInterval(this.keepAliveTimer);
    if(this.state != 'idle') {
      this.webSocket.close();
      this.state = 'idle';
    }
  }

  send = message => {
    if(this.state == 'connected') {
      this.webSocket.send(message);
    }
  }

  connect = () => {

    consoleLog('websocket got request connect');
    if((this.state == 'connected') ) {
      return;
    }

    try {
      this.webSocket = new WebSocket(this.URL);
    } catch(err) {
      consoleLog('catch 31');
    }

    this.state = 'connect_req';
    this.retryTimer = setTimeout(this.connect, this.retryTimeout);

    this.webSocket.addEventListener("open", event => {
      consoleLog(`websocket event ${event.type} in state ${this.state}`);
      if(this.state != 'connect_req') {
        return;
      }

      this.state = 'connected';
      this.webSocket.send("Hello Server!");
      clearTimeout(this.retryTimer);
      this.keepAliveTimer = setInterval(() => {this.webSocket.send('ping')}, this.keepAliveTimeout);
    });
  
    this.webSocket.addEventListener("error", event => {
      consoleLog(`websocket event ${event.type} in state ${this.state}`);
    });
  
    this.webSocket.addEventListener("close", event => {
      consoleLog(`websocket event ${event.type} in state ${this.state}`);
      clearInterval(this.keepAliveTimer);

      if(this.state ==  'connected') {
        this.state = 'connect_req';
        this.retryTimer = setTimeout(this.connect, this.retryTimeout);
        return;
      }
    });
  
    this.webSocket.addEventListener("message",  event => {
      consoleLog(`websocket event ${event.type} in state ${this.state}`);
      if(this.state != 'connected') {
        return;
      }

      const message = event.data.toString();
      consoleLog("sMessage from server ", message);
      if (message === "pong") {
        return;
      }

      this.messageInd(message);
    });
  }
}

export default WsConnection;
