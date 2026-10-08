"use client";

import { ImagePlus, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { ChangeEvent } from "react";
import type { ImageEffects, SceneElement } from "./types";

type Props = {
  element: SceneElement | null;
  busy: boolean;
  onPatch: (patch: Partial<SceneElement>, commit?: boolean) => void;
  onUpload: (file: File) => void;
};

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="se-field"><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next))); }} /></label>;
}

export function PropertiesPanel({ element, busy, onPatch, onUpload }: Props) {
  if (!element) return <aside className="se-panel se-properties"><div className="se-panel-heading"><span>Propriedades</span></div><div className="se-empty-panel">Selecione um elemento na arte ou na lista de camadas.</div></aside>;
  const imageChange = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; };
  const effect = (patch: ImageEffects) => onPatch({ effects: { ...element.effects, ...patch } });
  return (
    <aside className="se-panel se-properties" aria-label="Propriedades do elemento">
      <div className="se-panel-heading"><span>Propriedades</span><small>{element.name}</small></div>
      {element.locked && <div className="se-protected">Camada bloqueada</div>}
      <fieldset className="se-property-fields" disabled={element.locked || busy}>
      <div className="se-property-grid">
        <NumberField label="X" value={Math.round(element.x)} onChange={(x) => onPatch({ x })} />
        <NumberField label="Y" value={Math.round(element.y)} onChange={(y) => onPatch({ y })} />
        <NumberField label="Largura" value={Math.round(element.width)} min={8} onChange={(width) => onPatch({ width })} />
        <NumberField label="Altura" value={Math.round(element.height)} min={4} onChange={(height) => onPatch({ height })} />
        <NumberField label="Rotação" value={Math.round(element.rotation)} min={-180} max={180} onChange={(rotation) => onPatch({ rotation })} />
        <label className="se-field"><span>Opacidade {Math.round(element.opacity * 100)}%</span><input type="range" value={element.opacity * 100} min={0} max={100} onChange={(event) => onPatch({ opacity: Number(event.target.value) / 100 })} /></label>
      </div>
      {element.type === "text" && <>
        <label className="se-field se-field-wide"><span>Texto</span><textarea aria-label="Texto" rows={4} value={element.text || ""} onChange={(event) => onPatch({ text: event.target.value })} /></label>
        <div className="se-property-grid">
          <label className="se-field"><span>Fonte</span><select value={element.fontFamily} onChange={(event) => onPatch({ fontFamily: event.target.value as SceneElement["fontFamily"], fontWeight: event.target.value === "Social Display" ? 900 : 600 })}><option value="Social Text">Semibold</option><option value="Social Display">Black</option></select></label>
          <NumberField label="Tamanho" value={element.fontSize || 42} min={12} max={320} onChange={(fontSize) => onPatch({ fontSize })} />
          <NumberField label="Entrelinhas" value={element.lineHeight || 1.12} min={0.75} max={2} step={0.05} onChange={(lineHeight) => onPatch({ lineHeight })} />
          <NumberField label="Espaçamento" value={element.letterSpacing || 0} min={0} max={30} step={0.5} onChange={(letterSpacing) => onPatch({ letterSpacing })} />
        </div>
        <div className="se-field se-field-wide"><span>Alinhamento</span><div className="se-segmented">{(["left", "center", "right"] as const).map((align) => <button type="button" className={element.align === align ? "is-active" : ""} key={align} title={align === "left" ? "Esquerda" : align === "right" ? "Direita" : "Centro"} aria-label={align === "left" ? "Esquerda" : align === "right" ? "Direita" : "Centro"} onClick={() => onPatch({ align })}>{align === "left" ? <AlignLeft size={17} /> : align === "right" ? <AlignRight size={17} /> : <AlignCenter size={17} />}</button>)}</div></div>
        <label className="se-field se-field-wide"><span>Cor</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(element.fill || "") ? element.fill : "#ffffff"} onChange={(event) => onPatch({ fill: event.target.value })} /></label>
      </>}
      {element.type === "shape" && <div className="se-property-grid"><label className="se-field"><span>Cor</span><input type="color" value={element.fill || "#ffffff"} onChange={(event) => onPatch({ fill: event.target.value })} /></label><NumberField label="Cantos" value={element.radius || 0} min={0} max={100} onChange={(radius) => onPatch({ radius })} /></div>}
      {element.type === "image" && <>
        <details className="se-effects" open={Boolean(element.effects)}><summary>Efeitos da imagem</summary>
          {([ ["blur", "Desfoque", 0, 80, 1, 0], ["blend", "Mistura com o fundo", 0, 100, 1, 0], ["brightness", "Luminosidade", .2, 1.5, .05, 1], ["saturation", "Saturação", 0, 1.8, .05, 1], ["contrast", "Contraste", .5, 1.6, .05, 1], ["vignette", "Vinheta", 0, 80, 1, 0], ["glow", "Luz ambiente", 0, 40, 1, 0], ["grain", "Granulação", 0, 8, 1, 0], ["colorWash", "Banho de cor", 0, 35, 1, 0], ["shadow", "Sombra suave", 0, 60, 1, 0] ] as const).map(([key, label, min, max, step, fallback]) => <label className="se-field se-field-wide" key={key}><span>{label} · {element.effects?.[key] ?? fallback}</span><input type="range" min={min} max={max} step={step} value={element.effects?.[key] ?? fallback} onChange={(event) => effect({ [key]: Number(event.target.value) })} /></label>)}
          <label className="se-field se-field-wide"><span>Transição das bordas</span><select value={element.effects?.mask || "fade-all"} onChange={(event) => effect({ mask: event.target.value })}>{[["none", "Sem máscara"], ["fade-all", "Todas as bordas"], ["cinematic-bottom", "Cinematográfica inferior"], ["fade-bottom", "Inferior"], ["fade-top", "Superior"], ["fade-left", "Esquerda"], ["fade-right", "Direita"], ["radial", "Radial"]].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="se-field se-field-wide"><span>Atmosfera</span><select value={element.effects?.overlay || "none"} onChange={(event) => effect({ overlay: event.target.value })}>{[["none", "Nenhuma"], ["fog", "Névoa"], ["dust", "Poeira sutil"], ["light-leak", "Luz lateral"], ["gradient-light", "Luz direcional"]].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="se-field se-field-wide"><span>Cor da luz</span><input type="color" value={element.effects?.color || "#609edb"} onChange={(event) => effect({ color: event.target.value })} /></label>
          <label className="se-field se-field-wide"><span>Escala da imagem · {Math.round((element.effects?.scale || 1)*100)}%</span><input type="range" min={70} max={150} value={(element.effects?.scale || 1)*100} onChange={(event)=>effect({scale:Number(event.target.value)/100})} /></label>
          <div className="se-property-grid">{([['cropLeft','Recorte esquerdo'],['cropRight','Recorte direito'],['cropTop','Recorte superior'],['cropBottom','Recorte inferior']] as const).map(([key,label])=><NumberField key={key} label={`${label} (%)`} value={element.effects?.[key] || 0} min={0} max={40} onChange={(value)=>effect({[key]:value})} />)}</div>
        </details>
        <label className="se-checkbox"><input type="checkbox" checked={element.keepRatio === true} onChange={(event) => onPatch({ keepRatio: event.target.checked })} />Manter proporção</label>
        <label className="se-upload-button"><ImagePlus size={17} /><span>{busy ? "Enviando imagem..." : "Substituir imagem"}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={imageChange} /></label>
        <div className="se-property-grid"><NumberField label="Foco horizontal" value={element.focusX ?? 50} min={0} max={100} onChange={(focusX) => onPatch({ focusX, crop: null })} /><NumberField label="Foco vertical" value={element.focusY ?? 50} min={0} max={100} onChange={(focusY) => onPatch({ focusY, crop: null })} /></div>
        <label className="se-field se-field-wide"><span>Ajuste</span><div className="se-segmented"><button type="button" className={element.fit === "cover" ? "is-active" : ""} onClick={() => onPatch({ fit: "cover" })}>Preencher</button><button type="button" className={element.fit === "contain" ? "is-active" : ""} onClick={() => onPatch({ fit: "contain" })}>Conter</button></div></label>
      </>}
      </fieldset>
    </aside>
  );
}
