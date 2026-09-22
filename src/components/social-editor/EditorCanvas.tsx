"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { SceneElement, SocialScene } from "./types";
import { isElementLocked } from "./SceneSerializer";

type Props = {
  scene: SocialScene;
  selectedId: string | null;
  zoom: number;
  safeArea: boolean;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SceneElement>, commit?: boolean) => void;
};

type Guide = { axis: "x" | "y"; value: number };
type ElementProps = Pick<Props, "selectedId" | "onSelect" | "onChange"> & {
  element: SceneElement;
  canvasWidth: number;
  canvasHeight: number;
  onGuides: (guides: Guide[]) => void;
};

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "")).replace(/\/$/, "");

function assetProxy(src = "", element?: SceneElement) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
  const render = element?.effects ? `&render=${encodeURIComponent(JSON.stringify({ width: element.width, height: element.height, fit: element.fit, crop: element.crop, focusX: element.focusX, focusY: element.focusY, effects: element.effects }))}` : "";
  return `${BASE_PATH}/api/admin/social-studio/assets?url=${encodeURIComponent(src)}${render}`;
}

function useRemoteImage(src = "") {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return setImage(null);
    const next = new window.Image();
    setImage(null);
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    const timer = window.setTimeout(() => { next.src = src; }, src.includes("&render=") ? 180 : 0);
    return () => { clearTimeout(timer); next.onload = null; next.onerror = null; };
  }, [src]);
  return image;
}

function coverCrop(image: HTMLImageElement | null, element: SceneElement) {
  if (!image || element.fit === "contain") return undefined;
  if (element.crop) return element.crop;
  const imageRatio = image.width / image.height;
  const boxRatio = element.width / element.height;
  let width = image.width;
  let height = image.height;
  if (imageRatio > boxRatio) width = image.height * boxRatio;
  else height = image.width / boxRatio;
  return {
    x: Math.max(0, (image.width - width) * ((element.focusX ?? 50) / 100)),
    y: Math.max(0, (image.height - height) * ((element.focusY ?? 50) / 100)),
    width,
    height,
  };
}

function gradientPoints(element: SceneElement) {
  if (element.direction === "top") return { start: { x: 0, y: element.height }, end: { x: 0, y: 0 } };
  if (element.direction === "left") return { start: { x: element.width, y: 0 }, end: { x: 0, y: 0 } };
  if (element.direction === "right") return { start: { x: 0, y: 0 }, end: { x: element.width, y: 0 } };
  return { start: { x: 0, y: 0 }, end: { x: 0, y: element.height } };
}

function ElementNode({ element, selectedId, onSelect, onChange, canvasWidth, canvasHeight, onGuides }: ElementProps) {
  const image = useRemoteImage(element.type === "image" ? assetProxy(element.src, element) : "");
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    draggable: !element.locked,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => { event.cancelBubble = true; onSelect(element.id); },
    onTap: (event: Konva.KonvaEventObject<TouchEvent>) => { event.cancelBubble = true; onSelect(element.id); },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
      const target = event.target;
      const threshold = 8;
      const guides: Guide[] = [];
      const verticalTargets = [0, canvasWidth / 2, canvasWidth];
      const horizontalTargets = [0, canvasHeight / 2, canvasHeight];
      const xPoints = [target.x(), target.x() + element.width / 2, target.x() + element.width];
      const yPoints = [target.y(), target.y() + element.height / 2, target.y() + element.height];
      for (const value of verticalTargets) {
        const index = xPoints.findIndex((point) => Math.abs(point - value) <= threshold);
        if (index >= 0) { target.x(value - [0, element.width / 2, element.width][index]); guides.push({ axis: "x", value }); break; }
      }
      for (const value of horizontalTargets) {
        const index = yPoints.findIndex((point) => Math.abs(point - value) <= threshold);
        if (index >= 0) { target.y(value - [0, element.height / 2, element.height][index]); guides.push({ axis: "y", value }); break; }
      }
      onGuides(guides);
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => { event.cancelBubble = true; onGuides([]); onChange(element.id, { x: event.target.x(), y: event.target.y() }, true); },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      event.cancelBubble = true;
      const target = event.target;
      const width = Math.max(8, target.width() * target.scaleX());
      const height = Math.max(4, target.height() * target.scaleY());
      target.scaleX(1);
      target.scaleY(1);
      onChange(element.id, { x: target.x(), y: target.y(), width, height, rotation: target.rotation() }, true);
    },
  };
  if (element.type === "text") {
    return <Text {...common} text={element.uppercase ? element.text?.toUpperCase() : element.text} fontFamily={element.fontFamily} fontSize={element.fontSize} fontStyle={element.fontFamily === "Social Display" ? "900" : "600"} fill={element.fill} align={element.align} letterSpacing={element.letterSpacing} lineHeight={element.lineHeight} verticalAlign="middle" shadowColor={element.shadowColor} shadowBlur={element.shadowBlur} wrap="word" />;
  }
  if (element.type === "image") {
    if (element.effects) return <KonvaImage {...common} image={image || undefined} />;
    const crop = coverCrop(image, element);
    if (element.fit === "contain" && image) {
      const scale = Math.min(element.width / image.width, element.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      return <Group {...common}><Rect width={element.width} height={element.height} fill="rgba(0,0,0,0)" /><KonvaImage listening={false} image={image} x={(element.width - width) * (element.focusX ?? 50) / 100} y={(element.height - height) * (element.focusY ?? 50) / 100} width={width} height={height} /></Group>;
    }
    return <KonvaImage {...common} image={image || undefined} crop={crop} />;
  }
  if (element.type === "gradient") {
    const points = gradientPoints(element);
    const stops = (element.stops || []).flatMap((stop) => [stop.offset, stop.color]);
    return <Rect {...common} fillLinearGradientStartPoint={points.start} fillLinearGradientEndPoint={points.end} fillLinearGradientColorStops={stops} />;
  }
  if (element.type === "shape") {
    return <Rect {...common} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} cornerRadius={element.radius} />;
  }
  return (
    <Group {...common}>
      {(element.children || []).map((child) => <ElementNode key={child.id} element={element.locked ? { ...child, locked: true } : child} selectedId={selectedId} onSelect={onSelect} onChange={onChange} canvasWidth={element.width} canvasHeight={element.height} onGuides={() => {}} />)}
    </Group>
  );
}

export function EditorCanvas({ scene, selectedId, zoom, safeArea, onSelect, onChange }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      new FontFace("Social Display", `url(${BASE_PATH}/fonts/social-studio/BarlowCondensed-Black.ttf)`, { weight: "900" }).load(),
      new FontFace("Social Text", `url(${BASE_PATH}/fonts/social-studio/BarlowCondensed-SemiBold.ttf)`, { weight: "600" }).load()
    ]).then((fonts) => { fonts.forEach((font) => document.fonts.add(font)); if (active) setFontsReady(true); }).catch(() => { if (active) setFontsReady(true); });
    return () => { active = false; };
  }, []);
  const selected = useMemo(() => {
    const visit = (elements: SceneElement[]): SceneElement | null => {
      for (const element of elements) {
        if (element.id === selectedId) return element;
        const nested = element.children ? visit(element.children) : null;
        if (nested) return nested;
      }
      return null;
    };
    const found = selectedId ? visit(scene.elements) : null;
    return found ? { ...found, locked: isElementLocked(scene, found.id) } : null;
  }, [scene.elements, selectedId]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage || !selectedId || selected?.locked) {
      transformer?.nodes([]);
      return;
    }
    const target = stage.findOne(`#${selectedId}`);
    transformer.nodes(target ? [target] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, selected?.locked, scene, fontsReady]);

  if (!fontsReady) return <div className="se-empty-panel" role="status">Carregando fontes...</div>;
  return (
    <div style={{ width: scene.width * zoom, height: scene.height * zoom }}>
      <Stage ref={stageRef} width={scene.width * zoom} height={scene.height * zoom} scaleX={zoom} scaleY={zoom} onMouseDown={(event) => { if (event.target === event.target.getStage()) onSelect(null); }} onTouchStart={(event) => { if (event.target === event.target.getStage()) onSelect(null); }}>
        <Layer>
          <Rect width={scene.width} height={scene.height} fill={scene.backgroundColor} listening={false} />
          {scene.elements.map((element) => <ElementNode key={element.id} element={element} selectedId={selectedId} onSelect={onSelect} onChange={onChange} canvasWidth={scene.width} canvasHeight={scene.height} onGuides={setGuides} />)}
          {guides.map((guide, index) => guide.axis === "x"
            ? <Line key={`x-${index}`} points={[guide.value, 0, guide.value, scene.height]} stroke="#f4c400" strokeWidth={1 / zoom} dash={[8 / zoom, 5 / zoom]} listening={false} />
            : <Line key={`y-${index}`} points={[0, guide.value, scene.width, guide.value]} stroke="#f4c400" strokeWidth={1 / zoom} dash={[8 / zoom, 5 / zoom]} listening={false} />)}
          {safeArea && <Rect x={scene.width * 0.07} y={scene.height * 0.06} width={scene.width * 0.86} height={scene.height * 0.88} stroke="#63b3ff" strokeWidth={2 / zoom} dash={[12 / zoom, 8 / zoom]} listening={false} />}
          {selected && !selected.locked && <Transformer ref={transformerRef} rotateEnabled flipEnabled={false} enabledAnchors={selected.keepRatio ? ["top-left", "top-right", "bottom-left", "bottom-right"] : undefined} keepRatio={selected.keepRatio === true} borderStroke="#39a8ff" anchorFill="#ffffff" anchorStroke="#1275c8" anchorSize={9} rotateAnchorOffset={28} boundBoxFunc={(oldBox, nextBox) => nextBox.width < 8 || nextBox.height < 4 ? oldBox : nextBox} />}
        </Layer>
        {safeArea && <Layer listening={false}><Line points={[scene.width / 2, 0, scene.width / 2, scene.height]} stroke="rgba(99,179,255,.45)" strokeWidth={1 / zoom} /><Line points={[0, scene.height / 2, scene.width, scene.height / 2]} stroke="rgba(99,179,255,.45)" strokeWidth={1 / zoom} /></Layer>}
      </Stage>
    </div>
  );
}
