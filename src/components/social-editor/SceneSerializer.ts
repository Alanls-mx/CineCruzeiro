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
  const elements = [...scene.elements];
  const index = elements.findIndex((element) => element.id === elementId);
  if (index < 0) return scene;
  const target = Math.max(0, Math.min(elements.length - 1, index + delta));
  if (target === index) return scene;
  const [element] = elements.splice(index, 1);
  elements.splice(target, 0, element);
  return { ...scene, elements };
}

export function duplicateElement(scene: SocialScene, elementId: string): { scene: SocialScene; id: string | null } {
  const source = findElement(scene, elementId);
  if (!source || source.required || source.protected) return { scene, id: null };
  const id = `${source.id}-copy-${Date.now().toString(36)}`;
  const copy = { ...JSON.parse(JSON.stringify(source)), id, name: `${source.name} (cópia)`, x: source.x + 18, y: source.y + 18 } as SceneElement;
  return { scene: { ...scene, elements: [...scene.elements, copy] }, id };
}
