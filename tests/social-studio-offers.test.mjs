import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const picture=async(width,height,color)=>sharp({create:{width,height,channels:4,background:color}}).png().toBuffer();
const images=new Map([
  ['asset://movie',await picture(700,1000,'#39506d')],
  ['asset://product',await picture(800,800,'#f5bf3e')],
  ['asset://logo',await picture(700,300,'#1468bd')]
]);
const context={
  now:'2026-09-23T10:00:00-03:00',
  brand:{name:'Cine Cruzeiro',logoUrl:'asset://logo',posterLogoUrl:'asset://logo',website:'https://cinecruzeiro.com.br',primaryColor:'#081c36',secondaryColor:'#1468bd',accentColor:'#ffda38',textColor:'#ffffff'},
  movies:[{id:'m',title:'Filme em cartaz',posterUrl:'asset://movie',catalogued:true,sessions:[{id:'s',date:'2026-09-24',time:'19:00',availableForPurchase:true,ticketTypes:[{id:'inteira',name:'Inteira',price:24},{id:'meia',name:'Meia',price:12}]}]}],
  concessions:[{id:'p',name:'Pipoca grande',description:'Pipoca salgada',price:18,imageUrl:'asset://product'}],
  clubPlans:[]
};
const loadImage=async url=>images.get(url) || null;

test('modelos adicionais usam preço cadastrado e preservam a marca',async()=>{
  for(const formatId of ['feed_portrait','square','story']) {
    for(const [templateId,selection,expected] of [
      ['ticket-offer',{movieId:'m',priceSelection:{mode:'ticket-type',ticketTypeId:'meia',sessionId:'s'}},'12'],
      ['concession-offer',{concessionId:'p'},'R$ 18,00']
    ]) {
      const result=await engine.renderSocialPost({templateId,formatId,...selection,offerTerms:'Condições confirmadas no balcão.'},context,{loadImage});
      const elements=flattenElements(result.scene.elements);
      assert.equal(result.draft.semanticValidation.valid,true);
      assert.ok(elements.some(item=>item.id==='detail' && item.text===expected));
      assert.ok(elements.some(item=>item.id==='description' && item.text.includes('Condições confirmadas')));
      if(templateId==='ticket-offer') assert.equal(elements.filter(item=>item.type==='text' && /\bMeia\b/i.test(item.text)).length,1);
      assert.ok(elements.some(item=>item.id==='logo' && item.src==='asset://logo'));
      assert.ok(elements.some(item=>item.id==='artwork' && item.src===`asset://${templateId==='ticket-offer'?'movie':'product'}`));
      const meta=await sharp(result.buffer).metadata();
      assert.equal(meta.width,1080);
      assert.equal(meta.height,formatId==='square'?1080:formatId==='story'?1920:1350);
      if(process.env.SOCIAL_OFFER_PREVIEW_DIR) {
        const fs=await import('node:fs/promises');
        await fs.mkdir(process.env.SOCIAL_OFFER_PREVIEW_DIR,{recursive:true});
        await fs.writeFile(`${process.env.SOCIAL_OFFER_PREVIEW_DIR}/${templateId}-${formatId}.png`,result.buffer);
      }
    }
  }
});

test('oferta de ingresso recusa valor livre e sessão indisponível',()=>{
  const manual=engine.normalizeDraft({templateId:'ticket-offer',movieId:'m',priceSelection:{mode:'manual',value:5}},context);
  assert.equal(manual.semanticValidation.valid,false);
  const unavailable=structuredClone(context);
  unavailable.movies[0].sessions=[];
  const draft=engine.normalizeDraft({templateId:'ticket-offer',movieId:'m',priceSelection:{mode:'minimum'}},unavailable);
  assert.equal(draft.semanticValidation.valid,false);
});

test('ingresso permite escolher inteira, meia e valor de campanha confirmado',()=>{
  assert.equal(engine.normalizeDraft({templateId:'ticket-offer',movieId:'m'},context).priceInfo.value,24);
  for(const [mode,expected] of [['full',24],['half',12]]) {
    const draft=engine.normalizeDraft({templateId:'ticket-offer',movieId:'m',priceSelection:{mode}},context);
    assert.equal(draft.priceInfo.value,expected);
    assert.equal(draft.semanticValidation.valid,true);
  }
  const campaign=engine.normalizeDraft({templateId:'ticket-offer',movieId:'m',offerHeadline:'Semana do cinema',offerTerms:'Válido somente nas sessões indicadas',priceSelection:{mode:'campaign',value:10},oldPrice:24},context);
  assert.equal(campaign.semanticValidation.valid,true);
  assert.equal(campaign.style,'offer-counter');
  const invalid=engine.normalizeDraft({templateId:'ticket-offer',movieId:'m',offerHeadline:'Semana do cinema',offerTerms:'Válido somente nas sessões indicadas',priceSelection:{mode:'campaign',value:10},oldPrice:8},context);
  assert.equal(invalid.semanticValidation.valid,false);
});

test('story comercial preserva preço, CTA, condições e assinatura na área útil',async()=>{
  const result=await engine.renderSocialPost({templateId:'ticket-offer',formatId:'story',movieId:'m',offerHeadline:'Semana do cinema',offerTerms:'Oferta confirmada para a sessão selecionada',priceSelection:{mode:'campaign',value:10},oldPrice:24,signatureScale:180,signatureScaleMode:'manual'},context,{loadImage,skipRaster:true});
  const elements=flattenElements(result.scene.elements);
  const get=id=>elements.find(e=>e.id===id);
  assert.ok(get('detail').y+get('detail').height<get('subject').y);
  assert.ok(get('subject').y+get('subject').height<get('cta').y);
  assert.ok(get('logo').y+get('logo').height<result.scene.height*.91);
  assert.ok(get('savings').text.includes('14,00'));
});

test('composições de ingresso mudam hierarquia e escala da assinatura',async()=>{
  const scenes=[];
  for(const style of ['price-impact','campaign-led','offer-counter']) {
    const result=await engine.renderSocialPost({templateId:'ticket-offer',movieId:'m',style,layoutId:style,offerHeadline:'Semana do cinema',offerTerms:'Oferta confirmada para a sessão selecionada',priceSelection:{mode:'full',sessionId:'s'},signatureScale:160,signatureScaleMode:'manual'},context,{loadImage,skipRaster:true});
    const elements=flattenElements(result.scene.elements);
    assert.ok(elements.some(e=>e.id==='detail' && e.text==='24'));
    assert.equal(result.scene.sourceDraft.signatureBounds.scale,160);
    assert.ok(elements.find(e=>e.id==='logo').width<=result.scene.width*.34);
    scenes.push(elements.find(e=>e.id==='title').y);
  }
  assert.equal(new Set(scenes).size,3);
});

test('oferta da bomboniere ignora preço digitado e usa cadastro',()=>{
  const draft=engine.normalizeDraft({templateId:'concession-offer',concessionId:'p',price:'R$ 1,00'},context);
  assert.match(draft.price,/R\$\s*18,00/);
  assert.equal(draft.content.price.value,18);
});
test('chamada temática não substitui a identificação do produto',async()=>{
  const rendered=await engine.renderSocialPost({templateId:'concession-offer',concessionId:'p',offerHeadline:'Especial do fim de semana'},context,{loadImage,skipRaster:true});
  const elements=flattenElements(rendered.scene.elements);
  assert.ok(elements.some(item=>item.id==='title' && item.text.replace(/\s+/g,' ').includes('Especial do fim de semana')));
  assert.ok(elements.some(item=>item.id==='subject' && item.text==='Pipoca grande'));
});
