import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { mock, id } from './fixtures.mjs';
const out='.impeccable/review/app';
const routes=[['dashboard','/app'],['items','/app/barang'],['item-new','/app/barang/baru'],['item-detail',`/app/barang/${id(100)}`],['item-edit',`/app/barang/${id(100)}/edit`],['passport',`/app/barang/${id(100)}/passport`],['assessments',`/app/barang/${id(100)}/penilaian`],['assessment-new',`/app/barang/${id(100)}/penilaian/baru`],['assessment-detail',`/app/barang/${id(100)}/penilaian/${id(310)}`],['care',`/app/barang/${id(100)}/perbaikan`],['listings','/app/listings'],['listing-new','/app/listings/new'],['listing-detail',`/app/listings/${id(400)}`],['offers','/app/penawaran'],['transactions','/app/transaksi'],['transaction-detail',`/app/transaksi/${id(600)}`],['messages','/app/pesan'],['thread',`/app/pesan/${id(700)}`],['impact','/app/impact'],['profile','/app/profil'],['correction',`/app/koreksi/${id(950)}`]];
const browser=await chromium.launch({headless:true});const results=[];
async function capture(name,url,width,config={}) {
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const runtime=[];page.on('pageerror',e=>runtime.push(e.message));await mock(page,config);
 await page.goto('http://localhost:3000'+url);
 await page.locator('#account-main').waitFor();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.account-shell')).backgroundColor==='rgb(255, 255, 255)');
 await page.waitForFunction(()=>document.querySelector('#account-main h1')||document.querySelector('#account-main [role="alert"]'));
 await page.waitForFunction(()=>!document.querySelector('#account-main .account-skeleton, #account-main .loading-line'),null,{timeout:15000});
 await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete));
 const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,toolbarTop:document.querySelector('.account-toolbar').getBoundingClientRect().top,heading:document.querySelector('main h1')?.textContent,gridColumns:document.querySelector('.item-grid')?getComputedStyle(document.querySelector('.item-grid')).gridTemplateColumns:null,bodyBackground:getComputedStyle(document.querySelector('.account-shell')).backgroundColor,inputs:[...document.querySelectorAll('main input:not([type="checkbox"]):not([type="radio"]), main select, main textarea')].slice(0,3).map(el=>({font:getComputedStyle(el).fontSize,height:el.getBoundingClientRect().height})),overflowElements:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(el).position!=='fixed').slice(0,8).map(el=>el.className)}));
 const file=`${out}/${name}-${width}.png`;await page.screenshot({path:file,fullPage:true});results.push({name,url,width,file,runtime,...metrics});console.log(`${name} ${width}: ${metrics.document<=width?'fit':'OVERFLOW'} ${runtime.length?'RUNTIME ERROR':''}`);await page.close();
}
try {
 for(const width of [1440,390])for(const [name,url] of routes)await capture(name,url,width);
 for(const width of [320,768,1024])await capture('dashboard','/app',width);
 await capture('dashboard-long-name','/app',320,{user:{displayName:'Nadia Pratama dengan nama tampilan yang lebih panjang untuk pemeriksaan layout'}});
 for(const name of ['item-detail','item-new','listing-new','transaction-detail','thread','profile','impact']){const route=routes.find(row=>row[0]===name);await capture(name,route[1],320);}
 await capture('dashboard-empty','/app',390,{empty:true});
 await capture('dashboard-unverified','/app',390,{user:{emailVerifiedAt:null}});
 await capture('item-reserved',`/app/barang/${id(100)}`,390,{reserved:true});
 await capture('dashboard-errors','/app',390,{fail:p=>['/items','/notifications','/offers/mine','/conversations'].includes(p)});
 const page=await browser.newPage({viewport:{width:390,height:844}});await mock(page);await page.goto('http://localhost:3000/app');await page.locator('#account-main').waitFor();await page.getByRole('button',{name:'Buka navigasi akun'}).click();await page.screenshot({path:out+'/drawer-390.png'});await page.close();
 fs.writeFileSync(out+'/inspection.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({captures:results.length+1,overflow:results.filter(r=>r.document>r.width).map(r=>[r.name,r.width,r.overflowElements]),runtime:results.filter(r=>r.runtime.length).map(r=>[r.name,r.runtime])}));
} finally {await browser.close();}
