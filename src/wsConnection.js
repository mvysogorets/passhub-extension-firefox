
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
    console.log('websocket got request close');
    clearTimeout(this.retryTimer);
    clearInterval(this.keepAliveTimer);
    if(this.state != 'idle') {
      this.webSocket.close();
      this.state = 'idle';
    }
  }

  connect = () => {
    const self = this;

    console.log('websocket got request connect');
    if((this.state == 'connected') ) {
      return;
    }

    try {
      this.webSocket = new WebSocket(this.URL);
    } catch(err) {
      console.log('catch 31');
    }

    this.state = 'connect_req';
    this.retryTimer = setTimeout(self.connect, this.retryTimeout);

    this.webSocket.addEventListener("open", event => {
      console.log(`websocket event ${event.type} state ${this.state}`);
      if(this.state != 'connect_req') {
        return;
      }

      this.state = 'connected';
      this.webSocket.send("Hello Server!");
      clearTimeout(this.retryTimer);
      this.keepAliveTimer = setInterval(() => {self.webSocket.send('ping')}, this.keepAliveTimeout);
    });
  
    this.webSocket.addEventListener("error", event => {
      console.log(`websocket event ${event.type} state ${this.state}`);
    });
  
    this.webSocket.addEventListener("close", event => {
      console.log(`websocket event ${event.type} state ${this.state}`);
      clearInterval(this.keepAliveTimer);

      if(this.state ==  'connected') {
        this.state = 'connect_req';
        this.retryTimer = setTimeout(self.connect, this.retryTimeout);
        return;
      }
    });
  
    this.webSocket.addEventListener("message",  event => {
      console.log(`websocket event ${event.type} state ${this.state}`);
      if(this.state != 'connected') {
        return;
      }

      const message = event.data.toString();
      console.log("sMessage from server ", message);
      if (message === "pong") {
        return;
      }

      this.messageInd(message);
    });
  }
}

export default WsConnection;
