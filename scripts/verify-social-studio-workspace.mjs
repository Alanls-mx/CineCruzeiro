import {chromium, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const engine = require('../backend/services/socialStudioEngineService');
const {STYLES, PRESETS, LOOKS} = require('../backend/services/social-studio/composition-engine/config');
const poster = await fs.readFile('public/images/social-studio/editorial/shrek-5.webp');
const previewImage = await sharp(poster).png().toBuffer();
const logo = await fs.readFile('public/images/social-studio/cine-cruzeiro-logo-3d.png');
const context = {
  brand: {name:'Cine Cruzeiro',logoUrl:'/logo.png',posterLogoUrl:'/logo.png',primaryColor:'#07111f',secondaryColor:'#267be6',accentColor:'#facc15',textColor:'#ffffff',posterWebsite:'www.cinecruzeiro.com.br'},
  movies: [{id:'movie',title:'Campanha de teste',genre:'Animação',posterUrl:'/poster.webp',releaseDate:'2026-10-22',sessions:[{id:'session',date:new Date(Date.now()+86400000).toISOString().slice(0,10),time:'19:00',active:true}]}],
  concessions:[{id:'combo',name:'Combo Clássico',price:25,imageUrl:'/poster.webp'}],clubPlans:[],templates:engine.SOCIAL_TEMPLATES,styles:[...engine.SOCIAL_STYLES,...STYLES],formats:Object.values(engine.SOCIAL_FORMATS),
  programLayouts:require('../backend/services/social-studio/programming/direction').PROGRAM_LAYOUTS,
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
    const errors = [];
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
        return route.fulfill({contentType:'image/png',body:previewImage,headers:{'X-Social-Scene-Id':'approved-preview'}});
      }
      if(url.pathname.endsWith('/copy')) return route.fulfill({json:{bundle:{caption:'Uma nova legenda de teste.'}}});
      if(url.pathname.endsWith('/uploads')) return route.fulfill({json:{url:'/poster.webp'}});
      if(url.pathname.endsWith('/posts')) {
        post={id:'post',imageUrl:'/poster.webp',payload:input,editable:true,width:1080,height:1350,formatId:'feed_portrait',title:'Arte aprovada'};
        return route.fulfill({json:{post,history:[post]}});
      }
      if(url.pathname.endsWith('/campaigns')) return route.fulfill({json:{posts:[post],history:[post]}});
      if(url.pathname.endsWith('/variations')) {
        await new Promise(resolve=>setTimeout(resolve,1500));
        return route.fulfill({json:{variations:[{name:'Editorial',draft:lastDraft,image:'/poster.webp',quality:{total:90}}],notices:[],evaluatedCount:4}});
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
    await expect(page.locator('#socialStudioStatus')).toContainText('Arte salva no histórico.');
    await page.locator('#socialStudioCampaignButton').click();
    await expect(page.locator('.social-operation[data-state=done]')).toContainText('três formatos');
    await expect(page.locator('#socialDockTab-animation')).toHaveCount(0);
    await expect(page.locator('#socialStudioAnimated')).toHaveCount(0);
    await expect(page.locator('#socialStudioAnimationExport')).toHaveCount(0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log(`${name}: static preview, editor tabs, variations and export OK; video controls absent`);
    await page.close();
  }
} finally {await browser.close();}
