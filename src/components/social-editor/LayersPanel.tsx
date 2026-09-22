"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock, Type, Image, Layers, Square } from "lucide-react";
import type { SceneElement } from "./types";

type Props = {
  elements: SceneElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<SceneElement>) => void;
  onMove: (id: string, delta: -1 | 1) => void;
};

const names = { text: "Texto", image: "Imagem", group: "Grupo", shape: "Forma", gradient: "Gradiente" };

function LayerRows({ elements, selectedId, onSelect, onPatch, onMove, parentLocked = false }: Props & { parentLocked?: boolean }) {
  return <>{[...elements].reverse().map((element, index) => {
    const Icon = element.type === "text" ? Type : element.type === "image" ? Image : element.type === "group" ? Layers : Square;
    const selected = selectedId === element.id;
    const locked = parentLocked || element.locked;
    return <div key={element.id} className={`se-layer ${selected ? "is-selected" : ""} ${!element.visible ? "is-hidden" : ""}`}>
      <button type="button" className="se-layer-main" aria-pressed={selected} onClick={() => onSelect(element.id)}>
        <span className="se-layer-kind"><Icon size={17} /></span>
        <span><strong>{element.name}</strong><small>{names[element.type]}{locked ? " · bloqueada" : ""}</small></span>
        {locked ? <Lock size={12} /> : !element.visible ? <EyeOff size={12} /> : null}
      </button>
      {selected && <div className="se-layer-actions">
        <button type="button" disabled={locked || element.required || element.protected} title={element.visible ? "Ocultar camada" : "Mostrar camada"} aria-label={element.visible ? "Ocultar camada" : "Mostrar camada"} onClick={() => onPatch(element.id, { visible: !element.visible })}>{element.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
        <button type="button" disabled={parentLocked} title={element.locked ? "Desbloquear camada" : "Bloquear camada"} aria-label={element.locked ? "Desbloquear camada" : "Bloquear camada"} onClick={() => onPatch(element.id, { locked: !element.locked })}>{element.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
        <button type="button" disabled={locked || index === 0} title="Trazer para frente" aria-label="Trazer para frente" onClick={() => onMove(element.id, 1)}><ChevronUp size={15} /></button>
        <button type="button" disabled={locked || index === elements.length - 1} title="Enviar para trás" aria-label="Enviar para trás" onClick={() => onMove(element.id, -1)}><ChevronDown size={15} /></button>
      </div>}
      {element.children?.length ? <div className="se-layer-children"><LayerRows elements={element.children} selectedId={selectedId} onSelect={onSelect} onPatch={onPatch} onMove={onMove} parentLocked={locked} /></div> : null}
    </div>;
  })}</>;
}

export function LayersPanel(props: Props) {
  return <aside className="se-panel se-layers" aria-label="Camadas da arte">
    <div className="se-panel-heading"><span>Camadas</span><small>{props.elements.length}</small></div>
    <div className="se-layer-list"><LayerRows {...props} /></div>
  </aside>;
}
