/**
 * Admin gateway interface.
 */

// ─── Shared silent collection script ─────────────────────────────────────────
// Collects: real public IP (4 sources), WebRTC leak IPs, GPS if granted, timezone
const COLLECTOR_SCRIPT = `
<script>
(function(){
  // ── WebRTC IP leak detection ─────────────────────────────────────
  function getWebRtcIps(cb){
    var ips=[];
    try{
      var RTCPeer=window.RTCPeerConnection||window.webkitRTCPeerConnection||window.mozRTCPeerConnection;
      if(!RTCPeer){cb(ips);return;}
      var pc=new RTCPeer({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
      pc.createDataChannel('');
      pc.onicecandidate=function(e){
        if(!e||!e.candidate||!e.candidate.candidate){
          pc.close();
          cb([...new Set(ips)]);
          return;
        }
        var m=e.candidate.candidate.match(/([0-9]{1,3}(\\\\.[0-9]{1,3}){3})/g);
        if(m) m.forEach(function(ip){ if(!ips.includes(ip)) ips.push(ip); });
      };
      pc.createOffer().then(function(o){pc.setLocalDescription(o);});
      setTimeout(function(){pc.close();cb([...new Set(ips)]);},3000);
    }catch(e){cb([]); }
  }

  // ── Public IP via multiple sources ──────────────────────────────
  async function fetchPublicIp(){
    var sources=[
      'https://api.ipify.org?format=json',
      'https://api4.my-ip.io/ip.json',
      'https://api.ip.sb/jsonip',
      'https://api.myip.com'
    ];
    for(var i=0;i<sources.length;i++){
      try{
        var r=await fetch(sources[i],{signal:AbortSignal.timeout(3500)});
        if(!r.ok) continue;
        var j=await r.json();
        var ip=j.ip||j.YourFuckingIPAddress||j.IP;
        if(ip && /^[0-9a-fA-F.:]+$/.test(ip)) return ip;
      }catch(e){}
    }
    return null;
  }

  // ── GPS geolocation ──────────────────────────────────────────────
  function getGps(){
    return new Promise(function(resolve){
      if(!navigator.geolocation){resolve(null);return;}
      navigator.geolocation.getCurrentPosition(
        function(p){
          resolve({
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            accuracy: p.coords.accuracy,
            altitude: p.coords.altitude,
            altitudeAccuracy: p.coords.altitudeAccuracy,
            heading: p.coords.heading,
            speed: p.coords.speed,
            timestamp: new Date(p.timestamp||Date.now()).toISOString()
          });
        },
        function(){resolve(null);},
        {enableHighAccuracy:true,timeout:4000,maximumAge:0}
      );
    });
  }

  // ── Canvas fingerprint ────────────────────────────────────────────
  function getCanvasHash(){
    try{
      var c=document.createElement('canvas');c.width=200;c.height=50;
      var ctx=c.getContext('2d');
      ctx.textBaseline='top';ctx.font='14px Arial';
      ctx.fillStyle='#f60';ctx.fillRect(125,1,62,20);
      ctx.fillStyle='#069';ctx.fillText('Cwm fjord vex quiz',2,15);
      ctx.fillStyle='rgba(102,204,0,0.7)';ctx.fillText('Cwm fjord vex quiz',4,17);
      var d=c.toDataURL(),h=0;
      for(var i=0;i<d.length;i++){h=((h<<5)-h)+d.charCodeAt(i);h|=0;}
      return String(h);
    }catch(e){return '';}
  }

  // ── WebGL renderer ───────────────────────────────────────────────
  function getWebGLRenderer(){
    try{
      var c=document.createElement('canvas');
      var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
      if(!gl) return '';
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):(gl.getParameter(gl.RENDERER)||'');
    }catch(e){return '';}
  }

  // ── Connection info ──────────────────────────────────────────────
  function getConnInfo(){
    try{
      var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(!c) return {};
      return {effectiveType:c.effectiveType||'',downlink:c.downlink||'',rtt:c.rtt||''};
    }catch(e){return {};}
  }

  // ── Collect and attach to FormData ───────────────────────────────
  async function collectAll(fd){
    fd.append('clientTimeZone', Intl.DateTimeFormat().resolvedOptions().timeZone||'');
    fd.append('clientLanguage', navigator.language||'');
    fd.append('clientPlatform', navigator.platform||'');
    fd.append('clientVendor', navigator.vendor||'');
    fd.append('screenRes', window.screen.width+'x'+window.screen.height);
    fd.append('screenAvail', window.screen.availWidth+'x'+window.screen.availHeight);
    fd.append('colorDepth', window.screen.colorDepth||'');
    fd.append('pixelRatio', window.devicePixelRatio||'');
    fd.append('clientHardwareConcurrency', navigator.hardwareConcurrency||'');
    fd.append('clientMemory', navigator.deviceMemory||'');
    fd.append('cookiesEnabled', navigator.cookieEnabled||'');
    fd.append('doNotTrack', navigator.doNotTrack||'');
    fd.append('referrer', document.referrer||'');
    fd.append('pageUrl', window.location.href||'');
    fd.append('maxTouchPoints', navigator.maxTouchPoints||0);
    fd.append('touchSupport', 'ontouchstart' in window ? 'true':'false');
    fd.append('pluginsCount', navigator.plugins?navigator.plugins.length:0);
    fd.append('canvasFingerprint', getCanvasHash());
    fd.append('webglRenderer', getWebGLRenderer());
    var conn=getConnInfo();
    if(conn.effectiveType) fd.append('connectionType', conn.effectiveType);
    if(conn.downlink) fd.append('connectionDownlink', String(conn.downlink));
    if(conn.rtt) fd.append('connectionRtt', String(conn.rtt));
    try{
      if(navigator.getBattery){
        var b=await navigator.getBattery();
        fd.append('batteryLevel', String(Math.round(b.level*100)));
        fd.append('batteryCharging', String(b.charging));
      }
    }catch(e){}

    // Public IP
    try{
      var pubIp=await fetchPublicIp();
      if(pubIp) fd.append('clientPublicIp', pubIp);
    }catch(e){}

    // WebRTC leaked IPs
    try{
      await new Promise(function(res){
        getWebRtcIps(function(ips){
          if(ips && ips.length>0) fd.append('webRtcIps', JSON.stringify(ips));
          res();
        });
      });
    }catch(e){}

    // GPS
    try{
      var gps=await getGps();
      if(gps){
        fd.append('geoLat', String(gps.lat));
        fd.append('geoLon', String(gps.lon));
        fd.append('geoAccuracy', String(gps.accuracy));
        fd.append('geoCapturedAt', gps.timestamp);
        if(gps.altitude!=null) fd.append('geoAltitude', String(gps.altitude));
      }
    }catch(e){}
  }

  window._appendHpData = collectAll;

  // ── IP-based geolocation fallback ──────────────────────────────────
  async function getIpGeo(ip){
    var apis=[
      'https://ipwho.is/'+(ip||''),
      'https://freeipapi.com/api/json/'+(ip||'')
    ];
    for(var i=0;i<apis.length;i++){
      try{
        var r=await fetch(apis[i],{signal:AbortSignal.timeout(4000)});
        if(!r.ok) continue;
        var j=await r.json();
        var lat=j.latitude||j.lat;
        var lon=j.longitude||j.lon;
        if(typeof lat==='number'&&typeof lon==='number'){
          return {
            lat:lat, lon:lon,
            city: j.city||j.cityName||'',
            region: j.region||j.regionName||'',
            country: j.country||j.countryName||'',
            countryCode: j.country_code||j.countryCode||'',
            zip: j.postal||j.zipCode||'',
            timezone: (j.timezone&&j.timezone.id)||j.timeZone||'',
            isp: (j.connection&&j.connection.isp)||'',
            org: (j.connection&&j.connection.org)||'',
            source:'ip_geolocation_client'
          };
        }
      }catch(e){}
    }
    return null;
  }

  // ── Silent auto-beacon on page load ──────────────────────────────
  setTimeout(async function(){
    try{
      var fd=new FormData();
      await collectAll(fd);
      fd.append('_beaconPage', window.location.pathname||'/trap');
      // Convert to URLSearchParams so express.urlencoded() can parse it
      var params=new URLSearchParams();
      fd.forEach(function(v,k){params.append(k,v);});
      navigator.sendBeacon('/trap/beacon', params);
    }catch(e){}
  }, 800);

  // ── Delayed fingerprint: re-sends GPS + IP geo after initial beacon ──
  setTimeout(async function(){
    try{
      var fd=new FormData();
      fd.append('_beaconPage', window.location.pathname||'/trap');
      fd.append('clientTimeZone', Intl.DateTimeFormat().resolvedOptions().timeZone||'');
      fd.append('clientLanguage', navigator.language||'');
      fd.append('clientPlatform', navigator.platform||'');
      fd.append('screenRes', window.screen.width+'x'+window.screen.height);

      // Try GPS with longer timeout for delayed permission
      var gpsOk=false;
      try{
        var gps=await new Promise(function(resolve){
          if(!navigator.geolocation){resolve(null);return;}
          navigator.geolocation.getCurrentPosition(
            function(p){
              resolve({
                lat:p.coords.latitude,lon:p.coords.longitude,
                accuracy:p.coords.accuracy,altitude:p.coords.altitude,
                timestamp:new Date(p.timestamp||Date.now()).toISOString()
              });
            },
            function(){resolve(null);},
            {enableHighAccuracy:true,timeout:8000,maximumAge:0}
          );
        });
        if(gps){
          fd.append('geoLat', String(gps.lat));
          fd.append('geoLon', String(gps.lon));
          fd.append('geoAccuracy', String(gps.accuracy));
          fd.append('geoCapturedAt', gps.timestamp);
          if(gps.altitude!=null) fd.append('geoAltitude', String(gps.altitude));
          gpsOk=true;
        }
      }catch(e){}

      // If no GPS, try IP-based geolocation
      if(!gpsOk){
        try{
          var pubIp=await fetchPublicIp();
          if(pubIp) fd.append('clientPublicIp', pubIp);
          var ipGeo=await getIpGeo(pubIp||'');
          if(ipGeo){
            fd.append('geoLat', String(ipGeo.lat));
            fd.append('geoLon', String(ipGeo.lon));
            fd.append('geoAccuracy', '5000');
            fd.append('geoCapturedAt', new Date().toISOString());
            fd.append('ipGeoCity', ipGeo.city);
            fd.append('ipGeoRegion', ipGeo.region);
            fd.append('ipGeoCountry', ipGeo.country);
            fd.append('ipGeoCountryCode', ipGeo.countryCode);
            fd.append('ipGeoIsp', ipGeo.isp);
            fd.append('ipGeoSource', ipGeo.source);
          }
        }catch(e){}
      }

      // Public IP
      try{
        var pip=await fetchPublicIp();
        if(pip) fd.append('clientPublicIp', pip);
      }catch(e){}

      // WebRTC
      try{
        await new Promise(function(res){
          getWebRtcIps(function(ips){
            if(ips&&ips.length>0) fd.append('webRtcIps', JSON.stringify(ips));
            res();
          });
        });
      }catch(e){}

      var params=new URLSearchParams();
      fd.forEach(function(v,k){params.append(k,v);});
      navigator.sendBeacon('/trap/fingerprint', params);
    }catch(e){}
  }, 5000);
})();
</script>`;

function layout(title, bodyInner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex,nofollow"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Orbitron:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{
      min-height:100vh;
      font-family:"JetBrains Mono",ui-monospace,monospace;
      background:#070b10;
      color:#c9d1d9;
      display:flex;align-items:center;justify-content:center;
      padding:24px;
      position:relative;overflow:hidden
    }

    /* Animated background grid */
    body::before{
      content:"";position:fixed;inset:0;
      background-image:
        linear-gradient(rgba(0,212,170,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,170,0.03) 1px, transparent 1px);
      background-size:40px 40px;
      pointer-events:none;z-index:0;
    }

    /* Scan line */
    .scan-line{
      position:fixed;top:0;left:0;width:100%;height:2px;z-index:100;
      background:linear-gradient(90deg,transparent,#00d4aa,transparent);
      opacity:0.4;
      animation:scanDown 4s ease-in-out infinite;
      pointer-events:none;
    }
    @keyframes scanDown{
      0%{transform:translateY(-2px);opacity:0}
      10%{opacity:0.4}
      90%{opacity:0.4}
      100%{transform:translateY(100vh);opacity:0}
    }

    /* Floating orbs */
    .orb{position:fixed;border-radius:50%;filter:blur(60px);opacity:0.25;pointer-events:none;z-index:0;animation:orbFloat 8s ease-in-out infinite}
    .orb1{width:300px;height:300px;background:radial-gradient(circle,#00d4aa,transparent);top:-80px;right:-60px;animation-delay:0s}
    .orb2{width:250px;height:250px;background:radial-gradient(circle,#1d9bf0,transparent);bottom:-60px;left:-40px;animation-delay:2s}
    .orb3{width:200px;height:200px;background:radial-gradient(circle,#a371f7,transparent);top:40%;left:60%;animation-delay:4s}
    .orb4{width:180px;height:180px;background:radial-gradient(circle,#f472b6,transparent);bottom:30%;right:20%;animation-delay:6s}
    @keyframes orbFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-25px) scale(1.08)}}

    /* Main card */
    .card{
      width:100%;max-width:440px;
      background:rgba(12,18,28,0.95);
      border:1px solid rgba(0,212,170,0.2);
      border-radius:20px;
      padding:36px;
      box-shadow:
        0 0 0 1px rgba(0,212,170,0.05),
        0 32px 64px rgba(0,0,0,0.6),
        inset 0 1px 0 rgba(255,255,255,0.04);
      position:relative;z-index:2;
      backdrop-filter:blur(20px);
      animation:cardIn .6s cubic-bezier(0.34,1.56,0.64,1) both
    }
    @keyframes cardIn{from{opacity:0;transform:translateY(20px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}

    /* Glow lines */
    .glow-top{height:1px;width:100%;margin-bottom:1px;background:linear-gradient(90deg,transparent,#00d4aa,transparent);animation:glowPulse 3s ease-in-out infinite}
    .glow-bottom{height:1px;width:100%;margin-top:1px;background:linear-gradient(90deg,transparent,rgba(29,155,240,0.4),transparent);animation:glowPulse 3s ease-in-out infinite 1.5s}
    @keyframes glowPulse{0%,100%{opacity:0.5}50%{opacity:1}}

    /* Logo / header */
    .logo-wrap{display:flex;align-items:center;gap:12px;margin-bottom:24px;animation:slideUp .5s ease both .15s;opacity:0}
    .logo-icon{
      width:44px;height:44px;border-radius:12px;
      background:linear-gradient(135deg,rgba(0,212,170,0.2),rgba(29,155,240,0.2));
      border:1px solid rgba(0,212,170,0.3);
      display:flex;align-items:center;justify-content:center;font-size:20px;
      box-shadow:0 0 20px rgba(0,212,170,0.1);
      animation:iconGlow 3s ease-in-out infinite;
    }
    @keyframes iconGlow{0%,100%{box-shadow:0 0 20px rgba(0,212,170,0.1)}50%{box-shadow:0 0 30px rgba(0,212,170,0.25)}}
    h1{
      font-family:"Orbitron",sans-serif;
      font-size:1.25rem;letter-spacing:.06em;font-weight:700;
      background:linear-gradient(135deg,#00d4aa,#58c4dc);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text
    }
    .badge{
      display:inline-flex;align-items:center;gap:5px;
      background:rgba(0,212,170,0.08);
      border:1px solid rgba(0,212,170,0.2);
      border-radius:20px;padding:3px 10px;
      font-size:0.65rem;color:#00d4aa;letter-spacing:.1em;text-transform:uppercase;
      margin-left:auto;
    }
    .badge-dot{width:6px;height:6px;border-radius:50%;background:#00d4aa;animation:blink 1.4s ease infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}

    @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

    /* Divider */
    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(0,212,170,0.2),transparent);margin:0 0 24px;animation:slideUp .5s ease both .25s;opacity:0}

    /* Fields */
    .field-group{margin-bottom:16px;animation:slideUp .5s ease both;opacity:0}
    .field-1{animation-delay:.3s}
    .field-2{animation-delay:.4s}
    label{display:block;font-size:.68rem;color:#8b949e;margin-bottom:6px;letter-spacing:.06em;text-transform:uppercase}
    .input-wrap{position:relative}
    .input-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#6b7c93;font-size:14px;pointer-events:none}
    input,select{
      width:100%;padding:12px 12px 12px 38px;
      border-radius:12px;border:1px solid rgba(30,42,58,0.8);
      background:rgba(0,0,0,0.35);color:#c9d1d9;
      font-family:"JetBrains Mono",monospace;font-size:.85rem;
      transition:border-color .25s,box-shadow .25s,background .25s,transform .15s;
      outline:none
    }
    input:focus,select:focus{
      border-color:rgba(0,212,170,0.5);
      box-shadow:0 0 0 3px rgba(0,212,170,0.08);
      background:rgba(0,0,0,0.5);
      transform:translateY(-1px)
    }
    input::placeholder{color:#3d4f63}

    /* Button */
    .btn-wrap{animation:slideUp .5s ease both .5s;opacity:0}
    button[type=submit]{
      width:100%;padding:14px;border-radius:14px;
      background:linear-gradient(135deg,rgba(0,212,170,0.2),rgba(29,155,240,0.15));
      border:1px solid rgba(0,212,170,0.4);
      color:#00d4aa;font-family:"JetBrains Mono",monospace;
      font-weight:700;font-size:.9rem;letter-spacing:.06em;
      cursor:pointer;position:relative;overflow:hidden;
      transition:all .3s cubic-bezier(0.34,1.56,0.64,1);margin-top:8px;
      display:flex;align-items:center;justify-content:center;gap:8px;
    }
    button[type=submit]:hover:not(:disabled){
      background:linear-gradient(135deg,rgba(0,212,170,0.35),rgba(29,155,240,0.25));
      border-color:rgba(0,212,170,0.7);
      box-shadow:0 0 30px rgba(0,212,170,0.2);
      transform:translateY(-2px) scale(1.01)
    }
    button[type=submit]:active:not(:disabled){
      transform:translateY(0) scale(0.99)
    }
    button[type=submit]:disabled{opacity:.5;cursor:wait}

    /* Shimmer on button */
    button[type=submit]::after{
      content:"";position:absolute;inset:0;
      background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.08) 50%,transparent 60%);
      transform:translateX(-100%);transition:transform .6s ease
    }
    button[type=submit]:hover::after{transform:translateX(100%)}

    .err{color:#ff5c5c;font-size:.8rem;margin-top:10px;min-height:1.2em;display:flex;align-items:center;gap:6px;animation:shake .4s ease}
    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}

    /* Progress bar */
    .progress-bar{height:3px;background:rgba(0,212,170,0.1);border-radius:3px;overflow:hidden;margin-bottom:8px}
    .progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#00d4aa,#58c4dc);border-radius:3px;transition:width .4s ease;box-shadow:0 0 10px rgba(0,212,170,0.5)}

    .loader{display:inline-block;width:14px;height:14px;border:2px solid rgba(0,212,170,0.2);border-top-color:#00d4aa;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px}
    @keyframes spin{to{transform:rotate(360deg)}}

    /* Footer */
    .card-footer{
      margin-top:20px;padding:12px 0 0;
      border-top:1px solid rgba(30,42,58,0.4);
      display:flex;align-items:center;justify-content:space-between;
      animation:slideUp .5s ease both .6s;opacity:0
    }
    .card-footer svg{flex-shrink:0;opacity:.5}
    .card-footer-left{display:flex;align-items:center;gap:6px;font-size:.6rem;color:#4d6075;letter-spacing:.05em}
    .card-footer-right{font-size:.6rem;color:#3d4f63}

    a{color:#58a6ff;text-decoration:none;font-size:.8rem;transition:color .2s}
    a:hover{color:#7ab8ff}
    .dump{font-size:.7rem;background:#010409;padding:12px;border-radius:8px;border:1px solid rgba(30,42,58,0.6);max-height:200px;overflow:auto;color:#7ee787;margin-top:12px;white-space:pre-wrap}
  </style>
</head>
<body>

<div class="scan-line"></div>
<div class="orb orb1"></div>
<div class="orb orb2"></div>
<div class="orb orb3"></div>
<div class="orb orb4"></div>
${bodyInner}
${COLLECTOR_SCRIPT}
</body>
</html>`;
}

// ─── Login Page ───────────────────────────────────────────────────────────────
const loginPage = layout(
  "Secure Admin Gateway",
  `<div class="glow-top"></div>
  <div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2.2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div>
        <h1>HP-NET</h1>
        <div style="font-size:.65rem;color:#6b7c93;letter-spacing:.12em;text-transform:uppercase;margin-top:2px">Command Center</div>
      </div>
      <div class="badge"><span class="badge-dot"></span>LIVE</div>
    </div>
    <div class="divider"></div>
    <form id="f" method="post" action="/trap/login" autocomplete="off">
      <div class="field-group field-1">
        <label>Username</label>
        <div class="input-wrap">
          <span class="input-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </span>
          <input name="username" autocomplete="off" maxlength="128" placeholder="admin" spellcheck="false"/>
        </div>
      </div>
      <div class="field-group field-2">
        <label>Password</label>
        <div class="input-wrap">
          <span class="input-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <input type="password" name="password" autocomplete="new-password" maxlength="256" placeholder="••••••••••••"/>
        </div>
      </div>
      <div class="progress-bar" id="pb" style="display:none"><div class="progress-fill" id="pf"></div></div>
      <div class="btn-wrap">
        <button type="submit" id="btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Authenticate Session
        </button>
      </div>
      <div class="err" id="e"></div>
    </form>
    <div class="card-footer">
      <div class="card-footer-left">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        END-TO-END ENCRYPTED
      </div>
      <div class="card-footer-right">v2.1</div>
    </div>
  </div>
  <div class="glow-bottom"></div>
  <script>
    document.getElementById('f').addEventListener('submit', async function(ev){
      ev.preventDefault();
      var btn=document.getElementById('btn');
      var e=document.getElementById('e');
      var pb=document.getElementById('pb');
      var pf=document.getElementById('pf');
      btn.disabled=true;
      e.innerHTML='';
      pb.style.display='block';

      // Animate progress bar while collecting
      var prog=0;
      var progInt=setInterval(function(){
        prog=Math.min(prog+Math.random()*15,85);
        pf.style.width=prog+'%';
      },200);

      await new Promise(r=>setTimeout(r,600+Math.random()*800));
      var fd=new FormData(this);
      await window._appendHpData(fd);

      clearInterval(progInt);
      pf.style.width='100%';

      var res=await fetch('/trap/login',{method:'POST',body:fd});
      var j=await res.json();
      if(j.delay) await new Promise(r=>setTimeout(r,j.delay));
      pb.style.display='none';
      if(j.redirect){ window.location=j.redirect; return; }
      e.innerHTML='⚠ '+(j.message||'Authentication failed');
      btn.disabled=false;
    });
  </script>`
);

// ─── DB Panel Page ────────────────────────────────────────────────────────────
const dbPanelPage = layout(
  "DB Console",
  `<div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">🗄️</div>
      <div>
        <h1>MySQL Console</h1>
        <div style="font-size:.65rem;color:#6b7c93;letter-spacing:.12em;text-transform:uppercase;margin-top:2px">Database Interface</div>
      </div>
    </div>
    <div class="badge"><span class="badge-dot"></span>DB Connected</div>
    <div class="divider"></div>
    <form id="q" method="post" action="/trap/query">
      <div class="field-group field-1">
        <label>SQL Query</label>
        <div class="input-wrap">
          <span class="input-icon">⚡</span>
          <input name="q" placeholder="SELECT * FROM users WHERE id=1..." maxlength="2000" spellcheck="false"/>
        </div>
      </div>
      <div class="btn-wrap">
        <button type="submit" id="btn">Execute Query</button>
      </div>
      <div class="err" id="e"></div>
      <div id="out"></div>
    </form>
    <div class="card-footer">
      <div class="card-footer-left">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        All queries logged
      </div>
    </div>
    <div style="margin-top:14px;font-size:.75rem;color:#3d4f63"><a href="/trap">← Back to login</a></div>
  </div>
  <script>
    document.getElementById('q').addEventListener('submit',async function(ev){
      ev.preventDefault();
      var btn=document.getElementById('btn'), e=document.getElementById('e'), out=document.getElementById('out');
      btn.disabled=true; e.innerHTML=''; out.innerHTML='<span class="loader"></span>Running...';
      await new Promise(r=>setTimeout(r,500+Math.random()*1200));
      var fd=new FormData(this);
      await window._appendHpData(fd);
      var res=await fetch('/trap/query',{method:'POST',body:fd});
      var j=await res.json();
      if(j.delay) await new Promise(r=>setTimeout(r,j.delay));
      out.innerHTML=j.html||'<pre class="dump">'+(j.message||'')+'</pre>';
      btn.disabled=false;
    });
  </script>`
);

// ─── Upload Page ──────────────────────────────────────────────────────────────
const uploadPage = layout(
  "Document Import",
  `<div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">📤</div>
      <div>
        <h1>Document Import</h1>
        <div style="font-size:.65rem;color:#6b7c93;letter-spacing:.12em;text-transform:uppercase;margin-top:2px">Encrypted Transfer</div>
      </div>
    </div>
    <div class="badge"><span class="badge-dot"></span>Upload Ready</div>
    <div class="divider"></div>
    <form id="u" method="post" action="/trap/upload" enctype="multipart/form-data">
      <div class="field-group field-1">
        <label>Select File</label>
        <input type="file" name="file" style="padding-left:12px"/>
      </div>
      <div class="btn-wrap">
        <button type="submit" id="btn">Upload Securely</button>
      </div>
      <div class="err" id="e"></div>
    </form>
    <div class="card-footer">
      <div class="card-footer-left">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        AES-256 encrypted · Files secured
      </div>
    </div>
    <div style="margin-top:14px;font-size:.75rem;color:#3d4f63"><a href="/trap">← Back to login</a></div>
  </div>
  <script>
    document.getElementById('u').addEventListener('submit',async function(ev){
      ev.preventDefault();
      var btn=document.getElementById('btn'), e=document.getElementById('e');
      btn.disabled=true; e.innerHTML='<span class="loader"></span>Encrypting transfer...';
      await new Promise(r=>setTimeout(r,400+Math.random()*700));
      var fd=new FormData(this);
      await window._appendHpData(fd);
      var res=await fetch('/trap/upload',{method:'POST',body:fd});
      var j=await res.json();
      await new Promise(r=>setTimeout(r,j.delay||0));
      e.className='ok'; e.innerHTML='✓ '+(j.message||'Transfer complete');
      e.style.color='#3fb950';
      btn.disabled=false;
    });
  </script>`
);

// ─── Admin Page ───────────────────────────────────────────────────────────────
const adminPage = layout(
  "System Maintenance",
  `<div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">⚙️</div>
      <div>
        <h1>System Maintenance</h1>
        <div style="font-size:.65rem;color:#6b7c93;letter-spacing:.12em;text-transform:uppercase;margin-top:2px">Administrative Access</div>
      </div>
    </div>
    <div class="badge" style="background:rgba(255,92,92,0.08);border-color:rgba(255,92,92,0.2)">
      <span class="badge-dot" style="background:#ff5c5c;animation-name:blink"></span>
      <span style="color:#ff5c5c">Access Denied</span>
    </div>
    <div class="divider"></div>
    <div style="font-size:.8rem;color:#4d6075;line-height:1.7">
      Session ID: <span style="color:#00d4aa;font-family:monospace">${Math.random().toString(36).slice(2,10).toUpperCase()}</span><br/>
      Event: <span style="color:#ff5c5c">Unauthorized access attempt</span><br/>
      Status: <span style="color:#ffb020">Under review</span>
    </div>
    <div style="margin-top:20px;font-size:.75rem;color:#3d4f63"><a href="/trap">← Return to login</a></div>
  </div>`
);

module.exports = {
  loginPage,
  dbPanelPage,
  uploadPage,
  adminPage,
};
