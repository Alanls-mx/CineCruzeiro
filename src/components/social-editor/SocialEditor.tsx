"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { EditorCanvas } from "./EditorCanvas";
import { createHistory, commitHistory, redoHistory, undoHistory, type SceneHistory } from "./HistoryManager";
import { cloneScene, duplicateElement, findElement, mapElement, moveLayer, removeElement } from "./SceneSerializer";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";
import type { SceneElement, SceneResponse, SocialPostSummary, SocialScene } from "./types";
import "./social-editor.css";

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "")).replace(/\/$/, "");

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_PATH}${url}`, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  if (response.status === 401 || response.status === 403) {
    window.location.href = `${BASE_PATH}/admin/`;
    throw new Error("Sessão administrativa expirada.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível concluir esta operação.");
  return payload as T;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SocialEditor({ postId }: { postId: string }) {
  const [history, setHistory] = useState<SceneHistory | null>(null);
  const [originalScene, setOriginalScene] = useState<SocialScene | null>(null);
  const [post, setPost] = useState<SocialPostSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [safeArea, setSafeArea] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const clipboard = useRef<SceneElement | null>(null);
  const scene = history?.present || null;
  const selected = useMemo(() => scene && selectedId ? findElement(scene, selectedId) : null, [scene, selectedId]);

  useEffect(() => {
    let active = true;
    api<SceneResponse>(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene`)
      .then((payload) => {
        if (!active) return;
        setPost(payload.post);
        setOriginalScene(payload.originalScene);
        setHistory(createHistory(payload.scene));
      })
      .catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [postId]);

  const replaceScene = useCallback((next: SocialScene, commit = true) => {
    setHistory((current) => {
      if (!current) return createHistory(next);
      return commit ? commitHistory(current, next) : { ...current, present: next };
    });
    setDirty(true);
    setSaveState("idle");
  }, []);

  const patchElement = useCallback((id: string, patch: Partial<SceneElement>, commit = true) => {
    setHistory((current) => {
      if (!current) return current;
      const next = mapElement(current.present, id, (element) => ({ ...element, ...patch }));
      return commit ? commitHistory(current, next) : { ...current, present: next };
    });
    setDirty(true);
    setSaveState("idle");
  }, []);

  useEffect(() => {
    if (!scene || !dirty) return;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await api(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-draft`, { method: "PUT", body: JSON.stringify({ scene }) });
        setSaveState("saved");
      } catch (reason) {
        setSaveState("error");
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar o rascunho.");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [scene, dirty, postId]);

  const removeSelected = useCallback(() => {
    if (!scene || !selected) return;
    if (selected.required || selected.protected) return setError("Este elemento faz parte da identidade obrigatória da arte e não pode ser excluído.");
    replaceScene(removeElement(scene, selected.id));
    setSelectedId(null);
  }, [replaceScene, scene, selected]);

  const duplicateSelected = useCallback(() => {
    if (!scene || !selectedId) return;
    const result = duplicateElement(scene, selectedId);
    if (result.id) { replaceScene(result.scene); setSelectedId(result.id); }
  }, [replaceScene, scene, selectedId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName);
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); setHistory((current) => current ? (event.shiftKey ? redoHistory(current) : undoHistory(current)) : current); setDirty(true); return; }
      if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); setHistory((current) => current ? redoHistory(current) : current); setDirty(true); return; }
      if (typing || !scene || !selected) return;
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); return; }
      if (modifier && event.key.toLowerCase() === "c") {
        if (!selected.required && !selected.protected) clipboard.current = cloneScene({ ...scene, elements: [selected] }).elements[0];
        return;
      }
      if (modifier && event.key.toLowerCase() === "v" && clipboard.current) {
        event.preventDefault();
        const pasted = { ...cloneScene({ ...scene, elements: [clipboard.current] }).elements[0], id: `${clipboard.current.id}-paste-${Date.now().toString(36)}`, x: clipboard.current.x + 18, y: clipboard.current.y + 18 };
        replaceScene({ ...scene, elements: [...scene.elements, pasted] });
        clipboard.current = pasted;
        setSelectedId(pasted.id);
        return;
      }
      if (modifier && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const patch = event.key === "ArrowLeft" ? { x: selected.x - step } : event.key === "ArrowRight" ? { x: selected.x + step } : event.key === "ArrowUp" ? { y: selected.y - step } : { y: selected.y + step };
        patchElement(selected.id, patch);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [duplicateSelected, patchElement, removeSelected, replaceScene, scene, selected]);

  const uploadImage = async (file: File) => {
    if (!selectedId || !file.type.match(/^image\/(png|jpeg|webp)$/)) return;
    if (file.size > 8 * 1024 * 1024) return setError("A imagem deve ter no máximo 8 MB.");
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); });
      const uploaded = await api<{ publicUrl: string }>("/api/admin/social-studio/uploads", { method: "POST", body: JSON.stringify({ data, filename: file.name, contentType: file.type }) });
      patchElement(selectedId, { src: uploaded.publicUrl, crop: null, focusX: 50, focusY: 50 });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a imagem."); }
    finally { setBusy(false); }
  };

  const saveVersion = async () => {
    if (!scene) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ post: SocialPostSummary; scene: SocialScene }>(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-versions`, { method: "POST", body: JSON.stringify({ scene, outputType: post?.outputType || "png" }) });
      setPost(result.post); setHistory(createHistory(result.scene)); setDirty(false); setSaveState("saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a nova versão."); }
    finally { setBusy(false); }
  };

  const exportScene = async (outputType: "png" | "jpg") => {
    if (!scene) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-export`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scene, outputType }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error?.message || "Não foi possível exportar a arte.");
      downloadBlob(await response.blob(), `${(post?.title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-editado.${outputType}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível exportar a arte."); }
    finally { setBusy(false); }
  };

  const resetScene = async () => {
    if (!scene || !originalScene || !window.confirm("Restaurar a composição automática? O rascunho manual atual será descartado, mas as versões já salvas continuarão no histórico.")) return;
    setBusy(true);
    try {
      const result = await api<{ post: SocialPostSummary; scene: SocialScene }>(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-reset`, { method: "POST", body: "{}" });
      setPost(result.post); setHistory(createHistory(result.scene)); setSelectedId(null); setDirty(false); setSaveState("saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível restaurar a arte."); }
    finally { setBusy(false); }
  };

  if (error && !scene) return <main className="se-state"><div><strong>Não foi possível abrir o editor</strong><p>{error}</p><button onClick={() => window.location.href = `${BASE_PATH}/admin/`}>Voltar ao painel</button></div></main>;
  if (!scene || !post) return <main className="se-state"><div className="se-loader" /><p>Preparando a cena editável...</p></main>;

  return (
    <main className="se-app">
      <Toolbar title={post.title || post.templateName} format={post.formatName} zoom={zoom} safeArea={safeArea} canUndo={Boolean(history?.past.length)} canRedo={Boolean(history?.future.length)} busy={busy} saveState={saveState} onBack={() => window.location.href = `${BASE_PATH}/admin/`} onUndo={() => { setHistory((current) => current ? undoHistory(current) : current); setDirty(true); }} onRedo={() => { setHistory((current) => current ? redoHistory(current) : current); setDirty(true); }} onZoom={setZoom} onToggleSafeArea={() => setSafeArea((value) => !value)} onSave={saveVersion} onExport={exportScene} onReset={resetScene} />
      {error && <div className="se-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}
      <div className="se-workspace">
        <LayersPanel elements={scene.elements} selectedId={selectedId} onSelect={setSelectedId} onPatch={(id, patch) => patchElement(id, patch)} onMove={(id, delta) => replaceScene(moveLayer(scene, id, delta))} />
        <section className="se-canvas-area" aria-label="Área de edição da arte">
          <div className="se-canvas-toolbar"><span>{scene.width} × {scene.height} px</span>{selected && <div><button type="button" title="Duplicar elemento" aria-label="Duplicar elemento" onClick={duplicateSelected}><Copy size={16} /></button><button type="button" title="Excluir elemento" aria-label="Excluir elemento" disabled={selected.required || selected.protected} onClick={removeSelected}><Trash2 size={16} /></button></div>}</div>
          <div className="se-canvas-scroll"><div className="se-canvas-frame"><EditorCanvas scene={scene} selectedId={selectedId} zoom={zoom} safeArea={safeArea} onSelect={setSelectedId} onChange={patchElement} /></div></div>
        </section>
        <PropertiesPanel element={selected} busy={busy} onPatch={(patch, commit) => selectedId && patchElement(selectedId, patch, commit)} onUpload={uploadImage} />
      </div>
    </main>
  );
}
