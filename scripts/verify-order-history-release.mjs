import fs from 'node:fs';
fs.mkdirSync('tmp/order-forms',{recursive:true});
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1920,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5183/scripts/fixtures/order-history-release.html');
  await page.waitForFunction(()=>window.doLogin&&document.getElementById('view-opd_test'),{},{timeout:45000});
  await page.locator('#loginEmail').fill('fixture@example.invalid');await page.locator('#loginPass').fill('fixture-test-password');
  await page.evaluate(()=>window.doLogin());
  await page.waitForFunction(()=>document.getElementById('app-content').style.display!=='none');
  await page.evaluate(async()=>{window.opdTestSelectedVisit={visitId:'VTEST01',rowIdx:'VTEST01',patientId:'PTEST01',patientName:'Synthetic Patient',labOrdersStr:'[]'};window.loadView('opd_test',{skipOpdTestGuard:true});});
  await page.waitForFunction(()=>document.getElementById('view-opd_test').style.display!=='none');
  await page.evaluate(()=>window.opdTestOpenLabPicker('lab'));
  await page.locator('#emrLabModal.show').waitFor();
  for(const height of [1000,768]){
    await page.setViewportSize({width:1920,height});
    for(const number of [2,1]){
      const button=page.locator('.it-pagination button').nth(number-1);
      await button.click();
      await page.waitForTimeout(100);
      const layout=await page.evaluate(()=>{
        const nav=document.querySelector('.it-pagination').getBoundingClientRect();
        const crop=document.querySelector('.it-picker-crop').getBoundingClientRect();
        const host=document.getElementById('labCheckboxContainer').getBoundingClientRect();
        return {navBottom:nav.bottom,hostBottom:host.bottom,cropBottom:crop.bottom,navTop:nav.top,page:document.querySelector('[data-template-page]').dataset.templatePage};
      });
      assert.equal(layout.page,String(number));
      assert.ok(layout.navBottom<=height && layout.navBottom<=layout.hostBottom+1,'Page buttons must stay visible');
      assert.ok(layout.cropBottom<=layout.navTop+1,'Full form must fit above page buttons');
    }
  }
  await page.setViewportSize({width:1920,height:1000});
  await page.screenshot({path:'tmp/order-forms/picker-layout-fixed.png'});

  for(let i=0;i<2;i++){
    if(i>0) await page.evaluate(()=>window.opdTestOpenLabPicker('lab'));
    await page.locator('#emrLabModal.show').waitFor();
    await page.getByLabel('CBC 24 p',{exact:true}).check();
    await page.locator('#emrLabConfirmButton').click();
    await page.locator('.swal2-confirm').click();
    await page.waitForFunction(expected=>JSON.parse(window.hisWorkflowMock.tables.HIS_One_Visits[0].Lab_Orders_JSON).length===expected,i+1);
    await page.locator('.swal2-confirm').click();
  }
  const history=await page.evaluate(()=>JSON.parse(window.hisWorkflowMock.tables.HIS_One_Visits[0].Lab_Orders_JSON));
  assert.equal(history.length,2);assert.notEqual(history[0].orderBatchId,history[1].orderBatchId);assert.notEqual(history[0].orderedAt,history[1].orderedAt);
  assert.ok(history.every(row=>row.historySaved&&row.name==='CBC 24 p'));
  await page.evaluate(()=>{window.opdTestSelectedVisit.labOrdersStr=window.hisWorkflowMock.tables.HIS_One_Visits[0].Lab_Orders_JSON;window.opdTestApplySelectedVisit();});
  assert.equal(await page.evaluate(()=>window.opdTestState.orders.length),2);
  const requests=await page.evaluate(()=>window.hisWorkflowMock.requests);
  assert.ok(!requests.some(request=>request.method==='POST'&&/lis.*test_orders/.test(request.url||'')&&/insert/.test(request.body||'')));
  await page.screenshot({path:'tmp/order-forms/real-order-history-release.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Actual release UI: login, two CBC save batches, database mock read-back and encounter reopening passed. No LIS/RIS order writes.');
}catch(error){await page.screenshot({path:'tmp/order-forms/release-ui-failure.png',fullPage:true});console.error(errors);throw error;}finally{await browser.close();}

