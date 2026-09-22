"use client";

import { ImagePlus, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { ChangeEvent } from "react";
import type { SceneElement } from "./types";

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
        <label className="se-checkbox"><input type="checkbox" checked={element.keepRatio === true} onChange={(event) => onPatch({ keepRatio: event.target.checked })} />Manter proporção</label>
        <label className="se-upload-button"><ImagePlus size={17} /><span>{busy ? "Enviando imagem..." : "Substituir imagem"}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={imageChange} /></label>
        <div className="se-property-grid"><NumberField label="Foco horizontal" value={element.focusX ?? 50} min={0} max={100} onChange={(focusX) => onPatch({ focusX, crop: null })} /><NumberField label="Foco vertical" value={element.focusY ?? 50} min={0} max={100} onChange={(focusY) => onPatch({ focusY, crop: null })} /></div>
        <label className="se-field se-field-wide"><span>Ajuste</span><div className="se-segmented"><button type="button" className={element.fit === "cover" ? "is-active" : ""} onClick={() => onPatch({ fit: "cover" })}>Preencher</button><button type="button" className={element.fit === "contain" ? "is-active" : ""} onClick={() => onPatch({ fit: "contain" })}>Conter</button></div></label>
      </>}
      </fieldset>
    </aside>
  );
}
