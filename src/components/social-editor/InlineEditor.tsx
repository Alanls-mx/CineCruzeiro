"use client";

import {useCallback, useEffect, useRef, useState} from 'react';
import {Undo2, Redo2, Type, Trash2, Copy, LockKeyhole, UnlockKeyhole} from 'lucide-react';
import {EditorCanvas} from './EditorCanvas';
import {createHistory, commitHistory, undoHistory, redoHistory, type SceneHistory} from './HistoryManager';
import {findElement, isElementLocked, mapElement, patchGeometry, duplicateElement, removeElement} from './SceneSerializer';
import type {SceneElement} from './types';
import './social-editor.css';

const elementLabels: Record<string, string> = {
  title:'Título', subtitle:'Subtítulo', headline:'Chamada', detail:'Informações',
  cta:'Chamada para ação', website:'Site', logo:'Logo', signature:'Assinatura',
  hero:'Imagem principal', artwork:'Imagem', poster:'Pôster', date:'Data',
  price:'Preço', text:'Texto', branding:'Marca', legal:'Condições',
};
function elementLabel(element: SceneElement) {
  const name = element.name || element.role;
  return elementLabels[name] || elementLabels[element.role] || name;
}

export default function InlineEditor() {
  const [history, setHistory] = useState<SceneHistory | null>(null);
  const [selectedId, select] = useState<string | null>(null);
  const [zoom, setZoom] = useState(.35);
  const revision = useRef(0);
  const current = useRef<SceneHistory | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const scene = history?.present;
  const selected = scene && selectedId ? findElement(scene, selectedId) : null;
  const locked = Boolean(scene && selected && isElementLocked(scene, selected.id));
  const send = useCallback((next: SceneHistory) => {
    current.current = next; setHistory(next);
    window.parent.postMessage({type:'studio:changed', revision:revision.current, scene:next.present}, window.location.origin);
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'studio:scene' || !Array.isArray(event.data.scene?.elements)) return;
      if (revision.current === event.data.revision && current.current && JSON.stringify(current.current.present) === JSON.stringify(event.data.scene)) return;
      revision.current = event.data.revision;
      const next = createHistory(event.data.scene);
      current.current = next; setHistory(next); select(null);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({type:'studio:ready'}, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (!scene || !area.current) return;
    const node = area.current;
    const fit = () => setZoom(Math.max(.05, Math.min(1, (node.clientWidth-24)/scene.width, (node.clientHeight-24)/scene.height)));
    const observer = new ResizeObserver(fit); observer.observe(node); fit();
    return () => observer.disconnect();
  }, [scene?.width, scene?.height, Boolean(selected)]);
  const patch = useCallback((id: string, change: Partial<SceneElement>) => {
    const now = current.current;
    if (!now || isElementLocked(now.present,id) && Object.keys(change).some(key=>key!=='locked')) return;
    send(commitHistory(now, mapElement(now.present,id,element=>patchGeometry(element,change))));
  }, [send]);
  const remove = useCallback(() => {
    const now = current.current;
    if (!now || !selectedId) return;
    const item = findElement(now.present,selectedId);
    if (!item || item.required || item.protected || isElementLocked(now.present, selectedId)) return;
    send(commitHistory(now,removeElement(now.present,selectedId))); select(null);
  }, [selectedId,send]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName)) return;
      const now = current.current;
      if (!now) return;
      if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); send(event.shiftKey || event.key.toLowerCase()==='y' ? redoHistory(now) : undoHistory(now));
      } else if (event.key === 'Delete') { event.preventDefault(); remove(); }
    };
    window.addEventListener('keydown',key); return () => window.removeEventListener('keydown',key);
  }, [send, remove]);
  if (!scene || !history) return <main className="se-state"><p>Preparando edição...</p></main>;
  const all: SceneElement[] = [];
  const collect = (items: SceneElement[]) => items.forEach(item=>{all.push(item); if(item.children)collect(item.children);});
  collect(scene.elements);
  const addText = () => {
    const id = `text-${crypto.randomUUID()}`;
    const element: SceneElement = {id,name:'Texto',role:'text',type:'text',text:'Seu texto',x:scene.width*.2,y:scene.height*.4,width:scene.width*.6,height:100,rotation:0,opacity:1,visible:true,locked:false,protected:false,required:false,fill:'#ffffff',fontFamily:'Social Text',fontSize:48,fontWeight:600,lineHeight:1.12,align:'center'};
    send(commitHistory(history,{...scene,elements:[...scene.elements,element]})); select(id);
  };
  return <main className="se-inline">
    <div className="se-inline-tools" aria-label="Ferramentas de edição">
      <button title="Desfazer" aria-label="Desfazer" disabled={!history.past.length} onClick={()=>send(undoHistory(history))}><Undo2 size={17}/></button>
      <button title="Refazer" aria-label="Refazer" disabled={!history.future.length} onClick={()=>send(redoHistory(history))}><Redo2 size={17}/></button>
      <button title="Adicionar texto" aria-label="Adicionar texto" onClick={addText}><Type size={17}/></button>
      <select aria-label="Selecionar elemento" value={selectedId || ''} onChange={event=>select(event.target.value || null)}><option value="">Selecionar elemento</option>{all.filter(e=>!['ambient','background'].includes(e.role)).map(e=><option key={e.id} value={e.id}>{elementLabel(e)}</option>)}</select>
      <button title={locked?'Desbloquear elemento':'Bloquear elemento'} aria-label={locked?'Desbloquear elemento':'Bloquear elemento'} disabled={!selected} onClick={()=>selected && patch(selected.id,{locked:!locked})}>{locked?<LockKeyhole size={17}/>:<UnlockKeyhole size={17}/>}</button>
      <button title="Duplicar" aria-label="Duplicar" disabled={!selected || locked || selected.required || selected.protected} onClick={()=>{if(!selected)return; const result=duplicateElement(scene,selected.id);send(commitHistory(history,result.scene));if(result.id)select(result.id);}}><Copy size={17}/></button>
      <button title="Excluir" aria-label="Excluir" disabled={!selected || locked || selected.required || selected.protected} onClick={remove}><Trash2 size={17}/></button>
    </div>
    <div className="se-inline-canvas" ref={area}><EditorCanvas scene={scene} zoom={zoom} selectedId={selectedId} safeArea={false} onSelect={select} onChange={patch}/></div>
    {selected && <fieldset className="se-inline-properties" disabled={locked} aria-label="Editar elemento">
      {selected.type==='text' && <><label className="se-inline-text">Texto<textarea aria-label="Texto do elemento" rows={2} value={selected.text || ''} onChange={event=>patch(selected.id,{text:event.target.value})}/></label><label>Tamanho<input aria-label="Tamanho do texto" type="number" min={12} max={320} value={selected.fontSize || 42} onChange={event=>patch(selected.id,{fontSize:Math.max(12,Math.min(320,Number(event.target.value)))})}/></label></>}
      {['text','shape'].includes(selected.type) && <label>Cor<input aria-label="Cor do elemento" type="color" value={/^#[0-9a-f]{6}$/i.test(selected.fill || '')?selected.fill:'#ffffff'} onChange={event=>patch(selected.id,{fill:event.target.value})}/></label>}
      <label>Rotação<input type="number" min={-180} max={180} value={Math.round(selected.rotation)} onChange={event=>patch(selected.id,{rotation:Number(event.target.value)})}/></label>
      <label>Opacidade<input type="range" min={0} max={100} value={selected.opacity*100} onChange={event=>patch(selected.id,{opacity:Number(event.target.value)/100})}/></label>
      {selected.type==='image' && <label>Bordas<select value={selected.effects?.mask || 'none'} onChange={event=>patch(selected.id,{effects:{...selected.effects,mask:event.target.value}})}><option value="none">Inteiras</option><option value="fade-all">Dissolver</option><option value="fade-bottom">Dissolver embaixo</option></select></label>}
    </fieldset>}
  </main>;
}
