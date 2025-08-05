const isFrame = () => window!==window.top
const debugLog = {
  timeouts: false,
  registration:false,
  messaging: false,
}

export default class PostMessageMgr {
  constructor() {
    this._promises = new Map()
    this._promiseIdToContentWindow = new Map();
    this._receiveHdlr = (_data) => {
      return Promise.resolve({success: false, msg:"no receive handler set for "+this.from});
    }
    this.addMessageHdlr()
    if(!isFrame()){
      this.from = 0;
      this.frameMap =  new Map()
      this.idToFrame = new Map();
      // create a test iframe
      /*setTimeout(()=>{
        let iframe = document.createElement("iframe")
        iframe.id = "webmunkFakeId"
        document.body.appendChild(iframe)
      },10000)*/
    }
    else {
      //if (window.innerHeight>5 && window.innerWidth >5){
        this.addmeta()
        chrome.runtime.sendMessage({action:"Messenger.getFrameId"}).then((frameId) => {
          window.frameId = frameId;
          debugLog.registration && console.log(`Registering ${frameId} ${document.URL}`,document)
          /*let timerId = setTimeout(()=>{
            debugLog.timeouts && console.log(`Exhausting time for ${frameId} response`,document)
          },4000)*/
          this.sendTo(window.parent,"registerFrame", {frameId})/*.then(reply => {
            debugLog.registration && console.log(`Post-Registering ${frameId}  ${document.URL}`, document)
            clearTimeout(timerId)
          });*/
        });
      //}
      //else console.log("Iframe is small",document)
    }
  }
  setReceiver(receiverHldr) {
    this._receiveHdlr = receiverHldr
  }

  addmeta(){
    // Create a new meta element
    setTimeout(()=> {
      var meta = document.createElement('meta');
  
      // Set attributes of the meta element
      //meta.setAttribute('name', 'jml-meta');
      //meta.setAttribute('content', 'youpi');
  
      // Access the head element
      var head = document.head;
  
      // Insert the meta element as the first child of the head element
      head.insertBefore(meta, head.firstChild);
    },1000)
  }

  wait(delay){
    return new Promise(resolve => {
      setTimeout(()=>{
        resolve();
      }, delay)
    })
  }
  
  addMessageHdlr() {
    let name="";
    if (isFrame()){
      name = "webmunk"+Math.ceil(Math.random()*1000)
      /*setInterval(()=>{
        console.log("I'm alive "+name)
      },3000)*/
      debugLog.registration && console.log(`[${name}] addMessageHdlr ready for `+document.URL,document)
      this.sendTo(window.top,"ready",name)
    } 
    else{ 
      name = "webmunkMain"
    }
    //window.name = name;
    window.addEventListener('message', async(event) => {
      if (!event.data.action) return // this is not an app message 
      let eventData = event.data;
      //console.log(`[${window.name}]: addMessageHdlr Receiving  `+event.data.action+" "+event?.data?.data?.frameCorrelationId)

      switch(eventData.direction){
        case "FORWARD":
          if (eventData.action == "getFrameId"){
            console.log("oops receiving getFrameId")
            /*
            let frameId = await chrome.runtime.sendMessage({action:"Messenger.getFrameId"});
            console.log(`[${window.name}-${eventData.requestId}]:  replying ${frameId} `+event.data.action)
            return this.reply(eventData.action, event.source, {success:true,frameId}, eventData.promiseId, eventData.requestId)
            */
           return;
          }
          if (eventData.action == "registerFrame"){
            if (event.source){
              try {
                //event.source.document.body.style.background = "red";
              }
              catch(e){
                /*let timerId = setInterval(()=> {
                  try {
                    event.source.document.body.style.background = "red";
                    clearInterval(timerId)
                  }
                  catch(e){}
                },100)*/
              }
            }
            else {
              console.log(`addMessageHdlr: event source is null for [${event.origin}]`)
              return ;
            }
            let eventSource = event.source;
            await this.wait(500)
            let iframeElts = document.getElementsByTagName('iframe');
            /*Array.from(iframeElts).forEach(f => {
              console.log("Iframe content window:",f.contentWindow)
            })*/
            let registered = false;
            let reason = "can't find content window"
            try {
              for (var i = 0; i < iframeElts.length; i++) {
                if (iframeElts[i].contentWindow == eventSource) {
                  iframeElts[i].setAttribute("frameid",eventData.data.frameId)
                  registered = true;
                  reason = undefined;
                  break;
                }
              };
              if (!registered) console.log(reason,eventSource)
              return // this.reply(eventData.action, eventSource, {success:registered, reason, frameId:eventData.data.frameId}, eventData.promiseId)
            }
            catch(e){
              return //this.reply(eventData.action, eventSource, {success:false, reason:e, frameId:eventData.data.frameId}, eventData.promiseId)
            }
          }
          let result = await this._receiveHdlr(eventData);
          //this.reply(eventData.action, event.source, result, eventData.promiseId)
          break;
        case "BACK":
          //console.log('postMessageMgr.addMessageHdlr: Receiving msg from postmessage',eventData)
          var _promiseId = event.data.promiseId
          var _p = this._promises.get(_promiseId)
          if (_p) {
            _p.resolve(event.data.data)
            debugLog.messaging && console.log(`[${window.name}-${eventData.requestId}]:  Receiving  ${JSON.stringify(event.data.data)}`)

            this._promises.delete(_promiseId)
          }
          break;
      }
    }/*,{capture:true}*/)
  }
  sendTo(w, action, data){
    let requestId = Math.ceil(Math.random()*10000);
    var _p = new Promise((resolve, reject) => {
      var _promiseId = new Date().getTime()
      this._promises.set(_promiseId, { resolve, reject })
      this._promiseIdToContentWindow.set(_promiseId,w)
      try{
        debugLog.messaging && console.log(`[${window.name}]: Sending `+action+" "+requestId+` to [${w.name}]` )
      }
      catch(e){
        debugLog.messaging && console.log(`[${window.name}]: Sending `+action+" "+requestId+` to [UNKNOWN]` )
      }
      w.postMessage(
        {
          requestId,
          promiseId: _promiseId,
          direction: 'FORWARD',
          action,
          data
      },
      '*')
    })
    return _p
  }
  reply(action, to, result, promiseId, requestId) {
    try {
      let w = isFrame() ? window.top : to;
      w.postMessage(
        {
          from: this.from,
          action,
          promiseId,
          requestId,
          direction: 'BACK',
          data: result
        },
        '*'
      )
    }
    catch(e){
      console.log(`EXCEPTION reply to:${to}`,e)
    }
  }
}
