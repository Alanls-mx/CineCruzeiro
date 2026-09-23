import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2] || 'artifacts/remotion'),results=[];
const files=(await fs.readdir(root)).filter(name=>name.endsWith('.scene.json'));
for(const sceneFile of files) {
  const prefix=sceneFile.replace('.scene.json',''),scene=JSON.parse(await fs.readFile(path.join(root,sceneFile),'utf8'));
  const still=await sharp(path.join(root,`${prefix}.png`)).resize(270,Math.round(270*scene.height/scene.width)).removeAlpha().raw().toBuffer();
  const item={name:prefix,width:scene.width,height:scene.height,videos:[]};
  for(const quality of ['preview','final']) {
    const file=path.join(root,`${prefix}-${quality}.mp4`);
    const probe=spawnSync('ffprobe',['-v','quiet','-print_format','json','-show_streams','-show_format',file],{encoding:'utf8',windowsHide:true});
    if(probe.status!==0)throw new Error(`Vídeo ausente: ${file}`);
    const meta=JSON.parse(probe.stdout),stream=meta.streams.find(s=>s.codec_type==='video');
    const png=path.join(root,`${prefix}-${quality}-last.png`);
    const result=spawnSync('ffmpeg',['-y','-sseof','-0.3','-i',file,'-frames:v','1',png],{windowsHide:true});
    if(result.status!==0)throw new Error('Falha ao extrair quadro');
    const frame=await sharp(png).resize(270,Math.round(270*scene.height/scene.width)).removeAlpha().raw().toBuffer();
    const mae=frame.reduce((sum,v,i)=>sum+Math.abs(v-still[i]),0)/frame.length;
    if(quality==='final' && (stream.width!==scene.width || stream.height!==scene.height))throw new Error(`Resolução final incorreta: ${prefix}`);
    if(mae>12)throw new Error(`O quadro final diverge da arte: ${prefix} (${mae})`);
    item.videos.push({quality,width:stream.width,height:stream.height,duration:Number(meta.format.duration),bytes:Number(meta.format.size),pixelMeanAbsoluteError:mae});
  }
  results.push(item);
}
await fs.writeFile(path.join(root,'verification.json'),JSON.stringify(results,null,2));
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Social Studio · Comparação de animações</title><style>body{margin:0;background:#090c11;color:#edf0f4;font:16px system-ui}header,main{max-width:1440px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:20px;margin-top:40px}section{border-top:1px solid #344050}.comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}img,video{width:100%;height:480px;object-fit:contain;background:#040609}figure{margin:0}figcaption{padding:12px 0;color:#b9c9dd}p{max-width:72ch}a{color:#82c1ff}@media(max-width:700px){.comparison{grid-template-columns:1fr}img,video{height:400px}}</style><header><h1>Social Studio · Estático e animado</h1><p>Artes de teste, não publicadas. A prévia e o arquivo final usam a mesma composição e sequência. Datas, preços e textos são exemplos de validação.</p></header><main>${results.map(item=>`<section><h2>${escape(item.name)} · ${item.width} × ${item.height}</h2><div class="comparison"><figure><img src="${item.name}.png" alt="Arte estática"><figcaption>Arte aprovada</figcaption></figure><figure><video controls muted loop preload="metadata" poster="${item.name}.png" src="${item.name}-preview.mp4"></video><figcaption>Prévia reduzida</figcaption></figure><figure><video controls muted loop preload="metadata" poster="${item.name}.png" src="${item.name}-final.mp4"></video><figcaption>Exportação final</figcaption></figure></div></section>`).join('')}<section><h2>Três filmes · Comparação de movimentos</h2><div class="comparison">${['simultaneous','poster-cascade','featured-cycle','crossfade-program'].map(p=>`<figure><video controls muted loop preload="metadata" src="three-${p}.mp4"></video><figcaption>${p}</figcaption></figure>`).join('')}</div></section></main></html>`;
await fs.writeFile(path.join(root,'comparacao.html'),html);
console.log(`${results.length} composições verificadas: resolução, duração e fidelidade do quadro final.`);
