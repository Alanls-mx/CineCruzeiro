import {chromium, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../backend/services/socialStudioEngineService');
const {STYLES, PRESETS, LOOKS} = require('../backend/services/social-studio/composition-engine/config');
const poster = await fs.readFile('public/images/social-studio/editorial/shrek-5.webp');
const logo = await fs.readFile('public/images/social-studio/cine-cruzeiro-logo-3d.png');
const context = {
  brand: {name:'Cine Cruzeiro',logoUrl:'/logo.png',posterLogoUrl:'/logo.png',primaryColor:'#07111f',secondaryColor:'#267be6',accentColor:'#facc15',textColor:'#ffffff',posterWebsite:'www.cinecruzeiro.com.br'},
  movies: [{id:'movie',title:'Campanha de teste',genre:'Animação',posterUrl:'/poster.webp',releaseDate:'2026-10-22',sessions:[]}],
  concessions:[],clubPlans:[],templates:engine.SOCIAL_TEMPLATES,styles:[...engine.SOCIAL_STYLES,...STYLES],formats:Object.values(engine.SOCIAL_FORMATS),
  signatures:engine.SOCIAL_SIGNATURES,palettes:require('../backend/services/social-studio/engine/palette').PALETTES,
  composition:{presets:PRESETS,looks:LOOKS},capabilities:{create:true,delete:true},history:[],readyPosts:[]
};
const js = await fs.readFile('backend/public/social-studio.js','utf8');
const css = await fs.readFile('backend/public/admin.css','utf8') + await fs.readFile('backend/public/social-studio.css','utf8');
await fs.mkdir('artifacts/studio-workspace',{recursive:true});
const browser = await chromium.launch();
try {
  for (const [name,viewport] of Object.entries({desktop:{width:1440,height:1000},tablet:{width:1024,height:900},mobile:{width:390,height:844}})) {
    const page = await browser.newPage({viewport, reducedMotion:'reduce'});
    const errors = [], jobs = new Map();
    let previews=0, failPreview=false, delayPreview=false, lastDraft, post;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/logo.png',route=>route.fulfill({contentType:'image/png',body:logo}));
    await page.route('**/poster.webp',route=>route.fulfill({contentType:'image/webp',body:poster}));
    await page.route('**/api/**',async route=>{
      const url = new URL(route.request().url()), input=route.request().postDataJSON() || {};
      if(url.pathname.endsWith('/context')) return route.fulfill({json:context});
      if(url.pathname.endsWith('/resolve')) {
        lastDraft=engine.normalizeDraft(input,context);
        return route.fulfill({json:{draft:lastDraft,caption:engine.captionForDraft(lastDraft,context),notices:engine.draftNotices(lastDraft,context)}});
      }
      if(url.pathname.endsWith('/preview')) {
        previews++;
        if(delayPreview) await new Promise(resolve=>setTimeout(resolve,1800));
        if(failPreview) return route.fulfill({status:503,json:{error:'Renderizador indisponível. Tente novamente.'}});
        return route.fulfill({contentType:'image/webp',body:poster,headers:{'X-Social-Scene-Id':'approved-preview'}});
      }
      if(url.pathname.endsWith('/copy')) return route.fulfill({json:{bundle:{caption:'Uma nova legenda de teste.'}}});
      if(url.pathname.endsWith('/posts')) {
        post={id:'post',imageUrl:'/poster.webp',payload:input,editable:true,width:1080,height:1350,formatId:'feed_portrait',title:'Arte aprovada'};
        return route.fulfill({json:{post,history:[post]}});
      }
      if(url.pathname.endsWith('/campaigns')) return route.fulfill({json:{posts:[post],history:[post]}});
      if(url.pathname.endsWith('/variations')) {
        await new Promise(resolve=>setTimeout(resolve,1500));
        return route.fulfill({json:{variations:[{name:'Editorial',draft:lastDraft,image:'/poster.webp',quality:{total:90}}],notices:[],evaluatedCount:4}});
      }
      if(url.pathname.endsWith('/animation-jobs')) {
        if(route.request().method()==='GET') return route.fulfill({json:{jobs:[...jobs.values()]}});
        const job={id:String(jobs.size+1),status:'waiting',progress:0,config:input.animation,plan:{duration:8,width:540,height:674},created:Date.now()};
        jobs.set(job.id,job);return route.fulfill({json:{job}});
      }
      if(url.pathname.includes('/animation-jobs/')) {
        const parts=url.pathname.split('/'),action=parts.at(-1),id=['file','cancel'].includes(action)?parts.at(-2):action,job=jobs.get(id);
        if(action==='cancel'){job.status='cancelled';return route.fulfill({json:{job}});}
        if(action==='file') return route.fulfill({contentType:'image/webp',body:poster});
        if(job.status!=='cancelled') {job.status=Date.now()-job.created>3000?'done':'rendering';job.progress=.5;}
        return route.fulfill({json:{job}});
      }
      return route.fulfill({json:{}});
    });
    await page.route('**/qa',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{padding:16px;min-width:0}</style><nav data-admin-tablist="marketing"><button data-admin-tab="social" class="active">Studio</button></nav><div id="socialStudioRoot" class="social-studio-root"></div><script>${js}</script></html>`}));
    await page.goto('http://localhost:3100/projects/cinecruzeiro/admin/qa');
    await expect(page.locator('#socialStudioStatus')).toContainText('Prévia atualizada');
    assert.equal(await page.locator('[id]').evaluateAll(nodes=>nodes.length-new Set(nodes.map(n=>n.id)).size),0,'IDs must remain unique');
    await expect(page.locator('#socialInspectorContent')).toBeVisible();
    await page.locator('#socialTabContent').focus();await page.keyboard.press('ArrowRight');
    await expect(page.locator('#socialInspectorImage')).toBeVisible();
    await expect(page.locator('#socialInspectorContent')).toBeHidden();
    await page.locator('#socialTabLook').click();
    await expect(page.locator('#socialInspectorLook')).toBeVisible();
    await page.locator('#socialTabContent').click();
    await page.locator('.social-studio-toolbar').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/studio-workspace/${name}-workspace.png`});
    await page.locator('[data-studio-open=export]').first().click();
    await expect(page.locator('#socialStudioFormat')).toBeVisible();
    await expect(page.locator('#socialStudioGenerateButton')).toBeVisible();
    await page.locator('#socialDockTab-caption').click();
    await expect(page.locator('#socialStudioCaption')).toBeVisible();
    await page.locator('[data-copy-field=caption]').click();
    await expect(page.locator('#socialStudioCaption')).toHaveValue('Uma nova legenda de teste.');
    await page.locator('#socialDockTab-animation').click();
    await page.locator('#socialStudioAnimationFormat').evaluate(select=>{select.value='gif';});
    const count=previews;
    await page.locator('#socialStudioAnimated').check();
    const operation=page.locator('.social-operation').filter({has:page.locator('strong', {hasText:'Prévia animada'})});
    await expect(operation.locator('[role=progressbar]')).toHaveAttribute('aria-valuenow','50',{timeout:8000});
    await expect(page.locator('#socialStudioLoadingOverlay')).toBeVisible();
    await page.locator('#socialStudioPreviewCanvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/studio-workspace/${name}-loading.png`});
    await expect(page.locator('#socialStudioEncodedPreview')).toBeVisible({timeout:10000});
    await expect(operation.locator('output')).toHaveText('100%');
    await expect(page.locator('#socialStudioLoadingOverlay')).toBeHidden();
    assert.equal(previews,count,'Animation must not regenerate the composition');
    await page.locator('#socialDockTab-animation').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/studio-workspace/${name}-animation.png`});
    await page.locator('#socialStudioAnimationIntensity').selectOption('subtle');
    await page.locator('#socialStudioAnimationExport').click();
    await page.locator('#socialStudioAnimationCancel').click();
    await expect(page.locator('#socialStudioAnimationState')).toContainText('cancelada');
    await expect(page.locator('.social-operation[data-state=cancelled]')).toHaveCount(1);
    failPreview=true;await page.locator('#socialStudioPreviewButton').click();
    await expect(page.locator('.social-operation[data-state=error]')).toContainText('Renderizador indisponível');
    await expect(page.locator('#socialStudioLoadingOverlay')).toBeHidden();
    failPreview=false;delayPreview=true;await page.locator('#socialStudioPreviewButton').click();
    await expect(page.locator('.social-operation[data-state=running] [role=progressbar]')).not.toHaveAttribute('aria-valuenow');
    await page.locator('.social-operation[data-state=running] button').click();
    await expect(page.locator('#socialStudioStatus')).toContainText('cancelada');
    delayPreview=false;await page.locator('#socialStudioPreviewButton').click();
    await expect(page.locator('#socialStudioStatus')).toContainText('Prévia atualizada');
    await page.locator('#socialStudioVariationsButton').click();
    await expect(page.locator('.social-operation[data-state=running]')).toContainText('Gerar variações');
    await expect(page.locator('#socialStudioVariations')).toContainText('Melhores composições');
    await page.locator('#socialDockTab-export').click();
    assert.deepEqual(await page.locator('#socialStudioForm :invalid').evaluateAll(nodes=>nodes.map(node=>({id:node.id,value:node.value,message:node.validationMessage}))),[], 'The campaign form must be valid');
    await page.locator('#socialStudioGenerateButton').click();
    await expect(page.locator('#socialStudioStatus')).toContainText('Arte social gerada');
    await page.locator('#socialStudioCampaignButton').click();
    await expect(page.locator('.social-operation[data-state=done]')).toContainText('três formatos');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log(`${name}: tabs, keyboard, progress, completion, cancel, error, retry, copy, variations and export OK`);
    await page.close();
  }
} finally {await browser.close();}
