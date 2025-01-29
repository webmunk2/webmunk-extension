import PostMessageMgr from './postMessage'
import _ from 'lodash'
import './contentscript-extra'
import { RateService } from './RateService';
import { v4 as uuidv4 } from 'uuid';
import iframeUrlFilter from './iframe-url-filter.json';

const debugLog = {
  traverse: false,
  highlighting:false,
  timeouts: false,
  hidden: true,
  noAd: true,
  registration: false,
  content: false,
  procedural: false
}

export let adsMgr;

if ( typeof vAPI === 'object' && !vAPI.contentScript ) {
  vAPI.contentScript = true;
  {
    let context = self;
    try {
        while (
            context !== self.top &&
            context.location.href.startsWith('about:blank') &&
            context.parent.location.href
        ) {
            context = context.parent;
        }
    } catch(ex) {
    }
    vAPI.effectiveSelf = context;
  }
  vAPI.userStylesheet = {
    added: new Set(),
    removed: new Set(),
    apply: function(callback) {
        if ( this.added.size === 0 && this.removed.size === 0 ) { return; }
        vAPI.messaging.send('vapi', {
            what: 'userCSS',
            add: Array.from(this.added),
            remove: Array.from(this.removed),
        }).then(( ) => {
            if ( callback instanceof Function === false ) { return; }
            callback();
        });
        this.added.clear();
        this.removed.clear();
    },
    add: function(cssText, now) {
        if ( cssText === '' ) { return; }
        this.added.add(cssText);
        if ( now ) { this.apply(); }
    },
    remove: function(cssText, now) {
        if ( cssText === '' ) { return; }
        this.removed.add(cssText);
        if ( now ) { this.apply(); }
    }
  };
  vAPI.SafeAnimationFrame = class {
    constructor(callback) {
        this.fid = this.tid = undefined;
        this.callback = callback;
    }
    start(delay) {
        if ( self.vAPI instanceof Object === false ) { return; }
        if ( delay === undefined ) {
          if ( this.fid === undefined ) {
            this.fid = requestAnimationFrame(( ) => { this.onRAF(); } );
          }
          if ( this.tid === undefined ) {
            this.tid = vAPI.setTimeout(( ) => { this.onSTO(); }, 20000);
          }
          return;
        }
        if ( this.fid === undefined && this.tid === undefined ) {
          this.tid = vAPI.setTimeout(( ) => { this.macroToMicro(); }, delay);
        }
    }
    clear() {
        if ( this.fid !== undefined ) {
            cancelAnimationFrame(this.fid);
            this.fid = undefined;
        }
        if ( this.tid !== undefined ) {
            clearTimeout(this.tid);
            this.tid = undefined;
        }
    }
    macroToMicro() {
        this.tid = undefined;
        this.start();
    }
    onRAF() {
        if ( this.tid !== undefined ) {
            clearTimeout(this.tid);
            this.tid = undefined;
        }
        this.fid = undefined;
        this.callback();
    }
    onSTO() {
        if ( this.fid !== undefined ) {
            cancelAnimationFrame(this.fid);
            this.fid = undefined;
        }
        this.tid = undefined;
        this.callback();
    }
  };

  const isFrame = () => window!==window.top
  const WAIT_BEFORE_EXTRACT = 2500;

  /*******************************************************************************

  The DOM filterer is the heart of uBO's cosmetic filtering.

  DOMFilterer: adds procedural cosmetic filtering

  */

  vAPI.hideStyle = 'display:none!important;';

  vAPI.DOMFilterer = class {
    constructor() {
      this.commitTimer = new vAPI.SafeAnimationFrame(
        ( ) => {
          this.commitNow(this.addedElements);
          this.addedElements= [];
        });
        this.disabled = false;
        this.listeners = [];
        this.stylesheets = [];
        this.exceptedCSSRules = [];
        this.exceptions = [];
        this.convertedProceduralFilters = [];
        this.proceduralFilterer = null;
        this.addedElements= [];
    }

    explodeCSS(css) {
      const out = [];
      const cssHide = `{${vAPI.hideStyle}}`;
      const blocks = css.trim().split(/\n\n+/);
      for ( const block of blocks ) {
        if ( block.endsWith(cssHide) === false ) { continue; }
        out.push(block.slice(0, -cssHide.length).trim());
      }
      return out;
    }
    addCSS(css, details = {}) {
      if ( typeof css !== 'string' || css.length === 0 ) { return; }
      if ( this.stylesheets.includes(css) ) { return; }
      this.stylesheets.push(css);
      if ( details.mustInject && this.disabled === false ) {
        vAPI.userStylesheet.add(css);
      }
      if ( this.hasListeners() === false ) { return; }
      if ( details.silent ) { return; }
      this.triggerListeners({ declarative: this.explodeCSS(css) });
    }
    exceptCSSRules(exceptions) {
      if ( exceptions.length === 0 ) { return; }
      this.exceptedCSSRules.push(...exceptions);
      if ( this.hasListeners() ) {
        this.triggerListeners({ exceptions });
      }
    }
    addListener(listener) {
      if ( this.listeners.indexOf(listener) !== -1 ) { return; }
      this.listeners.push(listener);
    }
    removeListener(listener) {
      const pos = this.listeners.indexOf(listener);
      if ( pos === -1 ) { return; }
      this.listeners.splice(pos, 1);
    }
    hasListeners() {
      return this.listeners.length !== 0;
    }
    triggerListeners(changes) {
      for ( const listener of this.listeners ) {
        listener.onFiltersetChanged(changes);
      }
    }
    toggle(state, callback) {
      if ( state === undefined ) { state = this.disabled; }
      if ( state !== this.disabled ) { return; }
      this.disabled = !state;
      const uss = vAPI.userStylesheet;
      for ( const css of this.stylesheets ) {
        if ( this.disabled ) {
          uss.remove(css);
        } else {
          uss.add(css);
        }
      }
      uss.apply(callback);
    }
    // Here we will deal with:
    // - Injecting low priority user styles;
    // - Notifying listeners about changed filterset.
    // https://www.reddit.com/r/uBlockOrigin/comments/9jj0y1/no_longer_blocking_ads/
    //   Ensure vAPI is still valid -- it can go away by the time we are
    //   called, since the port could be force-disconnected from the main
    //   process. Another approach would be to have vAPI.SafeAnimationFrame
    //   register a shutdown job: to evaluate. For now I will keep the fix
    //   trivial.
    commitNow() {
      this.commitTimer.clear();
      if ( vAPI instanceof Object === false ) { return; }
      //vAPI.userStylesheet.apply();
      if ( this.proceduralFilterer instanceof Object ) {
        this.proceduralFilterer.commitNow(this.addedElements);
        this.addedElements = [];
      }
    }
    commit(commitNow, elts) {
      if (elts){
        this.addedElements.push(...elts)
      }
      if ( commitNow ) {
        this.commitTimer.clear();
        this.commitNow();
      } else {
        this.commitTimer.start();
      }
    }
    proceduralFiltererInstance() {
      if ( this.proceduralFilterer instanceof Object === false ) {
        if ( vAPI.DOMProceduralFilterer instanceof Object === false ) {
          return null;
        }
        this.proceduralFilterer = new vAPI.DOMProceduralFilterer(this);
      }
      return this.proceduralFilterer;
    }
    addProceduralSelectors(selectors) {
      const procedurals = [];
      for ( const raw of selectors ) {
        procedurals.push(JSON.parse(raw));
      }
      if ( procedurals.length === 0 ) { return; }
      const pfilterer = this.proceduralFiltererInstance();
      if ( pfilterer !== null ) {
        pfilterer.addProceduralSelectors(procedurals);
      }
    }
    createProceduralFilter(o) {
      const pfilterer = this.proceduralFiltererInstance();
      if ( pfilterer === null ) { return; }
      return pfilterer.createProceduralFilter(o);
    }
    getAllSelectors(bits = 0) {
      const out = {
        declarative: [],
        exceptions: this.exceptedCSSRules,
      };
      const hasProcedural = this.proceduralFilterer instanceof Object;
      const includePrivateSelectors = (bits & 0b01) !== 0;
      const masterToken = hasProcedural
      ? `[${this.proceduralFilterer.masterToken}]`
      : undefined;
      for ( const css of this.stylesheets ) {
        for ( const block of this.explodeCSS(css) ) {
          if (
            includePrivateSelectors === false &&
            masterToken !== undefined &&
            block.startsWith(masterToken)
            ) {
              continue;
            }
            out.declarative.push(block);
          }
        }
        const excludeProcedurals = (bits & 0b10) !== 0;
        if ( excludeProcedurals === false ) {
          out.procedural = [];
          if ( hasProcedural ) {
            out.procedural.push(
              ...this.proceduralFilterer.selectors.values()
              );
            }
            const proceduralFilterer = this.proceduralFiltererInstance();
            if ( proceduralFilterer !== null ) {
              for ( const json of this.convertedProceduralFilters ) {
                const pfilter = proceduralFilterer.createProceduralFilter(json);
                pfilter.converted = true;
                out.procedural.push(pfilter);
              }
            }
          }
          return out;
    }
    getAllExceptionSelectors() {
      return this.exceptions.join(',\n');
    }
    async processNodes(nodes, pselectorAction, pselectorRaw) {
      const adsData = [];

      await Promise.all(nodes.map(async (node) => {
        debugLog.procedural && node.setAttribute('data-webmunk-considered-processNodes', 'true');

        const adId = uuidv4();

        if (!adsMgr.hasRelatedAds(node, 1000000) && !node.hasAttribute('data-tracked')) {
          this.highlightNodeAsAds(node, 0, 'darkgreen', pselectorAction, pselectorRaw);
        }

        if (!isFrame()) {
          adsMgr.addClickListenersToElements(null, node, adId);
          const adData = await adsMgr.extractAdData(null, node, adId);
          adsData.push(adData);
        }
      }));

      if (adsData.length) {
        const meta = adsMgr.extractMeta();
        chrome.runtime.sendMessage({ action: adsMgr.getMainAppMgrName() + '.adContent', data: { meta, adsData } });
      }
    }
    highlightNodeAsAds(node1, _indent, color, detectionType, selectorRaw){
      let node = node1;
      let rect = node1.getBoundingClientRect();
      detectionType && node.setAttribute(detectionType,selectorRaw);
      if (rect.width < 4 && rect.height < 4){
        color="orange"
        node.setAttribute("data-webmunk-br",rect.width+"/"+rect.height)
        return;
      }
      //console.log(`Node matched: ${selectorRaw} ${document.URL} ${_indent}`,node);
      // specific pattern for facebook (finally useless)
      if (node1.localName=="use") node = node1.parentElement;
      // To see ad units, restore the line below
      // node.style.border=`dashed 2px ${color}`
      if (node.style.display != "none") node.style.display="block"
      node.style.margin="2px"
      node.ads = true;
      node.setAttribute("data-webmunk-isad",true)
      if (isFrame()){
        adsMgr.setIsad(true,"highlightNodeAsAds");
      }
      debugLog.highlighting && console.log("Highlighting ",node)
    }
  }

  // vAPI.domWatcher
  adsMgr = {
    addedNodeLists: [],
    addedNodes: [],
    removedNodeLists: [],
    domLayoutObserver: undefined,
    listenerIterator: [],
    listenerIteratorDirty: false,
    removedNodes: false,
    safeObserverHandlerTimer: undefined,
    ignoreTags: new Set([ 'br', 'head', 'link', 'meta', 'script', 'style' ]),
    listeners: [],
    cssSelectors: [],
    iframeSourceObserverOptions: {
      attributes: true,
      attributeFilter: [ 'src' ]
    },
    urlToIframeEltMap: new Map(),
    rateService: new RateService(),
    isAd: false,
    isVisible: true,
    actionsMessageMain: ['isFrameAnAd','isDisplayNone'],
    actionsMessageFrame: ['youAreAFrameAd','areYouAnAd','isDisplayNone'],
    frameId: null,
    initialAdContentSent: false,
    appMgrName: 'extensionAdsAppMgr',
    async initialize(){
      chrome.runtime.onMessage.addListener(this._onBackgroundMessage.bind(this));

      if (isFrame()) {
        this.isAd = false;

        document.addEventListener('DOMContentLoaded', async (event) => {
          this.frameId = await chrome.runtime.sendMessage({ action: 'Messenger.getFrameId' });
          await this.wait(WAIT_BEFORE_EXTRACT);
          const response = await chrome.runtime.sendMessage({ action: 'extensionAdsAppMgr.isDisplayNone', data: {} });

          if (response?.data?.isDisplayNone) {
            debugLog.hidden && console.log(`DOMContentLoaded: Iframe is hidden ${this.frameId} `, window.document);

            return;
          }

          if (!this.isAd) {
            const response  = await chrome.runtime.sendMessage({ action: 'extensionAdsAppMgr.parentFrameIsAnAd', data: {} });

            this.isAd = response?.data?.isAd;
          }

          if (!this.isAd) {
            debugLog.noAd && console.log(`DOMContentLoaded: Iframe is not an ad ${this.frameId} `, window.document);

            return;
          }

          const adId = uuidv4();

          const meta = this.extractMeta();
          this.addClickListenersToElements(this.frameId, null, adId);
          const frameData = await this.extractAdData(this.frameId, null, adId);

          chrome.runtime.sendMessage({ action: this.getMainAppMgrName() + '.adContent', data: { meta, adsData: [frameData] } });
        });

        this.postMessageMgr = new PostMessageMgr();
        this.frameId = await chrome.runtime.sendMessage({ action: 'Messenger.getFrameId' });
      }
        window.addEventListener('message', async (event) => {
          if (event.data.action === 'iframeCoordinatesRequest') {
            const iframes = document.querySelectorAll('iframe');
            const targetIframe = Array.from(iframes).find((iframe) => iframe.contentWindow === event.source);

            if (targetIframe) {
              const coordinates = await this.getAdsCoordinates(targetIframe);
              event.source.postMessage(
                {
                  action: 'iframeCoordinatesResponse',
                  coordinates: coordinates
                },
                event.origin
              );
            } else {
              event.source.postMessage(
                {
                  action: 'iframeCoordinatesResponse',
                  coordinates: null
                },
                event.origin
              );
            }
          }
        });

        this.postMessageMgr = new PostMessageMgr();
        this.postMessageMgr.setReceiver((data) => this.mainReceivePostMessage(data))

      this.iframeSourceObserver = new MutationObserver(this.iframeSourceModified);

      //vAPI.domMutationTime = Date.now();
      vAPI.domWatcher = { start: ()=>this.start(), addListener: (filterer) => this.addListener(filterer), removeListener: (filterer)=>this.removeListener(filterer) };
      /*chrome.runtime.sendMessage({action:'extensionAdsAppMgr.retrieveContentScriptParameters',
        data:{
          url: vAPI.effectiveSelf.location.href,
          needScriptlets: false,
        }
      }).then(response => {
          console.log(`vAPI.bootstrap[${vAPI.effectiveSelf.location.href}]:`,response && response.specificCosmeticFilters.injectedCSS)
          //this.onResponseReady(response);
      });*/
      vAPI.messaging.send('contentscript', {
        what: 'retrieveContentScriptParameters',
        url: vAPI.effectiveSelf.location.href,
        needScriptlets: typeof self.uBO_scriptletsInjected !== 'string',
      }).then(response => {
          try{
            this.cssSelectors = response.specificCosmeticFilters? response.specificCosmeticFilters.specificSet:[];
          }
          catch(e){
            this.cssSelectors = []
          }
          this.onResponseReady(response);

      });
    },
    getMainAppMgrName: function(){
      return this.appMgrName;
    },
    setIsad:function(value, reason){
      this.isAd=value;
      console.log(`setIsad ${this.frameId} [${reason}]:`,value)
    },

    async trackMainFrame(element) {
      const adElements = [];

      if (element.hasAttribute('data-tracked')) return;

      element.setAttribute('data-tracked', true);

      if (element.localName === 'iframe') return;

      const adId = uuidv4();

      adElements.push(element);
      this.addClickListenersToElements(null, element, adId);

      const meta = this.extractMeta();

      const adsData = await Promise.all(
        adElements.map(async (elem) => await this.extractAdData(null, elem, adId))
      );

      chrome.runtime.sendMessage({
        action: this.getMainAppMgrName() + '.adContent',
        data: { meta, adsData },
      });
    },

    _onBackgroundMessage(message, sender, reply) {
      let actionsMessage = isFrame() ? this.actionsMessageFrame : this.actionsMessageMain;
      if (!message.action || actionsMessage.indexOf(message.action) === -1) {
        return false
      }
      this[`_onMessage_${message.action}`](message, sender, reply)
      return true //async reply
    },
    _onMessage_isDisplayNone:function(msg,_from,reply){
      let result  = {success:false, reason:"frameid not found", isDisplayNone: false};
      try {
        let iframes = Array.from(document.querySelectorAll("iframe"));
        let iframe = iframes.find(f => f.getAttribute("frameid")== msg.data)
        if (iframe){
          if (iframe.style.display == "none"){
            result = {success:true, isDisplayNone: true}
          }
        }
      }
      catch(e){
        result = e;
      }
      reply(result)
    },
    _onMessage_areYouAnAd:function(_msg,_from,reply){
      reply({isAd: this.isAd})
    },
    _onMessage_youAreAFrameAd:function(_msg,_from,reply){
      this.setIsad(true,"_onMessage_youAreAFrameAd");
      reply({success: true})
    },
    _onMessage_isFrameAnAd:function(msg,_from,reply){
      let result  = {success:false, reason:"frameid not found", isAd: false};
      try {
        let iframes = Array.from(document.querySelectorAll("iframe"));
        let iframe = iframes.find(f => f.getAttribute("frameid")== msg.data)
        if (iframe){
          if (iframe.style.display == "none"){
            result = {success:true, isAd: false, reason: "frame hidden"}
          }
          else {
            let parent = iframe.parentElement, count = 0;
            const MAX_PARENTS = 2;
            result = {success:true, isAd: iframe.getAttribute("data-webmunk-isad")?true:false}
            while (!result.isAd && parent &&  count < MAX_PARENTS){
              result = {success:true, isAd: parent.getAttribute("data-webmunk-isad")?true:false}
              parent = parent.parentElement;
              count ++;
            }
          }
        }
      }
      catch(e){
        result = e;
      }
      reply(result)
    },
    mainReceivePostMessage:function(data){
      switch(data.action){
        case 'ready':
          debugLog.registration && console.log(`[${window.name} iframe ready `+data.data)
          break;
        case 'isIframeAnAd':
          let iframe = this.postMessageMgr.idToFrame(data.from)
          return iframe.ads;
      }
    },
    wait(delay){
      return new Promise(resolve => {
        setTimeout(()=>{
          resolve();
        }, delay)
      })
    },
    iframeSourceModified:function(mutations) {
      for ( const mutation of mutations ) {
        console.log("Iframe changing src "+mutation.target.src,mutation.target)
        //addIFrame(mutation.target, true);
      }
    },
    async captureToCanvas(regionElt) {
      let rect = regionElt.getBoundingClientRect()
      return chrome.runtime.sendMessage({action:"extensionAdsAppMgr.captureRegion", data:{region:rect}}).then( data => {
        console.log("captureToCanvas ",data)
      })
    },
    hasRelatedAds: function(node, maxLevel = 6) {
      let i = 0;
      let parent = node;

      while (i < maxLevel && parent.parentElement != null) {
        i++;

        parent = parent.parentElement;

        if (parent.hasAttribute("data-webmunk-isad")) {
          return true;
        }
      }

      const checkChildren = (element) => {
        if (element.hasAttribute("data-webmunk-isad")) {
          return true;
        }

        for (const child of element.children) {
          if (checkChildren(child)) {
            return true;
          }
        }

        return false;
      };

      return checkChildren(node);
    },
    highlightNodeAsAds(node, _indent, color, detectionType, selectorRaw){
      vAPI.domFilterer.highlightNodeAsAds(node, _indent, color, detectionType, selectorRaw);
    },
    traverseDOM: async function(node, _indent = 0) {
      let urlIsAnAd = false;
      if (node.nodeType !== 1) return;
      if (this.ignoreTags.has(node.localName)) return;
      if (isFrame() && this.isAd) return;
      if (node.localName === "iframe" && this.hasRelatedAds(node, 1)) {
        setTimeout(() => {
            this.waitForFrameId(node).then(id => {
                node.setAttribute("data-webmunk-isad", true);
                chrome.runtime.sendMessage({
                    action: "extensionAdsAppMgr.youAreAFrameAd",
                    data: {
                        frameId: parseInt(id, 10)
                    }
                });

                const iframeDocument = node.contentDocument || node.contentWindow.document;
                if (iframeDocument) {
                    this.iframeSourceObserver.observe(iframeDocument, this.iframeSourceObserverOptions);
                }
            }).catch(e => {
                console.log(`EXCEPTION: Setting Iframe[UNKNOWN] to data-webmunk-isad true`, node);
                node.setAttribute("data-webmunk-isad", true);
            });
        }, 300);
    }
      if (node.href && typeof node.href != "object" || node.src){
          urlIsAnAd = await chrome.runtime.sendMessage({
              action: "extensionAdsAppMgr.isUrlAnAds",
              data: {
                  src: node.src,
                  href: node.href
              }
          }).then(result => {
              return result.data.urlIsAnAd;
          });
          if (urlIsAnAd && !(node.style.display === "none")) {
              let parentFrameIsAnAd = false;
              if (isFrame()) {
                  console.log("Checking node for ad ascendance", node);
              }
              if (!parentFrameIsAnAd && !node.hasAttribute('data-tracked')) {
                  this.highlightNodeAsAds(node, _indent, "red", "urlIsAnAd-hit", node.src);
              }
          }
      }

      if (node.localName === "iframe" && node.contentWindow && node.ownerDocument === document && node.getAttribute("role") !== "presentation") {
        const iframeSrc = node.src;
        const filters = iframeUrlFilter.filters;

        // Check if iframeSrc is excluded by any of the filters
        const isFiltered = filters.some((filter) => iframeSrc.includes(filter));

        // We use this check to avoid tracking non-ad blocks from specified URLs.
        if (!isFiltered && !node.hasAttribute('data-tracked')) {
            this.highlightNodeAsAds(node, _indent, "red", "urlIsAnAd-hit", node.src);
        }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        for (const selector of this.cssSelectors) {
            if (node.localName === "iframe") {
                this.iframeSourceObserver.observe(node, this.iframeSourceObserverOptions);
            }

            try {
              if (!node.matches("iframe") && node.matches(selector)) {

                const hasRelatedAdvertisement = this.hasRelatedAds(node)
                if (hasRelatedAdvertisement) return;

                const hasContent = node.childNodes.length > 0 || node.textContent.trim() !== "";
                if (!hasContent || node.hasAttribute('data-tracked')) return;

                this.highlightNodeAsAds(node, _indent, "blue", "data-webmunk-cosmetic-hit", selector);
                await this.trackMainFrame(node);
              } else {
                if (this.isAd && node.localName === "iframe") {
                  node.setAttribute("data-webmunk-isad", true);
                  const id = await this.waitForFrameId(node);
                  chrome.runtime.sendMessage({
                    action: "extensionAdsAppMgr.youAreAFrameAd",
                    data: { frameId: parseInt(id, 10) }
                  });
                }
              }
            } catch (e) {
                console.log(`Error processing selector: ${selector}`, e);
            }
        }

        for (let i = 0; i < node.childNodes.length; i++) {
            await this.traverseDOM(node.childNodes[i], _indent + 2);
        }
      }
    },
    waitForFrameId:function(node, count = 50){
      return new Promise((resolve,reject) => {
        let frameId = node.getAttribute("frameid")
        if (frameId) resolve(frameId);
        else{
          let intervalId = setInterval(()=>{
            let frameId = node.getAttribute("frameid")
            if (frameId){
              clearInterval(intervalId)
              resolve(frameId);
            }
            if (count<0){
              clearInterval(intervalId);
              reject()
              //if (node.style.display!="none") console.warn("Clearing intervalId for frame, too many attempts ",node)
            }
            count --;
          }, 10)
        }
      })
    },
    notifyForAd:function(node){
      let frameIds = [];
      if (node.localName=="iframe") {
        let frameId = node.getAttribute("frameid")
        if (frameId) frameIds.push(frameId)
      }
      else{
        let iframes = node.querySelectorAll("iframe");
        if (iframes.length){
          Array.from(iframes).forEach(f => {
            let frameId = f.getAttribute("frameid");
            if (frameId) frameIds.push(frameId)
          })
        }
      }
      chrome.runtime.sendMessage({action:"extensionAdsAppMgr.adDetected",data:{
        main:{
          tagName: node.localName,
          content: node.textContent,
          src: node.src? node.src : undefined,
          href: node.href? node.href : undefined,
        },
        frameIds
      }}).then(result => {
        console.log("Content sent for ad:",result)
      })
    },
    waitForContentWindow(node){
      let delay = 500;
      let count = 100;
      console.log("waitForContentWindow",node)
      return new Promise(resolve => {
        let timerId = setInterval(()=>{
          if (node.contentWindow || count < 0){
            if (count<0) console.log("Giving up on iframe",node)
            else console.log("waitForContentWindow ready",node)
            clearInterval(timerId);
            resolve()
          }
          count --;
          delay = 10;
        }, delay)
      })
    },
    extractMeta(){
      let content = [];
      document.querySelectorAll("meta").forEach(m => {
        content.push({
          name:m.getAttribute("name"),
          content:m.getAttribute("content"),
        })
      })
      return content;
    },
    async extractAdData(frameId, elem, adId) {
      // for iframes elem is document
      const element = elem || document;

      const { title, text } = this.extractTexts(frameId, element);
      const content = this.extractContent(frameId, element);
      const coordinates = await this.getAdsCoordinates(element);

      return { title, text, content, coordinates, adId };
    },

    async addClickListenersToElements(frameId, elem, adId) {
      const element = elem || document;

      await this.makeCloneIfNeeded(element);

      element.addEventListener('click', (event) => {
        let clickedUrl;

        const { clientX, clientY } = event;

        let hoveredElement = document.elementFromPoint(clientX, clientY);
        if (!hoveredElement) return;

        const closestLink = hoveredElement.tagName === 'A'
          ? hoveredElement
          : hoveredElement.closest('a');

        clickedUrl = closestLink?.href || null;

        if (!clickedUrl) {
          clickedUrl = this.getClosestLink(hoveredElement);
        }

        chrome.runtime.sendMessage({
          action: this.getMainAppMgrName() + '.adClicked',
          data: { clickedUrl, adId }
        });
      });
    },

    async makeCloneIfNeeded(element) {
      const thumbnailContainer = element.querySelector('#thumbnail-container');
      if (!thumbnailContainer) return;

      const clonedElement = thumbnailContainer.cloneNode(true);

      if (!thumbnailContainer.parentElement) return;

      await this.removeAriaHiddenBeforeClick(clonedElement);
      thumbnailContainer.parentElement.replaceChild(clonedElement, thumbnailContainer);

      clonedElement.removeAttribute('aria-hidden');
      clonedElement.removeAttribute('tabindex');
    },

    async removeAriaHiddenBeforeClick(element) {
      element.removeAttribute('aria-hidden');
      element.removeAttribute('tabindex');

      const elementsWithAriaHidden = element.querySelectorAll('[aria-hidden]');

      elementsWithAriaHidden.forEach((el) => {
        el.removeAttribute('aria-hidden');
        el.removeAttribute('tabindex');
      });
    },

    getClosestLink(element) {
      while (element) {
        if (element.tagName === 'A' && element.href) {
          return element.href;
        }

        if (element.tagName === 'VIDEO' && element.src) {
          if (element.src.startsWith('blob:')) {
            element.src = element.src.replace('blob:', '');
          }
          return element.src;
        }

        const nestedLink = element.querySelector('a[href]');
        if (nestedLink) {
          return nestedLink.href;
        }

        const nestedVideo = element.querySelector('video[src]');
        if (nestedVideo) {
          if (nestedVideo.src.startsWith('blob:')) {
            nestedVideo.src = nestedVideo.src.replace('blob:', '');
          }
          return nestedVideo.src;
        }

        element = element.parentElement;
      }

      return null;
    },

    extractTexts(frameId, element) {
      // Selectors array to identify text elements
      const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span',
        'yt-formatted-string', 'body-text', 'title-text'
      ];

      const elements = Array.from(element.querySelectorAll(selectors)).filter((el) => {
        return !el.classList.contains('visually-hidden');
      });

      // Extract title text from the first non-empty element
      const title = elements.find((el) => {
        const textContent = el.textContent.trim();
        return textContent !== '';
      })?.textContent.trim() || null;

      // Find the longest text element by sanitizing the content
      const longestValue = elements.reduce((accumulator, elem) => {
        const textContent = elem.textContent.trim();
        const sanitizedTextContent = textContent.replace(/[^\w\s]/gi, '');

        return sanitizedTextContent.length > accumulator.sanitizedTextContent.length ? { textContent, sanitizedTextContent } : accumulator;
      }, {
        textContent: '',
        sanitizedTextContent: ''
      });

      return { title, text: longestValue.textContent };
    },
    extractContent(frameId, elt) {
      let content = [];
      const aArray = Array.from(elt.querySelectorAll("a"));
      const imgArray = Array.from(elt.querySelectorAll("img"));
      const divArray = Array.from(elt.querySelectorAll("div"));
      const videoArray = Array.from(elt.querySelectorAll("video"));

      const scopeArray = [...aArray, ...imgArray, ...videoArray];
      if (frameId === 0) scopeArray.push(elt)
      scopeArray.forEach(i => {
        let href = i.getAttribute("href");
        let src = i.getAttribute("src");

        if (i.localName === "video" || i.getAttribute("role") === "presentation") {
          const videoSrc = Array.from(i.querySelectorAll("source")).map(source => source.getAttribute("src")).filter(src => src);

          if (videoSrc.length) {
            content.push({ type: i.localName, src: videoSrc });
          } else if (src) {
            content.push({ type: i.localName, src: src });
          }

          return;
        }

        let o = {type:i.localName}
        src && (o.src = src);
        href && (o.href = href);
        content.push(o)
      })
      divArray.forEach(i => {
        if (i.style.backgroundImage && i.style.backgroundImage!=""){
          content.push({type:i.localName,href: i.style.backgroundImage})
        }
      })
      content = _.uniqWith(content,(o1,o2) => {
        for (let prop in o1){
          if (o1[prop] != o2[prop]) return false;
        }
        return true;
      })
      debugLog.content && console.log(`extractContent: ${frameId}`,elt?elt:"",content,document)
      return content;
    },
    async getIframeElementCoordinates() {
      return new Promise((resolve) => {
        const handleMessage = (event) => {
          if (event.data.action === 'iframeCoordinatesResponse') {
            window.removeEventListener('message', handleMessage);
            resolve(event.data.coordinates);
          }
        };

        window.addEventListener('message', handleMessage);
        window.top.postMessage({ action: 'iframeCoordinatesRequest' }, '*');
      });
    },
    async getAdsCoordinates(element) {
      // for iframe elements
      if (typeof element.getBoundingClientRect !== 'function') {
        return await this.getIframeElementCoordinates();
      }

      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
      const documentHeight = document.documentElement.scrollHeight;
      const documentWidth = document.documentElement.scrollWidth;

      return {
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width,
        height: rect.height,
        documentHeight: documentHeight,
        documentWidth: documentWidth
      };
    },
    safeObserverHandler:async function() {
        let i = 0;

        while ( this.addedNodeLists.length ) {
          const nodeList = this.addedNodeLists.shift();
          let iNode = 0;
          let nodeArray = Array.from(nodeList)
          while ( nodeArray.length ) {
            const node = nodeArray.shift();
            if (node.localName=="iframe" /*&& node.id.startsWith("google_ads_iframe_/22152718")*/){
              node.onload = () => {
                try{
                  /*setTimeout(async () => {
                    console.log("iframe onload",node, node.getAttribute("frameid"))

                  }, (1000));*/
                }
                catch(e){}
              }
            }
            if (isFrame()){
              this.traverseDOM(node, 0);
            }
            else{
              debugLog.traverse && console.log(`Launching traverseDOM from top [id=${node.id}]`)
              this.traverseDOM(node, 0);
            }
            iNode++;
          }
          i++;
        }
        // call domFilterer onChanged
        vAPI.domFilterer && vAPI.domFilterer.proceduralFiltererInstance().onDOMChanged(vAPI.domFilterer.addedElements, []);
        this.addedNodeLists.length = 0;
        vAPI.domMutationTime = Date.now();
    },
    // https://github.com/chrisaljoudi/uBlock/issues/205
    //   Do not handle added node directly from within mutation observer.
    observerHandler:function(mutations) {
      let i = mutations.length;
      while ( i-- ) {
          const mutation = mutations[i];
          let nodeList = mutation.addedNodes;
          if ( nodeList.length !== 0 ) {
              this.addedNodeLists.push(nodeList);
              Array.from(nodeList).forEach(n => {
                if (n.nodeType === Node.ELEMENT_NODE){
                  vAPI.domFilterer.addedElements.push(n);
                  //n.localName=="div" && console.log("observerHandler: ",n)
                }
              })
          }
      }
      if ( this.addedNodeLists.length !== 0 ) {
          this.safeObserverHandlerTimer.start(
            this.addedNodeLists.length < 100 ? 1 : undefined
          );
      }
    },
    startMutationObserver:function() {
      //console.log("startMutationObserver..."+document.URL)
      if ( this.domLayoutObserver !== undefined ) { return; }
      this.domLayoutObserver = new MutationObserver((mutations)=> this.observerHandler(mutations));
      this.domLayoutObserver.observe(document, {
          //attributeFilter: [ 'class', 'id' ],
          //attributes: true,
          childList: true,
          subtree: true
      });
      this.safeObserverHandlerTimer = new vAPI.SafeAnimationFrame(() => this.safeObserverHandler());
      //vAPI.shutdown.add(cleanup);
    },
    stopMutationObserver:function() {
      console.log("...stopMutationObserver")

        if ( this.domLayoutObserver === undefined ) { return; }
        this.cleanup();
        vAPI.shutdown.remove(()=>cleanup());
    },
    getListenerIterator:function() {
      if ( this.listenerIteratorDirty ) {
          listenerIterator = this.listeners.slice();
          this.listenerIteratorDirty = false;
      }
      return listenerIterator;
    },
    addListener:function(listener) {
        if ( this.listeners.indexOf(listener) !== -1 ) { return; }
        this.listeners.push(listener);
        this.listenerIteratorDirty = true;
        if ( this.domLayoutObserver === undefined ) { return; }
        try { listener.onDOMCreated(); }
        catch (ex) { }
        this.startMutationObserver();
    },
    removeListener:function(listener) {
        const pos = this.listeners.indexOf(listener);
        if ( pos === -1 ) { return; }
        this.listeners.splice(pos, 1);
        this.listenerIteratorDirty = true;
        if ( this.listeners.length === 0 ) {
          this.stopMutationObserver();
        }
    },
    cleanup: function() {
      if ( this.domLayoutObserver !== undefined ) {
        this.domLayoutObserver.disconnect();
        this.domLayoutObserver = undefined;
      }
      if ( this.safeObserverHandlerTimer !== undefined ) {
        this.safeObserverHandlerTimer.clear();
        this.safeObserverHandlerTimer = undefined;
      }
    },
    start:function() {
      /*for ( const listener of this.getListenerIterator() ) {
          try { listener.onDOMCreated(); }
          catch (ex) { }
      }*/
      this.startMutationObserver();
    },
    onResponseReady: function(response) {
      if ( response instanceof Object === false ) { return; }
      vAPI.bootstrap = undefined;

      // cosmetic filtering engine aka 'cfe'
      const cfeDetails = response && response.specificCosmeticFilters;
      vAPI.domWatcher.start(); // vAPI.domCollapser.start();
      const {
          noSpecificCosmeticFiltering,
          noGenericCosmeticFiltering,
          scriptletDetails,
      } = response;

      vAPI.noSpecificCosmeticFiltering = noSpecificCosmeticFiltering;
      vAPI.noGenericCosmeticFiltering = noGenericCosmeticFiltering;
      if ( noSpecificCosmeticFiltering && noGenericCosmeticFiltering ) {
        vAPI.domFilterer = null;
        vAPI.domSurveyor = null;
      } else {
        const domFilterer = vAPI.domFilterer = new vAPI.DOMFilterer();
        if ( noGenericCosmeticFiltering || cfeDetails.disableSurveyor ) {
          vAPI.domSurveyor = null;
        }
        domFilterer.exceptions = cfeDetails.exceptionFilters;
        domFilterer.addCSS(cfeDetails.injectedCSS);
        domFilterer.addProceduralSelectors(cfeDetails.proceduralFilters);
        domFilterer.exceptCSSRules(cfeDetails.exceptedFilters);
        domFilterer.convertedProceduralFilters = cfeDetails.convertedProceduralFilters;
        vAPI.userStylesheet.apply();
      }

      // Library of resources is located at:
      // https://github.com/gorhill/uBlock/blob/master/assets/ublock/resources.txt
      if ( scriptletDetails && typeof self.uBO_scriptletsInjected !== 'string' ) {
          self.uBO_scriptletsInjected = scriptletDetails.filters;
          if ( scriptletDetails.mainWorld ) {
              //TODO JM vAPI.injectScriptlet(document, scriptletDetails.mainWorld);
              //vAPI.injectedScripts = scriptletDetails.mainWorld;
          }
      }

      const readyState = document.readyState;
      if ( readyState === 'interactive' || readyState === 'complete' ) {
          return this.onDomReady();
      }
      document.addEventListener('DOMContentLoaded', () => this.onDomReady(), { once: true });
    },
    onDomReady:function(){
      // This can happen on Firefox. For instance:
      // https://github.com/gorhill/uBlock/issues/1893
      if ( window.location === null ) { return; }
      if ( self.vAPI instanceof Object === false ) { return; }
      vAPI.messaging.send('contentscript', {
          what: 'shouldRenderNoscriptTags',
      });
      if ( vAPI.domWatcher instanceof Object ) {
          vAPI.domWatcher.start();
      }
    }
  }
}