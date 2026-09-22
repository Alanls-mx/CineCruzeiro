import { cloneScene, sceneEquals } from "./SceneSerializer";
import type { SocialScene } from "./types";

export type SceneHistory = { past: SocialScene[]; present: SocialScene; future: SocialScene[] };

export function createHistory(scene: SocialScene): SceneHistory {
  return { past: [], present: cloneScene(scene), future: [] };
}

export function commitHistory(history: SceneHistory, scene: SocialScene): SceneHistory {
  if (sceneEquals(history.present, scene)) return history;
  return {
    past: [...history.past.slice(-39), cloneScene(history.present)],
    present: cloneScene(scene),
    future: []
  };
}

export function undoHistory(history: SceneHistory): SceneHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneScene(previous),
    future: [cloneScene(history.present), ...history.future.slice(0, 39)]
  };
}

export function redoHistory(history: SceneHistory): SceneHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past.slice(-39), cloneScene(history.present)],
    present: cloneScene(next),
    future: history.future.slice(1)
  };
}
