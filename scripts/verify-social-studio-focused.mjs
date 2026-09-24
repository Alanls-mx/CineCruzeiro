import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {STYLES,PRESETS,LOOKS}=require('../backend/services/social-studio/composition-engine/config');
const poster=await fs.readFile('public/images/social-studio/editorial/shrek-5.webp');
const logo=await fs.readFile('public/images/social-studio/cine-cruzeiro-logo-3d.png');
const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
const context={now:new Date().toISOString(),brand:{name:'Cine Cruzeiro',logoUrl:'/logo.png',posterWebsite:'cinecruzeiro.com.br'},movies:[1,2,3].map(i=>({id:`movie${i}`,title:`Filme ${i}`,genre:'Animação',posterUrl:'/poster.webp',releaseDate:day,sessions:[{id:`s${i}`,date:day,time:`${18+i}:00`,active:true}]})),concessions:[{id:'combo',name:'Combo Clássico',price:25,imageUrl:'/poster.webp'}],clubPlans:[],templates:engine.SOCIAL_TEMPLATES,styles:[...engine.SOCIAL_STYLES,...STYLES],formats:Object.values(engine.SOCIAL_FORMATS),signatures:engine.SOCIAL_SIGNATURES,palettes:require('../backend/services/social-studio/engine/palette').PALETTES,composition:{presets:PRESETS,looks:LOOKS},capabilities:{create:true,delete:true},programLayouts:require('../backend/services/social-studio/programming/direction').PROGRAM_LAYOUTS,workspaceLayouts:require('../backend/services/social-studio/contracts/workspace').LAYOUTS,history:[],readyPosts:[]};
const loadImage=async src=>src.includes('logo')?logo:poster;
const js=await fs.readFile('backend/public/social-studio.js','utf8');
const css=await fs.readFile('backend/public/admin.css','utf8')+await fs.readFile('backend/public/social-studio.css','utf8');
const browser=await chromium.launch();
await fs.mkdir('artifacts/studio-focused',{recursive:true});
try {
  for(const [name,viewport] of Object.entries({desktop:{width:1500,height:1000},mobile:{width:390,height:844}})){
    const page=await browser.newPage({viewport});const errors=[],snapshots=new Map();let saved;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/poster.webp',route=>route.fulfill({contentType:'image/webp',body:poster}));
    await page.route('**/logo.png',route=>route.fulfill({contentType:'image/png',body:logo}));
    await page.route('**/api/**',async route=>{
      try {
        const url=new URL(route.request().url()),input=route.request().postDataJSON() || {};
        if(url.pathname.endsWith('/context'))return route.fulfill({json:context});
        if(url.pathname.endsWith('/resolve')){const draft=engine.normalizeDraft(input,context);return route.fulfill({json:{draft,caption:engine.captionForDraft(draft,context),notices:engine.draftNotices(draft,context)}});}
        if(url.pathname.endsWith('/preview-scene'))return route.fulfill({json:{scene:snapshots.get(input.previewToken).scene}});
        if(url.pathname.endsWith('/preview')){
          const rendered=input.scene?await require('../backend/services/social-studio/scene/preview-edit').renderPreviewEdit(snapshots.get(input.previewToken),input.scene,{loadImage}):await engine.renderSocialPost(input,context,{loadImage});
          const token=String(snapshots.size+1);snapshots.set(token,rendered);
          return route.fulfill({contentType:rendered.contentType,body:rendered.buffer,headers:{'X-Social-Scene-Id':token}});
        }
        if(url.pathname.endsWith('/assets')){
          let image=await loadImage(url.searchParams.get('url') || '');
          if(url.searchParams.get('render'))image=await require('../backend/services/social-studio/composition-engine/pipeline').createCinematicArtwork(image,JSON.parse(url.searchParams.get('render')));
          return route.fulfill({contentType:'image/png',body:image});
        }
        if(url.pathname.endsWith('/posts')){saved=snapshots.get(input.previewToken);return route.fulfill({json:{post:{id:'saved',editable:true,imageUrl:'/poster.webp',payload:input,formatId:'feed_portrait',width:1080,height:1350},history:[]}});}
        return route.fulfill({json:{jobs:[]}});
      }catch(error){return route.fulfill({status:400,json:{error:{message:error.message}}});}
    });
    await page.route('**/admin/qa',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{padding:16px;min-width:0}</style><nav data-admin-tablist="marketing"><button data-admin-tab="social" class="active">Studio</button></nav><div id="socialStudioRoot" class="social-studio-root"></div><script>${js}</script></html>`}));
    await page.goto('http://localhost:3106/admin/qa');
    const editor=page.frameLocator('#socialStudioInlineEditor');
    await expect(editor.getByRole('button',{name:'Adicionar texto',exact:true})).toBeVisible({timeout:90000});
    await expect(page.locator('[name=socialStudioTemplate][value=club-plan]')).toHaveCount(0);
    await expect(page.locator('#socialStudioTitle')).toBeHidden();
    assert.equal(await page.locator('[name=socialStudioStyle]').count(),4);
    await editor.getByRole('combobox',{name:'Selecionar elemento'}).selectOption('title');
    await expect(editor.getByRole('textbox',{name:'Texto do elemento'})).toBeVisible();
    const originalText=await editor.getByRole('textbox',{name:'Texto do elemento'}).inputValue();
    await editor.getByRole('textbox',{name:'Texto do elemento'}).fill('Uma noite de cinema');
    await expect(page.locator('#socialStudioStatus')).toContainText('Alterações visuais');
    await editor.getByRole('button',{name:'Desfazer',exact:true}).click();
    await expect(editor.getByRole('textbox',{name:'Texto do elemento'})).toHaveValue(originalText);
    await editor.getByRole('button',{name:'Refazer',exact:true}).click();
    await expect(editor.getByRole('textbox',{name:'Texto do elemento'})).toHaveValue('Uma noite de cinema');
    await page.locator('#socialStudioPreviewCanvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/studio-focused/${name}-editor.png`});
    await page.locator('[data-studio-open=export]').first().click();
    await page.locator('#socialStudioGenerateButton').click();
    await expect(page.locator('#socialStudioStatus')).toContainText('sucesso',{timeout:30000});
    const flatten=items=>items.flatMap(item=>item.children?flatten(item.children):[item]);
    assert.equal(flatten(saved.scene.elements).find(e=>e.id==='title').text,'Uma noite de cinema');
    await page.locator('#socialStudioCategory').selectOption('PROGRAMAÇÃO');
    await expect(page.locator('#socialStudioStatus')).toContainText('Prévia atualizada',{timeout:30000});
    await expect(page.locator('#socialStudioMovieField')).toBeHidden();
    await expect(page.locator('#socialStudioMovieSelections')).toBeHidden();
    await page.locator('#socialTabImage').click();
    await expect(page.locator('#socialStudioImageSection')).toBeHidden();
    await expect(page.locator('#socialProgramVisual')).toBeVisible();
    assert.ok((await page.locator('[name=socialStudioStyle]').evaluateAll(nodes=>nodes.map(node=>node.value))).every(value=>value==='automatic' || value.startsWith('program-')));
    await page.screenshot({path:`artifacts/studio-focused/${name}-programming.png`});
    assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No page overflow');
    await page.close();console.log(`${name}: inline editing, undo/redo, edited export and category isolation passed`);
  }
}finally{await browser.close();}
