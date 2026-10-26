export function fxMarket42(m,{stamp,btn}){
 const r=m?.rates;
 return `<section class="quote-board"><header class="quote-header"><div><span>外汇市场</span><h2>人民币参考牌价</h2></div>${btn('刷新汇率','marketRefresh')}</header><p>每 1 单位外币折合人民币；按日更新，不作为银行成交价。</p><div class="quote-fx-grid">${r?Object.entries(r.values).map(([k,v])=>`<article><h3>${k}</h3><strong>¥ ${(1/v).toFixed(4)}</strong><p>1 ${k} / CNY</p></article>`).join(''):'<p role="status">暂未取得汇率，请稍后刷新。</p>'}</div><p>${r?(r.stale?'数据已延迟 · ':'数据日期 · ')+stamp(r.updatedAt):''}</p><details><summary>来源与报价说明</summary><p><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Exchange Rate API</a> 日参考汇率。下方外币账户使用固定测试成交价，两者分别展示，不混算收益。</p></details></section>`;
}
