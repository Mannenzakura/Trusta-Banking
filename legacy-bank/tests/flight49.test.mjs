import test from 'node:test';import assert from 'node:assert/strict';
import {duffelTestClient} from '../worker/duffel-test-client.mjs';
import {flightFX} from '../worker/flight-fx49.mjs';
import {cny49} from '../public/bank/flight-money49.js';
import {wait49,shortRoute49,fullRoute49} from '../public/bank/flight-route49.js';
import {fareCabin49,groupFlights} from '../public/bank/flight-journey47.js';
const env={DUFFEL_TEST_ENABLED:'true',DUFFEL_TEST_TOKEN:'duffel_test_fixture'};
test('multi city supports gaps and preserves slice order and first-class filter',async()=>{
 let sent;const c=duffelTestClient(env,async(_,o)=>{sent=JSON.parse(o.body).data;return Response.json({data:{live_mode:false,offers:[]}})});
 const slices=[{from:'SZX',to:'SHA',date:'2099-01-01'},{from:'PEK',to:'CAN',date:'2099-01-03'},{from:'CAN',to:'SZX',date:'2099-01-04'}];
 await c.search({slices,cabin:'first'});assert.equal(sent.cabin_class,'first');assert.equal(sent.slices[1].origin,'PEK');assert.equal(sent.slices.length,3);
 await assert.rejects(c.search({slices:[...slices,{from:'CAN',to:'SZX',date:'2098-01-01'}]}));
 await assert.rejects(c.search({slices:Array(5).fill(slices[0])}));await assert.rejects(c.search({slices:[{...slices[0],to:'SZX'}]}));
});
test('reference currency uses verified rate, never relabels original amount',async()=>{
 const now=Date.now();const fx=await flightFX(async()=>Response.json({result:'success',base_code:'CNY',time_last_update_unix:Math.floor(now/1000),rates:{EUR:0.125,CNY:1}}),now);
 const o={amount:'100.00',currency:'EUR',fx};assert.equal(cny49(o),'约 ¥800.00');assert.equal(o.amount,'100.00');assert.equal(o.currency,'EUR');assert.equal(cny49(o,'25.00'),'约 ¥200.00');
 assert.match(cny49({...o,fx:null}),/暂不可用/);assert.equal(await flightFX(async()=>Response.json({result:'success',base_code:'CNY',time_last_update_unix:1,rates:{EUR:0.125}}),now),null);
});
const a={from:'SZX',to:'PEK',departure:'2026-12-01T10:00:00',arrival:'2026-12-01T13:00:00',number:'CA1',cabins:[{class:'economy'}]};
const b={from:'PEK',to:'SHA',departure:'2026-12-01T15:30:00',arrival:'2026-12-01T18:00:00',number:'CA2',cabins:[{class:'economy'}]};
test('connection summary uses end-to-end times with full segments and airport-change disclosure',()=>{
 const o={slices:[{duration:'PT8H',segments:[a,b]}]},e=String;const html=shortRoute49(o,e);assert.match(html,/1 次中转/);assert.match(html,/18:00/);assert.match(fullRoute49(o,e),/2小时30分钟/);
 assert.match(fullRoute49({slices:[{segments:[a,{...b,from:'PKX'}]}]},e),/需换机场/);assert.equal(wait49(a,{...b,from:'PKX'}),'等待时间待确认');
});
test('same flight cabin offers group together and mixed cabins remain explicit',()=>{
 const x={id:'1',amount:'50',currency:'EUR',slices:[{segments:[a,b]}]},y={...x,id:'2',slices:[{segments:[{...a,cabins:[{class:'business'}]},b]}]};assert.equal(groupFlights([x,y]).length,1);assert.equal(fareCabin49(y),'mixed');assert.equal(fareCabin49(x),'economy');
});
