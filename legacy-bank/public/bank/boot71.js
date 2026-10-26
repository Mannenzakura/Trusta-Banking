(() => {
  let ready = false;
  window.addEventListener('bank-ready', () => { ready = true; });
  const show = () => {
    if (ready || !document.querySelector('#app > .boot')) return;
    const root = document.getElementById('app');
    root.replaceChildren();
    const panel = document.createElement('main'); panel.className = 'boot';
    const title = document.createElement('h1'); title.textContent = '个人银行加载未完成';
    const hint = document.createElement('p'); hint.textContent = '网络或页面资源加载超时。请重新连接；你的账户和记录不会被清除。';
    const link = document.createElement('a'); link.className = 'btn primary'; link.textContent = '重新连接';
    link.href = '/bank/?v=boot71&retry=' + Date.now();
    panel.append(title, hint, link); root.append(panel);
  };
  const timer = setTimeout(show, 35000);
  import('/bank/app.js?v=boot71').then(() => clearTimeout(timer)).catch(() => { clearTimeout(timer); show(); });
})();
