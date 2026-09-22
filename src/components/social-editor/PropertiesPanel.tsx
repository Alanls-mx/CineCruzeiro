"use client";

import { ImagePlus } from "lucide-react";
import type { ChangeEvent } from "react";
import type { SceneElement } from "./types";

type Props = {
  element: SceneElement | null;
  busy: boolean;
  onPatch: (patch: Partial<SceneElement>, commit?: boolean) => void;
  onUpload: (file: File) => void;
};

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="se-field"><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function PropertiesPanel({ element, busy, onPatch, onUpload }: Props) {
  if (!element) return <aside className="se-panel se-properties"><div className="se-panel-heading"><span>Propriedades</span></div><div className="se-empty-panel">Selecione um elemento na arte ou na lista de camadas.</div></aside>;
  const imageChange = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; };
  return (
    <aside className="se-panel se-properties" aria-label="Propriedades do elemento">
      <div className="se-panel-heading"><span>Propriedades</span><small>{element.name}</small></div>
      {element.protected && <div className="se-protected">Elemento de marca protegido. É possível reposicionar e redimensionar, mas não remover.</div>}
      <div className="se-property-grid">
        <NumberField label="X" value={Math.round(element.x)} onChange={(x) => onPatch({ x })} />
        <NumberField label="Y" value={Math.round(element.y)} onChange={(y) => onPatch({ y })} />
        <NumberField label="Largura" value={Math.round(element.width)} min={8} onChange={(width) => onPatch({ width })} />
        <NumberField label="Altura" value={Math.round(element.height)} min={4} onChange={(height) => onPatch({ height })} />
        <NumberField label="Rotação" value={Math.round(element.rotation)} min={-180} max={180} onChange={(rotation) => onPatch({ rotation })} />
        <NumberField label="Opacidade" value={Number(element.opacity.toFixed(2))} min={0} max={1} step={0.05} onChange={(opacity) => onPatch({ opacity })} />
      </div>
      {element.type === "text" && <>
        <label className="se-field se-field-wide"><span>Texto</span><textarea rows={5} value={element.text || ""} onChange={(event) => onPatch({ text: event.target.value }, false)} onBlur={() => onPatch({}, true)} /></label>
        <div className="se-property-grid">
          <label className="se-field"><span>Fonte</span><select value={element.fontFamily} onChange={(event) => onPatch({ fontFamily: event.target.value as SceneElement["fontFamily"] })}><option value="Social Text">Texto</option><option value="Social Display">Destaque</option></select></label>
          <NumberField label="Tamanho" value={element.fontSize || 42} min={12} max={320} onChange={(fontSize) => onPatch({ fontSize })} />
          <NumberField label="Peso" value={element.fontWeight || 600} min={300} max={900} step={100} onChange={(fontWeight) => onPatch({ fontWeight })} />
          <NumberField label="Espaçamento" value={element.letterSpacing || 0} min={0} max={30} step={0.5} onChange={(letterSpacing) => onPatch({ letterSpacing })} />
        </div>
        <label className="se-field se-field-wide"><span>Alinhamento</span><div className="se-segmented">{(["left", "center", "right"] as const).map((align) => <button type="button" className={element.align === align ? "is-active" : ""} key={align} onClick={() => onPatch({ align })}>{align === "left" ? "Esquerda" : align === "right" ? "Direita" : "Centro"}</button>)}</div></label>
        <label className="se-field"><span>Cor</span><input type="color" value={element.fill || "#ffffff"} onChange={(event) => onPatch({ fill: event.target.value })} /></label>
      </>}
      {element.type === "shape" && <div className="se-property-grid"><label className="se-field"><span>Cor</span><input type="color" value={element.fill || "#ffffff"} onChange={(event) => onPatch({ fill: event.target.value })} /></label><NumberField label="Cantos" value={element.radius || 0} min={0} max={100} onChange={(radius) => onPatch({ radius })} /></div>}
      {element.type === "image" && <>
        <label className="se-upload-button"><ImagePlus size={17} /><span>{busy ? "Enviando imagem..." : "Substituir imagem"}</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={imageChange} /></label>
        <div className="se-property-grid"><NumberField label="Foco horizontal" value={element.focusX ?? 50} min={0} max={100} onChange={(focusX) => onPatch({ focusX, crop: null })} /><NumberField label="Foco vertical" value={element.focusY ?? 50} min={0} max={100} onChange={(focusY) => onPatch({ focusY, crop: null })} /></div>
        <label className="se-field se-field-wide"><span>Ajuste</span><div className="se-segmented"><button type="button" className={element.fit === "cover" ? "is-active" : ""} onClick={() => onPatch({ fit: "cover" })}>Preencher</button><button type="button" className={element.fit === "contain" ? "is-active" : ""} onClick={() => onPatch({ fit: "contain" })}>Conter</button></div></label>
      </>}
    </aside>
  );
}
