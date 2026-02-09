(()=>{"use strict";var e={9565:function(){},5533:function(e,t,n){var i=n(8932);n(5606);let s=i.Z;t.Z=s},5606:function(e,t,n){n(9565)},8932:function(e,t,n){n.d(t,{Z:function(){return i.Z}});var i=n(7634)},7634:function(e,t,n){n(9560),n(9734),n(5646),n(9774),n(5123),n(9710),n(793),n(102),n(2394);var i=n(9812),s=n(2023);let o={class:"app"},a={class:"sidebar"},l={class:"sidebar-header"},r={class:"window-count"},d={class:"window-list"},c=["onClick"],p={class:"window-info"},u={class:"window-title"},g={class:"window-status"},m=["onClick"],b={key:0,class:"no-windows"},v={class:"sidebar-footer"};t.Z=(0,i.aZ)({__name:"App",setup(e){let t=(0,i.iH)([]),n=(0,i.iH)([]),f=(0,i.iH)({users:0,tables:[]}),h=(0,i.iH)(!1),w=()=>{let e=new Date;return`
    <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; max-height: 100%; overflow-y: auto;">
      <h2 style="margin-bottom: 20px; color: #4f46e5;">\u{1F4BB} System Information</h2>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Operating System</h3>
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Platform:</span>
            <span>${navigator.platform}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">User Agent:</span>
            <span style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${navigator.userAgent}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Language:</span>
            <span>${navigator.language}</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Display & Screen</h3>
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Screen Resolution:</span>
            <span>${screen.width} \xd7 ${screen.height}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Available Resolution:</span>
            <span>${screen.availWidth} \xd7 ${screen.availHeight}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Color Depth:</span>
            <span>${screen.colorDepth}-bit</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Pixel Ratio:</span>
            <span>${window.devicePixelRatio}x</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Browser Information</h3>
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Online Status:</span>
            <span style="color: ${navigator.onLine?"#10b981":"#ef4444"}">${navigator.onLine?"\uD83D\uDFE2 Online":"\uD83D\uDD34 Offline"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Cookies Enabled:</span>
            <span>${navigator.cookieEnabled?"Yes":"No"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Cores:</span>
            <span>${navigator.hardwareConcurrency||"Unknown"}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Memory:</span>
            <span>${navigator.deviceMemory||"Unknown"} GB</span>
          </div>
        </div>
      </div>

      <div>
        <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Current Time</h3>
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Local Time:</span>
            <span>${e.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Timezone:</span>
            <span>${Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Timezone Offset:</span>
            <span>UTC${e.getTimezoneOffset()>0?"-":"+"}${Math.abs(e.getTimezoneOffset()/60)}</span>
          </div>
        </div>
      </div>
    </div>
  `},x=()=>{let e=n.value.length>0?n.value:[{id:1,name:"John Doe",email:"john@example.com",role:"Admin",status:"Active"},{id:2,name:"Jane Smith",email:"jane@example.com",role:"User",status:"Active"},{id:3,name:"Bob Johnson",email:"bob@example.com",role:"User",status:"Inactive"},{id:4,name:"Alice Brown",email:"alice@example.com",role:"Editor",status:"Active"},{id:5,name:"Charlie Wilson",email:"charlie@example.com",role:"User",status:"Pending"}],t=e.map(e=>`
    <tr style="border-bottom: 1px solid #334155;">
      <td style="padding: 10px; color: #e2e8f0;">${e.id}</td>
      <td style="padding: 10px; color: #e2e8f0;">${e.name}</td>
      <td style="padding: 10px; color: #94a3b8;">${e.email}</td>
      <td style="padding: 10px;"><span style="background: ${"Admin"===e.role?"#dc2626":"Editor"===e.role?"#f59e0b":"#3b82f6"}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${e.role}</span></td>
      <td style="padding: 10px;"><span style="color: ${"Active"===e.status?"#10b981":"Inactive"===e.status?"#ef4444":"#f59e0b"}">\u{25CF} ${e.status}</span></td>
    </tr>
  `).join("");return`
    <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; height: 100%; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5;">\u{1F5C4}\u{FE0F} SQLite Database Viewer</h2>
        <span style="background: #10b981; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem;">Live Data</span>
      </div>

      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <input type="text" id="db-search" placeholder="Search records..." style="flex: 1; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid #334155; border-radius: 6px; color: white; font-size: 0.9rem;">
          <button onclick="searchUsers()" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">Search</button>
          <button onclick="refreshUsers()" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">\u{21BB}</button>
        </div>

        <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #94a3b8;">
          <span>\u{1F4CA} Table: <strong style="color: white;">users</strong></span>
          <span>\u{1F4CB} Records: <strong style="color: white;">${e.length}</strong></span>
          <span>\u{1F4BE} Source: <strong style="color: white;">Rust SQLite</strong></span>
        </div>
      </div>

      <div style="flex: 1; overflow: auto; background: rgba(0,0,0,0.2); border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: rgba(255,255,255,0.1); position: sticky; top: 0;">
            <tr>
              <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">ID</th>
              <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Name</th>
              <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Email</th>
              <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Role</th>
              <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Status</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            ${t}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 0.8rem;">Showing ${e.length} record${1!==e.length?"s":""}</span>
        <div style="display: flex; gap: 5px;">
          <button style="padding: 5px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" disabled>Previous</button>
          <button style="padding: 5px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" disabled>Next</button>
        </div>
      </div>
    </div>
  `},y=()=>{L("System Information",w(),"\uD83D\uDCBB")},z=()=>{h.value=!0,s.Z.info("Opening SQLite window, fetching users from backend..."),window.getUsers?(s.Z.info("Calling Rust backend get_users function"),window.getUsers()):(s.Z.warn("Rust backend get_users not available"),h.value=!1),window.getDbStats&&window.getDbStats(),L("SQLite Database",x(),"\uD83D\uDDC4\uFE0F")};window.refreshUsers=()=>{s.Z.info("Refreshing users from database"),h.value=!0,window.getUsers&&window.getUsers()},window.searchUsers=()=>{let e=document.getElementById("db-search"),t=(null==e?void 0:e.value.toLowerCase())||"";s.Z.info("Searching users",{term:t});let n=document.getElementById("users-table-body");n&&n.querySelectorAll("tr").forEach(e=>{var n;let i=(null===(n=e.textContent)||void 0===n?void 0:n.toLowerCase())||"";e.style.display=i.includes(t)?"":"none"})};let k=()=>{let e=document.getElementById("users-table-body");if(!e||0===n.value.length)return;let t=n.value.map(e=>`
    <tr style="border-bottom: 1px solid #334155;">
      <td style="padding: 10px; color: #e2e8f0;">${e.id}</td>
      <td style="padding: 10px; color: #e2e8f0;">${e.name}</td>
      <td style="padding: 10px; color: #94a3b8;">${e.email}</td>
      <td style="padding: 10px;"><span style="background: ${"Admin"===e.role?"#dc2626":"Editor"===e.role?"#f59e0b":"#3b82f6"}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${e.role}</span></td>
      <td style="padding: 10px;"><span style="color: ${"Active"===e.status?"#10b981":"Inactive"===e.status?"#ef4444":"#f59e0b"}">\u{25CF} ${e.status}</span></td>
    </tr>
  `).join("");e.innerHTML=t},L=(e,n,i)=>{let o;if(!window.WinBox){s.Z.error("WinBox is not loaded yet. Please try again in a moment.");return}let a=t.value.find(t=>t.title===e);if(a){a.minimized&&(a.winboxInstance.restore(),a.minimized=!1),a.winboxInstance.focus();return}s.Z.info("Opening window",{windowTitle:e});let l="win-"+Date.now();o=new window.WinBox({title:e,background:"#1e293b",border:4,width:"calc(100% - 200px)",height:"100%",x:"200px",y:"0",minwidth:"300px",minheight:"300px",max:!0,min:!0,mount:document.createElement("div"),oncreate:function(){this.body.innerHTML=n},onminimize:function(){let e=t.value.find(e=>e.id===l);e&&(e.minimized=!0)},onrestore:function(){let e=t.value.find(e=>e.id===l);e&&(e.minimized=!1,e.maximized=!1)},onmaximize:function(){let e=window.innerWidth-200,n=window.innerHeight;this.resize(e,n),this.move(200,0);let i=t.value.find(e=>e.id===l);i&&(i.maximized=!0)},onclose:function(){let e=t.value.findIndex(e=>e.id===l);e>-1&&t.value.splice(e,1)}});t.value.push({id:l,title:e,minimized:!1,maximized:!1,winboxInstance:o})},_=e=>{e.minimized?(e.winboxInstance.restore(),e.minimized=!1):e.maximized?(e.winboxInstance.restore(),e.maximized=!1):(e.winboxInstance.minimize(),e.minimized=!0)},$=e=>{e.winboxInstance.close();let n=t.value.findIndex(t=>t.id===e.id);n>-1&&t.value.splice(n,1)},I=()=>{t.value.forEach(e=>{e.winboxInstance.close()}),t.value=[]},E=()=>{t.value.forEach(e=>{!e.minimized&&(e.winboxInstance.minimize(),e.minimized=!0,e.maximized=!1)}),s.Z.info("All windows minimized - showing main view")};(0,i.bv)(()=>{s.Z.info("Application initialized"),window.addEventListener("db_response",e=>{let t=e.detail;t.success?(n.value=t.data||[],s.Z.info("Users loaded from database",{count:n.value.length}),k()):s.Z.error("Failed to load users",{error:t.error}),h.value=!1}),window.addEventListener("stats_response",e=>{let t=e.detail;t.success&&(f.value=t.stats,s.Z.info("Database stats loaded",t.stats))}),window.addEventListener("resize",C)}),(0,i.SK)(()=>{window.removeEventListener("resize",C)});let C=()=>{t.value.forEach(e=>{if(e.maximized&&!e.minimized){let t=window.innerWidth-200,n=window.innerHeight;e.winboxInstance.resize(t,n),e.winboxInstance.move(200,0)}})};return(e,n)=>((0,i.wg)(),(0,i.iD)("div",o,[(0,i._)("aside",a,[(0,i._)("div",{class:"home-button-container"},[(0,i._)("button",{onClick:E,class:"home-btn",title:"Show Main View"},[...n[0]||(n[0]=[(0,i._)("span",{class:"home-icon"},"\uD83C\uDFE0",-1),(0,i._)("span",{class:"home-text"},"Home",-1)])])]),(0,i._)("div",l,[n[1]||(n[1]=(0,i._)("h2",null,"Windows",-1)),(0,i._)("span",r,(0,i.zw)(t.value.length),1)]),(0,i._)("div",d,[((0,i.wg)(!0),(0,i.iD)(i.HY,null,(0,i.Ko)(t.value,e=>((0,i.wg)(),(0,i.iD)("div",{key:e.id,class:(0,i.C_)(["window-item",{minimized:e.minimized}]),onClick:t=>_(e)},[n[2]||(n[2]=(0,i._)("div",{class:"window-icon"},"\uD83D\uDCF7",-1)),(0,i._)("div",p,[(0,i._)("span",u,(0,i.zw)(e.title),1),(0,i._)("span",g,(0,i.zw)(e.minimized?"Minimized":"Active"),1)]),(0,i._)("button",{class:"window-close",onClick:(0,i.iM)(t=>$(e),["stop"]),title:"Close window"},"\xd7",8,m)],10,c))),128)),0===t.value.length?((0,i.wg)(),(0,i.iD)("div",b," No open windows ")):(0,i.kq)("",!0)]),(0,i._)("div",v,[t.value.length>0?((0,i.wg)(),(0,i.iD)("button",{key:0,onClick:I,class:"close-all-btn"}," Close All ")):(0,i.kq)("",!0)])]),(0,i._)("div",{class:"main-container"},[n[5]||(n[5]=(0,i._)("header",{class:"header"},[(0,i._)("h1",null,"System Dashboard")],-1)),(0,i._)("main",{class:"main-content"},[(0,i._)("section",{class:"cards-section"},[(0,i._)("div",{class:"cards-grid two-cards"},[(0,i._)("div",{class:"card feature-card",onClick:y},[...n[3]||(n[3]=[(0,i.uE)('<div class="card-icon">\uD83D\uDCBB</div><div class="card-content"><h3 class="card-title">System Information</h3><p class="card-description"> View detailed system information including OS, memory, CPU, and runtime statistics. </p><div class="card-tags"><span class="tag">Hardware</span><span class="tag">Stats</span></div></div>',2)])]),(0,i._)("div",{class:"card feature-card",onClick:z},[...n[4]||(n[4]=[(0,i.uE)('<div class="card-icon">\uD83D\uDDC4\uFE0F</div><div class="card-content"><h3 class="card-title">SQLite Database</h3><p class="card-description"> Interactive database viewer with sample data. Connects to backend SQLite integration. </p><div class="card-tags"><span class="tag">Database</span><span class="tag">Mockup</span></div></div>',2)])])])])])])]))}})},2023:function(e,t,n){n(2394);let i=new class e{shouldLog(e){return this.logLevels[e]>=this.logLevels[this.logLevel]}addLog(e,t){let n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(!this.shouldLog(e))return;let i={timestamp:new Date().toISOString(),level:e,message:t,meta:n,id:Date.now()+Math.random()};this.logs.push(i),this.logs.length>this.maxLogEntries&&(this.logs=this.logs.slice(-this.maxLogEntries)),this.outputToConsole(i),this.emitLogEvent(i)}outputToConsole(e){let{level:t,message:n,timestamp:i}=e}emitLogEvent(e){let t=new CustomEvent("logEntryAdded",{detail:e});window.dispatchEvent(t)}debug(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};this.addLog("DEBUG",e,t)}info(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};this.addLog("INFO",e,t)}warn(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};this.addLog("WARN",e,t)}error(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};this.addLog("ERROR",e,t)}getLogs(){return[...this.logs]}clearLogs(){this.logs=[],window.dispatchEvent(new CustomEvent("logsCleared"))}setLogLevel(e){this.logLevels.hasOwnProperty(e.toUpperCase())&&(this.logLevel=e.toUpperCase(),this.info(`Log level set to ${this.logLevel}`))}getLogLevel(){return this.logLevel}constructor(){this.logs=[],this.maxLogEntries=1e3,this.logLevel="INFO",this.logLevels={DEBUG:0,INFO:1,WARN:2,ERROR:3}}};window.Logger=i,t.Z=i},6624:function(e,t,n){n(4510),n(4912),n(78),n(1416),n(9975),n(1998),n(8023),n(7527),n(4749),n(7881),n(9365),n(2592),n(1819),n(5614),n(7628);var i=n(2023);window.WebUIBridge=new class e{callRustFunction(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;return new Promise((n,i)=>{let s=this.nextId++;this.callbacks.set(s,{resolve:n,reject:i}),this.logger.info(`Calling Rust function: ${e}`,{functionName:e,data:t,callId:s});try{if(window.__webui__)window.__webui__.call(e,JSON.stringify(t||{})).then(t=>{this.logger.info(`Successfully called Rust function: ${e}`,{result:t,functionName:e}),n(JSON.parse(t))}).catch(n=>{this.logger.error(`Error calling Rust function ${e}: ${n.message}`,{functionName:e,error:n,data:t}),i(n)});else switch(this.logger.warn("WebUI not available, using simulated call",{functionName:e}),e){case"open_folder":this.logger.info("Open folder operation completed successfully"),n({success:!0,path:"/home/user/images",images:[{path:"/sample/image1.jpg",name:"image1.jpg"},{path:"/sample/image2.jpg",name:"image2.jpg"},{path:"/sample/image3.jpg",name:"image3.jpg"}]});break;case"organize_images":this.logger.info("Images organized successfully"),n({success:!0,message:"Images organized successfully!"});break;case"increment_counter":this.logger.debug(`Counter incremented to ${(null==t?void 0:t.value)||"unknown"}`,{value:null==t?void 0:t.value,functionName:e}),n({success:!0,value:(null==t?void 0:t.value)||0});break;case"reset_counter":this.logger.debug(`Counter reset to ${(null==t?void 0:t.value)||"unknown"}`,{value:null==t?void 0:t.value,functionName:e}),n({success:!0,value:(null==t?void 0:t.value)||0});break;default:this.logger.warn(`Unknown function called: ${e}`),n({success:!0})}}catch(n){this.logger.error(`Error in Rust function call: ${n.message}`,{functionName:e,error:n,data:t}),i(n)}})}handleResponse(e){this.logger.info("Received response from Rust backend",{response:e})}constructor(){this.callbacks=new Map,this.nextId=1,this.logger=i.Z}},window.WebUIBridge},5853:function(e,t,n){var i=n(9812),s=n(5533);n(6624),(0,i.ri)(s.Z).mount("#app")}},t={};function n(i){var s=t[i];if(void 0!==s)return s.exports;var o=t[i]={exports:{}};return e[i].call(o.exports,o,o.exports,n),o.exports}n.m=e,n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,{a:t}),t},n.d=function(e,t){for(var i in t)n.o(t,i)&&!n.o(e,i)&&Object.defineProperty(e,i,{enumerable:!0,get:t[i]})},n.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||Function("return this")()}catch(e){if("object"==typeof window)return window}}(),n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},(()=>{var e=[];n.O=function(t,i,s,o){if(i){o=o||0;for(var a=e.length;a>0&&e[a-1][2]>o;a--)e[a]=e[a-1];e[a]=[i,s,o];return}for(var l=1/0,a=0;a<e.length;a++){for(var i=e[a][0],s=e[a][1],o=e[a][2],r=!0,d=0;d<i.length;d++)(!1&o||l>=o)&&Object.keys(n.O).every(function(e){return n.O[e](i[d])})?i.splice(d--,1):(r=!1,o<l&&(l=o));if(r){e.splice(a--,1);var c=s();void 0!==c&&(t=c)}}return t}})(),(()=>{var e={980:0};n.O.j=function(t){return 0===e[t]};var t=function(t,i){var s=i[0],o=i[1],a=i[2],l,r,d=0;if(s.some(function(t){return 0!==e[t]})){for(l in o)n.o(o,l)&&(n.m[l]=o[l]);if(a)var c=a(n)}for(t&&t(i);d<s.length;d++)r=s[d],n.o(e,r)&&e[r]&&e[r][0](),e[r]=0;return n.O(c)},i=self.webpackChunkrustwebui_frontend=self.webpackChunkrustwebui_frontend||[];i.forEach(t.bind(null,0)),i.push=t.bind(null,i.push.bind(i))})();var i=n.O(void 0,["126","139"],function(){return n("5853")});i=n.O(i)})();