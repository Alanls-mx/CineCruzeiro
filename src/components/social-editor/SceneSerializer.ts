import type { SceneElement, SocialScene } from "./types";

export function cloneScene(scene: SocialScene): SocialScene {
  return JSON.parse(JSON.stringify(scene)) as SocialScene;
}

export function serializeScene(scene: SocialScene): string {
  return JSON.stringify(scene);
}

export function sceneEquals(a: SocialScene, b: SocialScene): boolean {
  return serializeScene(a) === serializeScene(b);
}

export function mapElement(
  scene: SocialScene,
  elementId: string,
  update: (element: SceneElement) => SceneElement,
): SocialScene {
  const visit = (elements: SceneElement[]): SceneElement[] => elements.map((element) => {
    if (element.id === elementId) return update({ ...element });
    if (element.children?.length) return { ...element, children: visit(element.children) };
    return element;
  });
  return { ...scene, elements: visit(scene.elements) };
}

export function findElement(scene: SocialScene, elementId: string): SceneElement | null {
  const visit = (elements: SceneElement[]): SceneElement | null => {
    for (const element of elements) {
      if (element.id === elementId) return element;
      const nested = element.children?.length ? visit(element.children) : null;
      if (nested) return nested;
    }
    return null;
  };
  return visit(scene.elements);
}

export function removeElement(scene: SocialScene, elementId: string): SocialScene {
  const visit = (elements: SceneElement[]): SceneElement[] => elements
    .filter((element) => element.id !== elementId)
    .map((element) => element.children?.length ? { ...element, children: visit(element.children) } : element);
  return { ...scene, elements: visit(scene.elements) };
}

export function moveLayer(scene: SocialScene, elementId: string, delta: -1 | 1): SocialScene {
  const visit = (items: SceneElement[]): SceneElement[] => {
    const elements = [...items];
    const index = elements.findIndex((element) => element.id === elementId);
    if (index < 0) return elements.map((element) => element.children ? { ...element, children: visit(element.children) } : element);
    const target = Math.max(0, Math.min(elements.length - 1, index + delta));
    const [element] = elements.splice(index, 1);
    elements.splice(target, 0, element);
    return elements;
  };
  return { ...scene, elements: visit(scene.elements) };
}

export function copyElement(source: SceneElement): SceneElement {
  const visit = (element: SceneElement): SceneElement => ({ ...element, id: `copy-${crypto.randomUUID()}`, children: element.children?.map(visit) });
  return { ...visit(source), name: `${source.name} (cópia)`, x: source.x + 18, y: source.y + 18 };
}

export function patchGeometry(element: SceneElement, patch: Partial<SceneElement>): SceneElement {
  const next = { ...element, ...patch };
  if (element.keepRatio && Boolean(patch.width !== undefined) !== Boolean(patch.height !== undefined)) {
    if (patch.width !== undefined) next.height = element.height * next.width / element.width;
    else next.width = element.width * next.height / element.height;
  }
  if (element.children && (next.width !== element.width || next.height !== element.height)) {
    const sx = next.width / element.width;
    const sy = next.height / element.height;
    next.children = element.children.map((child) => patchGeometry(child, {
      x: child.x * sx, y: child.y * sy, width: child.width * sx, height: child.height * sy,
      ...(child.fontSize ? { fontSize: child.fontSize * Math.min(sx, sy) } : {})
    }));
  }
  return next;
}

export function isElementLocked(scene: SocialScene, id: string): boolean {
  const visit = (items: SceneElement[], inherited = false): boolean | undefined => {
    for (const element of items) {
      const locked = inherited || element.locked;
      if (element.id === id) return locked;
      const nested = element.children && visit(element.children, locked);
      if (nested !== undefined) return nested;
    }
    return undefined;
  };
  return visit(scene.elements) === true;
}

export function duplicateElement(scene: SocialScene, elementId: string): { scene: SocialScene; id: string | null } {
  const source = findElement(scene, elementId);
  if (!source || source.required || source.protected) return { scene, id: null };
  const copy = copyElement(source);
  const visit = (items: SceneElement[]): SceneElement[] => items.flatMap((element) => element.id === elementId ? [element, copy] : [{ ...element, ...(element.children ? { children: visit(element.children) } : {}) }]);
  return { scene: { ...scene, elements: visit(scene.elements) }, id: copy.id };
}
