"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import type { SceneElement } from "./types";

type Props = {
  elements: SceneElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<SceneElement>) => void;
  onMove: (id: string, delta: -1 | 1) => void;
};

export function LayersPanel({ elements, selectedId, onSelect, onPatch, onMove }: Props) {
  return (
    <aside className="se-panel se-layers" aria-label="Camadas da arte">
      <div className="se-panel-heading"><span>Camadas</span><small>{elements.length}</small></div>
      <div className="se-layer-list">
        {[...elements].reverse().map((element) => (
          <div key={element.id} className={`se-layer ${selectedId === element.id ? "is-selected" : ""}`}>
            <button type="button" className="se-layer-main" onClick={() => onSelect(element.id)}>
              <span className="se-layer-kind">{element.type === "text" ? "T" : element.type === "image" ? "IMG" : element.type === "group" ? "GRP" : "FX"}</span>
              <span><strong>{element.name}</strong><small>{element.role}</small></span>
            </button>
            <div className="se-layer-actions">
              <button type="button" title={element.visible ? "Ocultar camada" : "Mostrar camada"} aria-label={element.visible ? "Ocultar camada" : "Mostrar camada"} onClick={() => onPatch(element.id, { visible: !element.visible })}>{element.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
              <button type="button" title={element.locked ? "Desbloquear camada" : "Bloquear camada"} aria-label={element.locked ? "Desbloquear camada" : "Bloquear camada"} onClick={() => onPatch(element.id, { locked: !element.locked })}>{element.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
              <button type="button" title="Trazer para frente" aria-label="Trazer para frente" onClick={() => onMove(element.id, 1)}><ChevronUp size={15} /></button>
              <button type="button" title="Enviar para trás" aria-label="Enviar para trás" onClick={() => onMove(element.id, -1)}><ChevronDown size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
