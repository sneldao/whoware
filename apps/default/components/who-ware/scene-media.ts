import type { ImageSourcePropType } from "react-native";

import bedroomMemory from "../../../../assets/images/whoware-memory-bedroom.png";
import broadcastMemory from "../../../../assets/images/whoware-memory-broadcast.png";
import commonsMemory from "../../../../assets/images/whoware-memory-commons.png";
import officeMemory from "../../../../assets/images/whoware-memory-office.png";
import warRoomsMemory from "../../../../assets/images/whoware-memory-war-rooms.png";

export const sceneImageSources = {
  bedroom: bedroomMemory,
  broadcast: broadcastMemory,
  commons: commonsMemory,
  office: officeMemory,
  warRooms: warRoomsMemory,
} satisfies Record<string, ImageSourcePropType>;

export const fallbackImageKeys = ["bedroom", "warRooms", "office", "commons", "broadcast"] as const;

export type SceneImageKey = keyof typeof sceneImageSources;

export function isSceneImageKey(value: string | undefined): value is SceneImageKey {
  return value !== undefined && value in sceneImageSources;
}

export function getSceneImageSource(
  imageKey: string | undefined,
  fallbackIndex: number,
  imageUrl?: string,
): ImageSourcePropType {
  if (imageUrl) return { uri: imageUrl };
  const fallbackImageKey = fallbackImageKeys[fallbackIndex] ?? "bedroom";
  return isSceneImageKey(imageKey) ? sceneImageSources[imageKey] : sceneImageSources[fallbackImageKey];
}
