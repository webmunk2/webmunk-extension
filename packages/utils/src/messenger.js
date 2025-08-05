class Messenger {
  constructor(external= true) {
    this._modules = new Map();
    this._methodPrefix = '_onMessage_';
    this._receivers = [];
    this._frameIds = [];
    this._promises = [];
    this.external = external;
    this._registerHandlers();
    this.addReceiver('Messenger', this);
  }

  actionFor(receiverName, action){
    if (!this._receivers[receiverName]) return false;
    else if (!this._receivers[receiverName][action]) return false;
    else return true;
  }

  _registerHandlers() {
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this))
    if (this.external) chrome.runtime.onMessageExternal.addListener(this._onMessage.bind(this))
  }

  registerModule(moduleName) {
    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name is not valid!');
    }

    const moduleEventEmitter = {
      emit: (name, data) => this._modules.get(moduleName).forEach((listener) => listener(name, data))
    };

    // register module with empty listeners array
    this._modules.set(moduleName, []);

    return moduleEventEmitter;
  }

  addModuleListener(moduleName, listener) {
    if (!this._modules.has(moduleName)) {
      throw new Error('A module with this name has not been registered yet.');
    }

    if (typeof listener !== 'function') {
      throw new Error('Listener is not a function.');
    }

    this._modules.get(moduleName).push(listener);
    console.log(this._modules);
  }

  addReceiver(receiverName, receiver) {
    this._receivers[receiverName] = receiver
  }

  _onEventTabDestroyed(tabId) {
    this._onContextDestroy(tabId)
  }

  _onContextDestroy(tabId) {
    if (this._promises[tabId]) {
      console.log('Messenger._onContextDestroy releasing  tab info' + tabId)
      delete this._promises[tabId]
    }
  }

  _onMessage(message, from, reply) {
    var error
    if (message.type == 'chromex.dispatch' || message.type == 'SIGN_CONNECT') {
      return //reply('not for me') // this is a redux message
    }

    if (typeof message !== 'object') {
      console.log((error = 'Got non-object message'), message)
    } else if (!message.action) {
      console.log((error = 'Message has no action'), message)
      return;
    } else if (typeof message.action !== 'string') {
      console.log((error = 'Wrong action type'), message)
    } //else if (!from || !from.tab || !from.tab.id) {
    //  console.log(error = "Only messages from tabs with available 'id' are served");
    //}
    if (error) {
      return reply({ error })
    }
    var [receiver, method] = message.action.split('.')
    var promise = Promise.resolve()
    if (receiver === 'self') {
      promise = promise.then(() => {
        new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(
            from.tab.id,
            Object.assign({}, message, { action: method }),
            { frameId: 0 },
            result => {
              if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
              }
              if (result.error) {
                return reject(result.error)
              }
              resolve(result.data)
            }
          )
        })
        return true
      })
    } else {
      var computedMethodName = this._methodPrefix + method
      if (!this._receivers[receiver]) {
        return;
        // console.log((error = `Got no receiver '${receiver}'`))
      } else if (!method) {
        console.log((error = 'Empty method name'), message)
      } else if (!this._receivers[receiver][computedMethodName]) {
        console.log(
          (error = `Receiver '${receiver}' has no method '${method}'`)
        )
      }
      if (error) {
        return reply({ error })
      }
      promise = promise.then(() => {
        // we can run sync and async methods
        //setting frame id if not set yet.
        if (from.tab) {
          from.tab.frameId = from.tab.frameId || from.frameId
        }
        return this._receivers[receiver][computedMethodName](
          message.data,
          from,
          reply
        )
      })
    }
    //console.log(`Messenger._onMessage: receving action '${message.action}'`);

    promise.then(
      data => {
        reply({ ok: true, data })
      },
      error => {
        if (typeof error === 'object' && error.message) {
          return reply({ error: error.message })
        }
        reply({ error })
      }
    )

    // we are async
    return true
  }

  sendToMainPage(tabId, name, action, data, frameId) {
    return new Promise(function(resolve, reject) {
      chrome.tabs.sendMessage(
        tabId,
        { name: name, action: action, data: data },
        { frameId: frameId ? frameId : 0 },
        function(result) {
          if (chrome.runtime.lastError) {
            console.log(
              'got error ' + chrome.runtime.lastError.message + ' ' + tabId + ' ' + (frameId ? frameId : 0)
            )
            console.log(
              'got error sending',name,action
            )
            reject(new Error("Can't send " + action + ' to tab ' + tabId))
          } else {
            resolve(result)
          }
        }
      )
    })
  }

  _rememberFramePromise(tabId, frameName, resolve) {
    if (!this._promises[tabId]) {
      this._promises[tabId] = []
    }
    this._promises[tabId][frameName] = resolve
  }

  getLastFrameResolveMethod(tabId, frameName) {
    return this._promises[tabId][frameName]
  }

  sendToFrame(tabId, name, action, data) {
    return new Promise((resolve, reject) => {
      // this is to resolve externally a dialog
      this._rememberFramePromise(tabId, name, resolve)
      var _timeInterval = setInterval(() => {
        if (this._frameIds[tabId] && this._frameIds[tabId][name]) {
          clearInterval(_timeInterval)
          chrome.tabs.sendMessage(
            tabId,
            {
              action,
              name,
              data
            },
            { frameId: this._frameIds[tabId][name] },
            message => {
              if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
              }
              if (message.error) {
                console.log('got error', message.error)
                return reject(new Error(message.error))
              }
              return resolve(message)
            }
          )
        }
      }, 200)
    })
  }

  _onMessage_relay(data, from, _reply) {
    if (typeof data.data == 'object') {
      data.data.frameId = from.frameId
    }
    return this.sendToMainPage(
      from.tab.id,
      data.name,
      data.action,
      data.data,
      data.frameId
    ).then(response => {
      if (typeof response == 'object') response.frameId = from.frameId
      return response
    })
  }

  _onMessage_getFrameId(_data, from, reply) {
    reply(from.frameId)
  }

  _onMessage_ping(_data, from, reply) {
    reply({success:true})
  }
}

const messenger = new Messenger();

self.messenger = messenger;
exports.messenger = messenger;
export { messenger };
