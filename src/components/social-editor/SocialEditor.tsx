"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { EditorCanvas } from "./EditorCanvas";
import { createHistory, commitHistory, redoHistory, undoHistory, type SceneHistory } from "./HistoryManager";
import { cloneScene, copyElement, duplicateElement, findElement, isElementLocked, mapElement, moveLayer, patchGeometry, removeElement } from "./SceneSerializer";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";
import type { SceneElement, SceneResponse, SocialPostSummary, SocialScene } from "./types";
import "./social-editor.css";

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "")).replace(/\/$/, "");

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_PATH}${url}`, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente no painel em outra aba para preservar esta edição.");
  if (response.status === 403) throw new Error("Você não tem permissão para esta ação. Solicite acesso ao administrador.");
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
  const [autoFit, setAutoFit] = useState(true);
  const [safeArea, setSafeArea] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const clipboard = useRef<SceneElement | null>(null);
  const canvasArea = useRef<HTMLDivElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestScene = useRef<SocialScene | null>(null);
  const operation = useRef(false);
  const scene = history?.present || null;
  latestScene.current = scene;
  const selected = useMemo(() => {
    const element = scene && selectedId ? findElement(scene, selectedId) : null;
    return element && scene ? { ...element, locked: isElementLocked(scene, element.id) } : null;
  }, [scene, selectedId]);

  useEffect(() => {
    if (!scene || !canvasArea.current || !autoFit) return;
    const container = canvasArea.current;
    const resize = () => setZoom(Math.max(.1, Math.min(1, (container.clientWidth - 48) / scene.width, (container.clientHeight - 48) / scene.height)));
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [scene?.width, scene?.height, autoFit, Boolean(post)]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const patchElement = useCallback((id: string, patch: Partial<SceneElement>) => {
    if (operation.current) return;
    setHistory((current) => {
      if (!current) return current;
      if (isElementLocked(current.present, id) && Object.keys(patch).some((key) => key !== "locked")) return current;
      const next = mapElement(current.present, id, (element) => patchGeometry(element, patch));
      return commitHistory(current, next);
    });
    setDirty(true);
    setSaveState("idle");
  }, []);

  const persistDraft = useCallback((snapshot: SocialScene) => {
    const task = saveQueue.current.catch(() => {}).then(async () => {
      setSaveState("saving");
      await api(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-draft`, { method: "PUT", body: JSON.stringify({ scene: snapshot }) });
      if (JSON.stringify(latestScene.current) === JSON.stringify(snapshot)) { setDirty(false); setSaveState("saved"); }
    });
    saveQueue.current = task;
    return task;
  }, [postId]);

  useEffect(() => {
    if (!scene || !dirty || busy) return;
    const timer = window.setTimeout(async () => {
      if (operation.current) return;
      try {
        await persistDraft(scene);
      } catch (reason) {
        setSaveState("error");
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar o rascunho.");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [scene, dirty, busy, persistDraft]);

  const removeSelected = useCallback(() => {
    if (!scene || !selected || selected.locked || operation.current) return;
    if (selected.required || selected.protected) return setError("Este elemento faz parte da identidade obrigatória da arte e não pode ser excluído.");
    replaceScene(removeElement(scene, selected.id));
    setSelectedId(null);
  }, [replaceScene, scene, selected]);

  const duplicateSelected = useCallback(() => {
    if (!scene || !selectedId || selected?.locked || operation.current) return;
    const result = duplicateElement(scene, selectedId);
    if (result.id) { replaceScene(result.scene); setSelectedId(result.id); }
  }, [replaceScene, scene, selectedId, selected?.locked]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName);
      const modifier = event.ctrlKey || event.metaKey;
      if (typing || operation.current) return;
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); setHistory((current) => current ? (event.shiftKey ? redoHistory(current) : undoHistory(current)) : current); setDirty(true); return; }
      if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); setHistory((current) => current ? redoHistory(current) : current); setDirty(true); return; }
      if (!scene) return;
      if (modifier && event.key.toLowerCase() === "v" && clipboard.current) {
        event.preventDefault();
        const pasted = copyElement(clipboard.current);
        replaceScene({ ...scene, elements: [...scene.elements, pasted] });
        clipboard.current = pasted;
        setSelectedId(pasted.id);
        return;
      }
      if (!selected || selected.locked) return;
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); return; }
      if (modifier && event.key.toLowerCase() === "c") {
        if (!selected.required && !selected.protected) clipboard.current = cloneScene({ ...scene, elements: [selected] }).elements[0];
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
    if (file.size > 5 * 1024 * 1024) return setError("Use uma imagem JPG, PNG ou WebP de até 5 MB.");
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); });
      const uploaded = await api<{ publicUrl: string }>("/api/admin/social-studio/uploads", { method: "POST", body: JSON.stringify({ data, filename: file.name, contentType: file.type }) });
      patchElement(selectedId, { src: uploaded.publicUrl, crop: null, focusX: 50, focusY: 50 });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a imagem."); }
    finally { setBusy(false); }
  };

  const saveVersion = async (animate = false) => {
    if (!scene || operation.current) return;
    operation.current = true;
    setBusy(true); setError("");
    try {
      await saveQueue.current.catch(() => {});
      const result = await api<{ post: SocialPostSummary; scene: SocialScene }>(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-versions`, { method: "POST", body: JSON.stringify({ scene, outputType: post?.outputType || "png" }) });
      setPost(result.post); setHistory(createHistory(result.scene)); setDirty(false); setSaveState("saved");
      if(animate) window.location.href = `${BASE_PATH}/admin/?studio=1&animatePost=${encodeURIComponent(postId)}#marketingPanel`;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a nova versão."); }
    finally { operation.current = false; setBusy(false); }
  };

  const exportScene = async (outputType: "png" | "jpg") => {
    if (!scene || operation.current) return;
    operation.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-export`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scene, outputType }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error?.message || "Não foi possível exportar a arte.");
      downloadBlob(await response.blob(), `${(post?.title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-editado.${outputType}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível exportar a arte."); }
    finally { operation.current = false; setBusy(false); }
  };

  const resetScene = async () => {
    if (operation.current || !scene || !originalScene || !window.confirm("Restaurar a composição automática? O rascunho manual atual será descartado, mas as versões já salvas continuarão no histórico.")) return;
    operation.current = true;
    setBusy(true);
    try {
      await saveQueue.current.catch(() => {});
      const result = await api<{ post: SocialPostSummary; scene: SocialScene }>(`/api/admin/social-studio/posts/${encodeURIComponent(postId)}/scene-reset`, { method: "POST", body: "{}" });
      setPost(result.post); setHistory(createHistory(result.scene)); setSelectedId(null); setDirty(false); setSaveState("saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível restaurar a arte."); }
    finally { operation.current = false; setBusy(false); }
  };

  const goBack = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      if (scene && dirty) await persistDraft(scene);
      else await saveQueue.current;
      window.location.href = `${BASE_PATH}/admin/?studio=1#marketingPanel`;
    } catch { setError("O rascunho não foi salvo. Tente novamente antes de sair."); }
    finally { operation.current = false; setBusy(false); }
  };

  const addElement = (type: "text" | "shape") => {
    if (!scene || busy) return;
    if (scene.elements.length >= 80) return setError("Limite de 80 camadas atingido.");
    const id = `${type}-${crypto.randomUUID()}`;
    const element: SceneElement = { id, name: type === "text" ? "Novo texto" : "Nova forma", role: type, type,
      x: scene.width * .2, y: scene.height * .45, width: scene.width * .6, height: 100,
      rotation: 0, opacity: 1, visible: true, locked: false, required: false, protected: false,
      fill: type === "text" ? "#ffffff" : "#1275c8", ...(type === "text" ? { text: "Seu texto", fontFamily: "Social Text", fontSize: 48, fontWeight: 600, align: "center", lineHeight: 1.12 } : {}) };
    replaceScene({ ...scene, elements: [...scene.elements, element] });
    setSelectedId(id);
  };

  if (error && !scene) return <main className="se-state"><div><strong>Não foi possível abrir o editor</strong><p>{error}</p><button onClick={() => window.location.href = `${BASE_PATH}/admin/`}>Voltar ao painel</button></div></main>;
  if (!scene || !post) return <main className="se-state"><div className="se-loader" /><p>Preparando a cena editável...</p></main>;

  return (
    <main className="se-app">
      <Toolbar title={post.title || post.templateName} format={post.formatName} zoom={zoom} autoFit={autoFit} safeArea={safeArea} canUndo={Boolean(history?.past.length)} canRedo={Boolean(history?.future.length)} busy={busy} saveState={saveState} onBack={goBack} onAdd={addElement} onUndo={() => { setHistory((current) => current ? undoHistory(current) : current); setDirty(true); }} onRedo={() => { setHistory((current) => current ? redoHistory(current) : current); setDirty(true); }} onZoom={(next) => { setAutoFit(next === 0); if (next) setZoom(next); }} onToggleSafeArea={() => setSafeArea((value) => !value)} onSave={() => saveVersion()} onAnimate={() => saveVersion(true)} onExport={exportScene} onReset={resetScene} />
      {error && <div className="se-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}
      <div className="se-workspace" inert={busy}>
        <LayersPanel elements={scene.elements} selectedId={selectedId} onSelect={setSelectedId} onPatch={(id, patch) => patchElement(id, patch)} onMove={(id, delta) => replaceScene(moveLayer(scene, id, delta))} />
        <section className="se-canvas-area" aria-label="Área de edição da arte">
          <div className="se-canvas-toolbar"><span>{scene.width} × {scene.height} px · {Math.round(zoom * 100)}%</span>{selected && <div><button type="button" title="Duplicar elemento" aria-label="Duplicar elemento" disabled={selected.locked || selected.required || selected.protected} onClick={duplicateSelected}><Copy size={16} /></button><button type="button" title="Excluir elemento" aria-label="Excluir elemento" disabled={selected.locked || selected.required || selected.protected} onClick={removeSelected}><Trash2 size={16} /></button></div>}</div>
          <div className="se-canvas-scroll" ref={canvasArea}><div className="se-canvas-frame"><EditorCanvas scene={scene} selectedId={selectedId} zoom={zoom} safeArea={safeArea} onSelect={setSelectedId} onChange={patchElement} /></div></div>
        </section>
        <PropertiesPanel element={selected} busy={busy} onPatch={(patch) => selectedId && patchElement(selectedId, patch)} onUpload={uploadImage} />
      </div>
    </main>
  );
}
