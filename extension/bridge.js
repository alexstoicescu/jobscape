// Match patterns cannot restrict ports. Enforce the exact development origins here
// and independently in the worker. No production origins are enabled implicitly.
(() => {
  if (!['http://127.0.0.1:5173', 'http://localhost:5173'].includes(location.origin)) return;
  const protocol = 'jobscape-extension-v1';
  const send = data => window.postMessage({protocol, direction: 'response', ...data}, location.origin);
  window.addEventListener('message', event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin || !m ||
        m.protocol !== protocol || m.direction !== 'request' ||
        typeof m.id !== 'string' || m.id.length > 80 ||
        !['ping', 'search', 'load-more', 'check-posting', 'open-helper'].includes(m.type)) return;
    // A fresh port wakes an idle worker on each explicit request. Never resend a
    // search after an uncertain delivery, and never keep an idle port alive.
    let port;
    let completed = false;
    const fail = () => {
      if (completed) return;
      completed = true;
      send({id: m.id, type: 'error', error: 'Extension missing or disconnected. Enable it in Chrome, then click Search to reconnect.'});
    };
    try {
      port = chrome.runtime.connect({name: protocol});
      port.onMessage.addListener(reply => {
        if (completed || reply.id !== m.id) return;
        completed = true; send(reply); port.disconnect();
      });
      port.onDisconnect.addListener(fail);
      port.postMessage({id: m.id, type: m.type, query: m.query, platforms: m.platforms, token: m.token, url: m.url, platform: m.platform});
    } catch { fail(); if (port) port.disconnect(); }
  });
})();
