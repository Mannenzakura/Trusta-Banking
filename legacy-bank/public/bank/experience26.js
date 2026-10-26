// Shared presentation layer. Moves existing form nodes without changing names or handlers.
export function enhanceExperience(root, page) {
  if (!root) return;
  root.classList.add('experience26');
  if(page==='transfer') {
    const own=[...root.querySelectorAll('details.plan-composer')].find(x=>x.querySelector('summary')?.textContent.includes('本人卡间转账'));
    const bank=root.querySelector('form[data-form="bankTransfer"]')?.closest('details');
    const journey=root.querySelector('.transfer-journey');
    const oldTabs=root.querySelector('.journey-tabs');
    if(journey && bank){
      const tabs=document.createElement('div');tabs.className='method-picker';tabs.setAttribute('aria-label','选择转账方式');
      const choices=[['常用收款人','保存的联系人','transfer'],['银行卡转账','输入姓名与卡号','bank'],['本人卡间','调配各卡余额','own'],['AA 收款','与朋友分摊','split']];
      const sections=[journey,bank,own].filter(Boolean);
      const select=(key)=>{sections.forEach(x=>x.hidden=true);oldTabs.hidden=true;
        if(key==='bank') {bank.hidden=false;bank.open=true;}
        else if(key==='own'&&own){own.hidden=false;own.open=true;}
        else {journey.hidden=false;const desired=oldTabs.querySelector(`[data-tab="${key}"]`);if(desired&&!desired.classList.contains('selected'))desired.click();}
        tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===key)));
      };
      for(const [name,desc,key] of choices){const b=document.createElement('button');b.type='button';b.dataset.method=key;const strong=document.createElement('strong');strong.textContent=name;const small=document.createElement('small');small.textContent=desc;b.append(strong,small);b.addEventListener('click',()=>select(key));tabs.append(b);}
      root.querySelector('.heading').after(tabs);select(oldTabs.querySelector('.selected')?.dataset.tab||'transfer');
    }
  }
  if(page==='cards'){
    const business=root.querySelector('.credit-hub')||root.querySelector('.debit-hub');
    const studio=root.querySelector('.card-showroom');const settings=root.querySelector('.card-control-room');
    if(studio&&settings){const bar=document.createElement('div');bar.className='workspace-switch';bar.setAttribute('aria-label','银行卡服务');
      const choices=[...(business?[['账户与账单',business]]:[]),['卡面定制',studio],['限额与安全',settings]];
      choices.forEach(([label,panel],i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(i===0));panel.hidden=i!==0;b.addEventListener('click',()=>{choices.forEach(([,p])=>p.hidden=p!==panel);bar.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});bar.append(b);});
      root.querySelector('.wallet-note').after(bar);root.querySelector('.card-workspace').classList.add('card-workspace-focused');
    }
  }
  if(page==='gold'){
    for(const article of root.querySelectorAll('.retail-record')){
      const details=document.createElement('details');details.className='gold-record-detail';const summary=document.createElement('summary');
      const first=article.querySelector('strong');if(!first)continue;const heading=document.createElement('strong');heading.textContent=first.textContent;summary.append(heading);
      const texts=[...article.querySelectorAll('p')];const date=document.createElement('small');date.textContent=texts[0]?.textContent||'查看明细';summary.append(date);
      details.append(summary);article.before(details);details.append(article);
    }
  }
  const titles={fx:['参考汇率换算','选择币种并输入金额，结果仅作参考，不发起换汇。'],eventEdit:['调整活动安排','修改时间、预算和联动事项。'],bankTransfer:['收款账户','请核对姓名、银行和卡号，下一步再确认交易。'],ownTransfer:['在自己的卡之间转账','分别核对转出与转入账户，余额和限额按卡计算。'],split:['创建一笔 AA 收款','确认总额与参与人，查看每个人的分摊结果。'],contact:['保存收款账户','保存后仍需在每次转账时核对信息。'],event:['安排重要日程','设置时间与预算，再确认联动事项。'],workflow:['创建自动办理计划','先填写活动安排，核对后才授权预留预算。'],creditSpend:['记录消费','消费计入这张信用卡的账单和已用额度。'],creditRepay:['偿还非分期欠款','分期请到分期计划还款；这里仅偿还普通消费欠款。'],cardApply:['添加一张卡','选择卡种与账户类别，查看相应额度规则。'],limit:['调整单笔交易额度','新额度提交核对后生效。'],profile:['个人资料','管理称呼与偏好。'],changePassword:['更新安全凭证','验证原密码后设置新密码。'],planPayment:['安排计划付款','核对商户与金额后，从计划预算中执行。']};
  for(const form of root.querySelectorAll('form[data-form]')){
    const spec=titles[form.dataset.form];if(!spec||form.dataset.enhanced)continue;
    form.dataset.enhanced='true';form.classList.add('service-form');
    const head=document.createElement('header');head.className='service-form-heading';const h=document.createElement('h3');h.textContent=spec[0];const p=document.createElement('p');p.textContent=spec[1];head.append(h,p);form.prepend(head);
  }
  const risk=root.querySelector('.risk-questionnaire');
  if(risk){const fields=[...risk.querySelectorAll(':scope > .field')];[['个人阶段与投资经历',0,3],['财务状况与资金安排',3,6],['投资目标与风险承受',6,10]].forEach(([title,start,end],i)=>{const section=document.createElement('fieldset');section.className='assessment-section';const legend=document.createElement('legend');legend.textContent=`0${i+1} · ${title}`;section.append(legend);fields.slice(start,end).forEach(f=>section.append(f));risk.insertBefore(section,risk.querySelector('button'));});}
  for(const pre of root.querySelectorAll('.receipt-document pre')){
    const lines=pre.textContent.split('\n');const sheet=document.createElement('div');sheet.className='receipt-sheet';
    for(const [i,line] of lines.entries()){if(i<2){const p=document.createElement(i?'p':'h3');p.textContent=line;sheet.append(p);continue;}const row=document.createElement('div');const at=line.indexOf('：');const label=document.createElement('span');const value=document.createElement('strong');label.textContent=at>=0?line.slice(0,at):'明细';value.textContent=at>=0?line.slice(at+1):line;row.append(label,value);sheet.append(row);}pre.replaceWith(sheet);
  }
  root.querySelectorAll('.product-purchase input[name="amount"]').forEach(input=>{input.removeAttribute('style');input.inputMode='decimal';const label=document.createElement('label');label.className='purchase-amount';label.textContent='申购金额（元）';input.before(label);label.append(input);});
}
