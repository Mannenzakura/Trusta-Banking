import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCopy} from '../public/bank/business-copy.js';
test('business copy covers confirmations, historical ledger, products and receipts',()=>{
 const examples=['确认模拟转账','取消模拟代扣','模拟周期代扣','申请模拟借记卡','模拟开卡成功 · 尾号 1234','演示按本金赎回，不编造实际收益','固定演示价 ¥800/克 · 模拟克数 1.000000','个人银行 · 模拟操作回执\n回执编号：abc-123\n金额：CNY 12.34','存款流程模拟，演示到期取回本金'];
 for(const input of examples){const output=businessCopy(input);assert.doesNotMatch(output,/模拟|演示/);assert.equal(businessCopy(output),output);}
 assert.equal(businessCopy('固定演示价 ¥800/克 · 模拟克数 1.000000'),'测试成交价 ¥800/克 · 持有克数 1.000000');
 assert.equal(businessCopy('金额：CNY 12.34\n回执编号：abc-123'),'金额：CNY 12.34\n回执编号：abc-123');
 assert.equal(businessCopy('测试模式 · 免密码'),'测试模式 · 免密码');
 assert.equal(businessCopy('测试环境回执，不具有真实银行凭证效力'),'测试环境回执，不具有真实银行凭证效力');
});
