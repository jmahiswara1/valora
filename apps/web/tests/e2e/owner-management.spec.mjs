import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {login,createItem,createListing,approve,check} from '../../../api/scripts/helpers/fixtures.mjs';
async function capture(page,name,project) {await mkdir('test-results/screenshots/owner',{recursive:true});await page.screenshot({path:'test-results/screenshots/owner/'+name+'-'+project+'.png',fullPage:true});}
async function confirm(page,label) {const dialog=page.getByRole('dialog',{name:label,exact:true});await expect(dialog.getByRole('button',{name:label,exact:true})).toBeDisabled();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:label,exact:true}).dblclick();await expect(dialog).not.toBeVisible();}
test('owner edits all listing fields and deletes listing then item',async({browser},info)=>{
 const owner=await login('owner.demo@valora.local'),admin=await login('admin.demo@valora.local');
 const profile=check(await owner.request('/me'),200,'Owner');
 const fixture=await createItem(owner,'electronics','Listing kelola '+randomUUID().slice(0,8));
 const listing=await approve(admin,await createListing(owner,fixture.item,fixture.assessment,profile.city.id,'RESELL',fixture.item.title));
 const context=await browser.newContext({viewport:info.project.use.viewport,baseURL:'http://127.0.0.1:3002'});
 await context.addCookies(owner.cookieHeader().split('; ').map(cookie=>{const i=cookie.indexOf('=');return {name:cookie.slice(0,i),value:cookie.slice(i+1),url:'http://127.0.0.1:3002',sameSite:'Lax'};}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('/app/listings/'+listing.id);await expect(page.getByRole('link',{name:'Edit Listing',exact:true})).toBeVisible();await capture(page,'listing',info.project.name);
  await page.getByRole('link',{name:'Edit Listing',exact:true}).click();
  await expect(page.getByLabel('Judul yang tampil di Market')).toHaveValue(fixture.item.title);
  const title='Revisi '+randomUUID().slice(0,8);await page.getByLabel('Judul yang tampil di Market').fill(title);await page.getByLabel('Harga jual (Rp)').fill('475000');
  await page.getByLabel('Bertemu langsung',{exact:true}).uncheck();await page.getByLabel('Pengiriman',{exact:true}).check();
  await capture(page,'edit',info.project.name);await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();await page.waitForURL('**/app/listings/'+listing.id);
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.getByText('Bisa dikirim',{exact:true})).toBeVisible();
  const changed=check(await owner.request('/listings/'+listing.id),200,'Revised Listing');expect(changed.currentRevision.askingPriceIdr).toBe(475000);expect(changed.currentRevision.handoverMethods).toEqual(['DELIVERY']);expect(changed.status).toBe('PAUSED');
  await page.getByRole('button',{name:'Kirim untuk review',exact:true}).click();await expect(page.getByText('Listing dikirim untuk review.',{exact:true})).toBeVisible();
  const pending=check(await owner.request('/listings/'+listing.id),200,'Review queued');await approve(admin,pending);
  await page.goto('/market?q='+encodeURIComponent(title));await expect(page.locator('.market-card').filter({hasText:title}).getByText('Bisa dikirim',{exact:true})).toBeVisible();await capture(page,'market',info.project.name);
  await page.goto('/app/listings/'+listing.id);await page.getByRole('button',{name:'Hapus Listing',exact:true}).click();await capture(page,'delete-listing',info.project.name);await confirm(page,'Hapus Listing');await page.waitForURL('**/app/listings');
  check(await owner.request('/items/'+fixture.item.id),200,'Item retained');check(await owner.request('/listings/'+listing.id),404,'Listing hidden');
  await page.goto('/app/barang/'+fixture.item.id);await expect(page.getByRole('button',{name:'Hapus barang',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Hapus barang',exact:true}).click();await capture(page,'delete-item',info.project.name);await confirm(page,'Hapus barang');await page.waitForURL('**/app/barang');check(await owner.request('/items/'+fixture.item.id),404,'Item hidden');
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {await context.close();}
});
