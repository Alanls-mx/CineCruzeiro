"use client";

import { ArrowLeft, Download, Grid3X3, Redo2, RotateCcw, Save, Undo2, ZoomIn, Type, Square, Clapperboard } from "lucide-react";

type Props = {
  title: string;
  format: string;
  zoom: number;
  autoFit: boolean;
  safeArea: boolean;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (zoom: number) => void;
  onToggleSafeArea: () => void;
  onSave: () => void;
  onAnimate: () => void;
  onExport: (type: "png" | "jpg") => void;
  onReset: () => void;
  onAdd: (type: "text" | "shape") => void;
};

export function Toolbar(props: Props) {
  return (
    <header className="se-toolbar">
      <div className="se-toolbar-brand">
        <button type="button" className="se-icon-button" title="Voltar ao Social Studio" aria-label="Voltar ao Social Studio" disabled={props.busy} onClick={props.onBack}><ArrowLeft size={19} /></button>
        <div><strong>{props.title}</strong><small>{props.format} · edição manual</small></div>
      </div>
      <div className="se-toolbar-cluster">
        <button type="button" className="se-icon-button" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={props.busy || !props.canUndo} onClick={props.onUndo}><Undo2 size={18} /></button>
        <button type="button" className="se-icon-button" title="Refazer (Ctrl+Y)" aria-label="Refazer" disabled={props.busy || !props.canRedo} onClick={props.onRedo}><Redo2 size={18} /></button>
        <button type="button" className="se-icon-button" title="Adicionar texto" aria-label="Adicionar texto" disabled={props.busy} onClick={() => props.onAdd("text")}><Type size={18} /></button>
        <button type="button" className="se-icon-button" title="Adicionar forma" aria-label="Adicionar forma" disabled={props.busy} onClick={() => props.onAdd("shape")}><Square size={18} /></button>
        <span className="se-toolbar-divider" />
        <button type="button" className={`se-icon-button ${props.safeArea ? "is-active" : ""}`} title="Alternar margens seguras" aria-label="Alternar margens seguras" onClick={props.onToggleSafeArea}><Grid3X3 size={18} /></button>
        <div className="se-zoom-control"><ZoomIn size={16} /><select aria-label="Zoom da arte" value={props.autoFit ? 0 : props.zoom} onChange={(event) => props.onZoom(Number(event.target.value))}><option value={0}>Ajustar</option><option value={0.25}>25%</option><option value={0.5}>50%</option><option value={0.75}>75%</option><option value={1}>100%</option></select></div>
      </div>
      <div className="se-toolbar-actions">
        <span className={`se-save-state is-${props.saveState}`} role="status">{props.busy ? "Processando..." : props.saveState === "saving" ? "Salvando..." : props.saveState === "saved" ? "Rascunho salvo" : props.saveState === "error" ? "Falha ao salvar" : ""}</span>
        <button type="button" className="se-icon-button" title="Restaurar composição automática" aria-label="Restaurar composição automática" disabled={props.busy} onClick={props.onReset}><RotateCcw size={17} /></button>
        <div className="se-export-menu"><button type="button" className="se-button se-button-muted" disabled={props.busy} onClick={() => props.onExport("png")}><Download size={17} />Exportar PNG</button><button type="button" title="Exportar JPG" aria-label="Exportar JPG" disabled={props.busy} onClick={() => props.onExport("jpg")}>JPG</button></div>
        <button type="button" className="se-button se-button-primary" disabled={props.busy} onClick={props.onSave}><Save size={17} />Salvar nova versão</button>
        <button type="button" className="se-button se-button-muted" disabled={props.busy} onClick={props.onAnimate}><Clapperboard size={17} />Animar esta arte</button>
      </div>
    </header>
  );
}
