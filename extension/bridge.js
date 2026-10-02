// Match patterns cannot restrict ports. Enforce the exact development origins here
// and independently in the worker. No production origins are enabled implicitly.
(() => {
  if (!['http://127.0.0.1:5173', 'http://localhost:5173'].includes(location.origin)) return;
  const protocol = 'jobscape-extension-v1';
  let port;
  const send = data => window.postMessage({protocol, direction: 'response', ...data}, location.origin);
  function connect() {
    port = chrome.runtime.connect({name: protocol});
    port.onMessage.addListener(send);
    port.onDisconnect.addListener(() => { port = undefined; send({type: 'disconnected'}); });
  }
  window.addEventListener('message', event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin || !m ||
        m.protocol !== protocol || m.direction !== 'request' ||
        typeof m.id !== 'string' || m.id.length > 80 ||
        !['ping', 'search', 'open-helper'].includes(m.type)) return;
    if (!port) connect();
    try { port.postMessage({id: m.id, type: m.type, query: m.query, platforms: m.platforms}); }
    catch { port = undefined; send({id: m.id, type: 'error', error: 'Extension disconnected. Reload JobScape after loading the extension.'}); }
  });
})();
