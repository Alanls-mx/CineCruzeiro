const {loadAsset} = require('../engine/assets');
const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Number(value))) : fallback;
const color = (value, fallback) => /^#[a-f\d]{6}$/i.test(value || '') ? value : fallback;
const asset = value => typeof value === 'string' && (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)) ? value.slice(0,2048) : '';

function normalizeCustomization(input, context) {
  const source = input.background || {};
  const allowed = (context.movies || []).filter(movie=>movie.catalogued!==false);
  const ids = [...new Set(Array.isArray(source.movieIds) ? source.movieIds.map(String) : [])].slice(0,6);
  return {
    background: {
      mode:['automatic','solid','gradient','upload','movie','catalog'].includes(source.mode) ? source.mode : 'automatic',
      color:color(source.color,context.brand?.primaryColor || '#07111f'),
      secondaryColor:color(source.secondaryColor,context.brand?.secondaryColor || '#165bb5'),
      imageUrl:asset(source.imageUrl), movieId:allowed.find(movie=>String(movie.id)===String(source.movieId))?.id || '',
      movieIds:ids.filter(id=>allowed.some(movie=>String(movie.id)===id)), genre:String(source.genre || '').slice(0,80),
      blur:clamp(source.blur,12,0,60), darken:clamp(source.darken,45,0,85), focusX:clamp(source.focusX,50,0,100), focusY:clamp(source.focusY,50,0,100)
    },
    signaturePosition: {mode:input.signaturePosition?.mode==='manual'?'manual':'automatic',x:clamp(input.signaturePosition?.x,85,0,100),y:clamp(input.signaturePosition?.y,92,0,100)}
  };
}

async function applyBackground(scene, draft, context, loadImage) {
  let config=draft.background;
  const product=require('../contracts/concession-campaign').isConcession(draft);
  if(!config || config.mode==='automatic') {
    if(product && !draft.relatedMovieId) return scene;
    if(!product && !['online-ticket'].includes(draft.templateId)) return scene;
    config={...config,mode:draft.relatedMovieId?'movie':'gradient',movieId:draft.relatedMovieId};
  }
  const candidates=(context.movies || []).filter(movie=>movie.catalogued!==false);
  const genreMatch=movie=>!config.genre || [movie.genre,...(movie.genres || [])].join(' ').toLocaleLowerCase('pt-BR').includes(config.genre.toLocaleLowerCase('pt-BR'));
  let urls=[];
  if(config.mode==='upload') urls=[config.imageUrl];
  if(config.mode==='movie') {
    const movie=candidates.find(movie=>String(movie.id)===String(config.movieId));
    urls=[movie?.backdropUrl || movie?.posterUrl];
  }
  if(config.mode==='catalog') urls=candidates.filter(genreMatch).filter(movie=>!config.movieIds.length || config.movieIds.includes(String(movie.id))).slice(0,6).map(movie=>movie.backdropUrl || movie.posterUrl);
  const images=[];
  for(const url of urls.filter(Boolean)) if(await loadAsset(url,loadImage)) images.push(url);
  if(['upload','movie','catalog'].includes(config.mode) && !images.length) throw Object.assign(new Error('O fundo selecionado não tem uma imagem disponível. Escolha outro filme, catálogo ou envie uma imagem.'),{statusCode:400,code:'BACKGROUND_REQUIRED'});
  scene.elements=scene.elements.filter(element=>!['background-blur','background-wash','atmosphere','vignette','program-wash','program-color-wash',...(product?['product-atmosphere','product-texture','premium-field','product-ribbon']:[])].includes(element.id) && !element.id.startsWith('program-background-'));
  scene.backgroundColor=config.color;
  const elements=[];
  if(config.mode==='gradient') elements.push({id:'custom-background-gradient',type:'gradient',role:'ambient',x:0,y:0,width:scene.width,height:scene.height,direction:'bottom',stops:[{offset:0,color:config.secondaryColor},{offset:1,color:config.color}],locked:true});
  images.forEach((src,index)=>{
    if(product || /^movie-/.test(draft.templateId) || ['sessions-today','sessions-week','multi-movies'].includes(draft.templateId)) {
      // Catalog imagery forms one continuous backdrop, never arbitrary vertical strips.
      elements.push({id:`custom-background-${index}`,type:'image',role:'ambient',src,x:0,y:0,width:scene.width,height:scene.height,fit:'cover',focusX:config.focusX,focusY:config.focusY,opacity:index?Math.min(.24,1/images.length):1,locked:true,effects:{layer:'background',blur:config.blur,brightness:1-config.darken/100,saturation:.65,scale:1.15+index*.12}});
      return;
    }
    const columns=images.length>3?3:images.length,rows=Math.ceil(images.length/columns);
    elements.push({id:`custom-background-${index}`,type:'image',role:'ambient',src,x:index%columns*scene.width/columns,y:Math.floor(index/columns)*scene.height/rows,width:scene.width/columns,height:scene.height/rows,fit:'cover',focusX:config.focusX,focusY:config.focusY,locked:true,effects:{layer:'background',blur:config.blur,brightness:1-config.darken/100,saturation:.9,scale:1.08}});
  });
  if(images.length) elements.push({id:'custom-background-veil',type:'gradient',role:'contrast',x:0,y:0,width:scene.width,height:scene.height,direction:'bottom',locked:true,stops:[{offset:0,color:'rgba(0,0,0,0.12)'},{offset:1,color:'rgba(0,0,0,0.65)'}]});
  scene.elements.unshift(...elements);
  return scene;
}

function positionSignature(scene) {
  const position=scene.sourceDraft?.signaturePosition;
  if(position?.mode!=='manual') return;
  const logo=scene.elements.find(element=>element.role==='logo');
  if(!logo) return;
  const margin=scene.width*.025,top=scene.formatId==='story'?scene.height*.04:margin,bottom=scene.formatId==='story'?scene.height*.90:scene.height-margin;
  const scale=Math.min(1,(scene.width-2*margin)/logo.width,(bottom-top)/logo.height);
  logo.width*=scale;logo.height*=scale;
  logo.x=margin+(scene.width-2*margin-logo.width)*position.x/100;
  logo.y=top+(bottom-top-logo.height)*position.y/100;
  logo.locked=false;
}
module.exports={normalizeCustomization,applyBackground,positionSignature};
