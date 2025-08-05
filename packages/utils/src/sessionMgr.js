import { v4 as uuidv4 } from 'uuid';
const defaultStorage = {
  sessions: '[]'
};

const wmSessionMgr = {
  sessions: new Map(),
  initialize:function(){
    chrome.storage.local.get(defaultStorage, (result) => {
      const storedSessions = JSON.parse(result.sessions);
      this.sessions = new Map(Object.entries(storedSessions));
    });
    chrome.tabs.query({}, (tabs)=>{
      tabs.forEach(tab => this.saveSession(tab))
    })
    chrome.alarms.create("garbageCollector", { periodInMinutes: 1 });
    this.addEventListeners();
  },
  addEventListeners:function(){
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      // Check if the URL has changed
      if (changeInfo.url) {      
        await this.deleteSession(tabId);
        let sessionId = this.saveSession(tab);    
        console.log(`Session created for tab: ${tab.id} with session ID: ${sessionId}`);
      }
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "garbageCollector") {
        this.garbageCollect(); // Your memory cleaning function
      }
    });
  },
  saveSession(tab){
    let id = uuidv4(); 
    this.sessions.set(tab.id,{sessionId: id, url: tab.url})
    const sessionsObj = Object.fromEntries(this.sessions);
    chrome.storage.local.set({ 'sessions': JSON.stringify(sessionsObj) });
    return id;
  },
  getSessionId(tabId){
    let session = this.sessions.get(tabId);
    return session?.sessionId;
  },
  getSession(tabId){
    let session = this.sessions.get(tabId);
    return session;
  },
  deleteSession:function(tabId) {
    // Delete session data
    // Here you might need a way to map tab IDs to session IDs
    if (this.getSessionId(tabId)){
      this.sessions.delete(tabId)
      const sessionsObj = Object.fromEntries(this.sessions);
      return chrome.storage.local.set({ 'sessions': JSON.stringify(sessionsObj) });
    }
    return Promise.resolve()
  },
  garbageCollect: function(){
    Array.from(this.sessions).forEach(s => {
      chrome.tabs.get(parseInt(s[0])).catch(e => {
        this.deleteSession(s[0])
      })
    });
  }
}
wmSessionMgr.initialize();

exports.wmSessionMgr = wmSessionMgr;
export { wmSessionMgr };
