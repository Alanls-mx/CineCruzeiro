import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../backend/services/socialStudioEngineService');
const {selectDiverseVariations, generateVariations} = require('../backend/services/social-studio/composition-engine/variations');
const {flattenElements} = require('../backend/services/social-studio/scene/groups');

async function fixture() {
  const assets = new Map();
  for (const [id, color] of Object.entries({one: '#842429', two: '#195cb4', three: '#5d9024', logo: '#1465af', product: '#f0a12d'})) {
    assets.set(`asset://${id}`, await sharp({create: {width: id === 'logo' ? 800 : 900, height: id === 'logo' ? 430 : 1200, channels: 3, background: color}}).png().toBuffer());
  }
  const context = {
    now: '2026-09-23T12:00:00-03:00',
    brand: {name: 'Cine Cruzeiro', website: 'https://cinema.example', posterWebsite: 'https://cinema.example', logoUrl: 'asset://logo', posterLogoUrl: 'asset://logo', primaryColor: '#07111f', secondaryColor: '#267be6', accentColor: '#facc15', textColor: '#ffffff'},
    movies: ['one', 'two', 'three'].map((id, index) => ({id, title: `Filme ${index + 1}`, genre: ['Terror','Ação','Animação'][index], posterUrl: `asset://${id}`, releaseDate: '2026-10-22', sessions: [{date: '2026-10-22', time: '19:30', price: 20}]})),
    concessions: [{id: 'combo', name: 'Combo Família', imageUrl: 'asset://product', price: 39.9}],
    clubPlans: [{id: 'club', name: 'Clube Cine', imageUrl: 'asset://logo', monthlyPrice: 29.9, benefits: ['Ingressos mensais', 'Desconto na bomboniere']}]
  };
  return {context, loadImage: async url => assets.get(url) || null};
}

test('artes comerciais usam apenas ativos do produto, plano ou cinema', async () => {
  const {context, loadImage} = await fixture();
  for (const [input, source] of [
    [{templateId: 'concession-combo', concessionId: 'combo'}, 'asset://product'],
    [{templateId: 'club-plan', clubPlanId: 'club'}, 'asset://logo'],
    [{templateId: 'online-ticket'}, undefined]
  ]) {
    const rendered = await engine.renderSocialPost(input, context, {loadImage, skipRaster: true});
    assert.equal(rendered.draft.entities.movie, null);
    assert.equal(flattenElements(rendered.scene.elements).find(element => element.id === 'artwork')?.src, source);
    assert.ok(rendered.scene.elements.every(element => !['asset://one','asset://two','asset://three'].includes(element.src)));
  }
});

test('programação avança ao primeiro período real e mistura fundos de filmes diferentes', async () => {
  const {context, loadImage} = await fixture();
  const input = {templateId: 'multi-movies', movieIds: context.movies.map(movie => movie.id)};
  const draft = engine.normalizeDraft(input, context);
  assert.equal(draft.periodStart, '2026-10-22');
  assert.match(draft.title, /22\/10/);
  assert.ok(draft.programMovies.every(movie => movie.schedule.count === 1));
  const rendered = await engine.renderSocialPost(input, context, {loadImage, skipRaster: true});
  const backgrounds = rendered.scene.elements.filter(element => element.id.startsWith('program-background'));
  assert.equal(backgrounds.length, 2);
  assert.equal(new Set(backgrounds.map(element => element.src)).size, 2);
  assert.ok(backgrounds.every(element => element.x === 0 && element.width === rendered.scene.width));
  const colorWash = rendered.scene.elements.find(element => element.id === 'program-color-wash');
  assert.equal(colorWash?.direction, 'right');
  assert.notEqual(colorWash.stops[0].color, colorWash.stops[2].color);
  assert.notEqual(rendered.palette.dominantColor, (await engine.renderSocialPost({templateId: 'movie-highlight', movieId: rendered.draft.movieId}, context, {loadImage, skipRaster: true})).palette.dominantColor);
  assert.ok(rendered.quality.accepted);
  assert.equal(rendered.quality.issues.some(issue => issue.code === 'REDUNDANT_CONTENT'), false);
  const week = engine.normalizeDraft({templateId: 'sessions-week', movieId: 'one'}, context);
  assert.equal(week.periodStart, '2026-10-22');
  assert.equal(week.schedule.count, 1);
});

test('a assinatura não invade os pôsteres nas composições de programação', async () => {
  const {context, loadImage} = await fixture();
  for (const layout of ['film-strip', 'lineup', 'featured', 'mosaic']) {
    const rendered = await engine.renderSocialPost({templateId: 'multi-movies', movieIds: context.movies.map(movie => movie.id), programLayout: layout}, context, {loadImage, skipRaster: true});
    const elements = flattenElements(rendered.scene.elements);
    const logo = elements.find(element => element.id === 'logo');
    assert.ok(logo, layout);
    for (const poster of elements.filter(element => element.id.startsWith('movie-art-'))) {
      const overlapX = Math.max(0, Math.min(logo.x + logo.width, poster.x + poster.width) - Math.max(logo.x, poster.x));
      const overlapY = Math.max(0, Math.min(logo.y + logo.height, poster.y + poster.height) - Math.max(logo.y, poster.y));
      assert.equal(overlapX * overlapY, 0, `${layout}: ${poster.id}`);
    }
  }
});

test('preço, benefícios e chamada final não se cruzam nas composições', async () => {
  const {context, loadImage} = await fixture();
  for (const input of [
    {templateId: 'movie-highlight', movieId: 'one', style: 'poster-dominant'},
    {templateId: 'club-plan', clubPlanId: 'club', style: 'editorial'},
    {templateId: 'concession-combo', concessionId: 'combo', style: 'hero-left'}
  ]) {
    const rendered = await engine.renderSocialPost(input, context, {loadImage, skipRaster: true});
    assert.equal(rendered.quality.issues.filter(issue => issue.code === 'TEXT_OVERLAP').length, 0, input.templateId);
  }
});

test('bomboniere e clube usam hierarquias visuais próprias', async () => {
  const {context, loadImage} = await fixture();
  for (const [input, artWidth] of [
    [{templateId: 'concession-combo', concessionId: 'combo', style: 'poster-dominant'}, .4],
    [{templateId: 'club-plan', clubPlanId: 'club', style: 'typography-dominant'}, .3]
  ]) {
    const rendered = await engine.renderSocialPost(input, context, {loadImage, skipRaster: true});
    const elements = flattenElements(rendered.scene.elements);
    const artwork = elements.find(element => element.id === 'artwork');
    const detail = elements.find(element => element.id === 'detail');
    assert.ok(artwork.width / rendered.scene.width > artWidth, input.templateId);
    assert.ok(detail?.y > artwork.y, input.templateId);
    assert.equal(rendered.quality.issues.some(issue => issue.code === 'TEXT_OVERLAP'), false, input.templateId);
  }
});

test('exploração escolhe famílias diferentes sem perder a opção de variações similares', () => {
  const ranked = ['hero-left','hero-right','split','poster-dominant','full-bleed','editorial'].map(styleId => ({styleId}));
  assert.deepEqual(selectDiverseVariations(ranked, 'explore').map(variation => variation.styleId), ['hero-left','poster-dominant','full-bleed','editorial']);
  assert.deepEqual(selectDiverseVariations(ranked, 'similar').map(variation => variation.styleId), ['hero-left','hero-right','split','poster-dominant']);
  const programming = ['film-strip','lineup','panorama','featured','mosaic','cinematic-grid'].map(styleId => ({styleId}));
  assert.deepEqual(selectDiverseVariations(programming, 'explore').map(variation => variation.styleId), ['film-strip','panorama','featured','mosaic']);
});

test('variações comerciais permanecem na linguagem de cada categoria', async () => {
  const {context, loadImage} = await fixture();
  for (const [input, allowed] of [
    [{templateId: 'concession-combo', concessionId: 'combo'}, ['product-price','product-lateral','hero-product']],
    [{templateId: 'club-plan', clubPlanId: 'club'}, ['typography-dominant','editorial','hero-center','hero-right']]
  ]) {
    const result = await generateVariations({formatId: 'feed_portrait', ...input}, context, {loadImage});
    assert.ok(result.variations.length >= 2, input.templateId);
    assert.ok(result.variations.every(variation => allowed.includes(variation.styleId)), input.templateId);
    assert.ok(result.variations.every(variation => variation.draft.templateId === input.templateId), input.templateId);
  }
});
