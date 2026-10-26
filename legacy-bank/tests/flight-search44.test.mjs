import test from 'node:test';
import assert from 'node:assert/strict';
import {directory,matchCities,availableCities} from '../public/bank/airport-directory44.js';
import {routeZone44} from '../public/bank/flight-search44.js';
test('city directory supports global airports and Chinese, pinyin, IATA search',()=>{assert.ok(directory.length>4000);for(const t of ['重庆','chongqing','CKG'])assert.ok(matchCities('domestic','SZX',t).some(a=>a.id==='CKG'));assert.ok(matchCities('international','SZX','LHR').some(a=>a.id==='LHR'));});
test('region is enforced before city selection, both directions',()=>{for(const zone of ['domestic','hmt','international'])for(const other of ['SZX','HKG','NRT'])for(const a of availableCities(zone,other)){assert.equal(routeZone44(a.id,other),zone);assert.notEqual(a.id,other);}assert.ok(!matchCities('domestic','SZX','东京').length);assert.ok(!matchCities('hmt','SZX','SHA').some(a=>a.id==='SHA'));});
