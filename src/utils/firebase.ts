import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDeUNGMqkm8tekuK2dYdMYTwg04k3D0YGo",
  authDomain: "dot-game-abb0b.firebaseapp.com",
  projectId: "dot-game-abb0b",
  storageBucket: "dot-game-abb0b.firebasestorage.app",
  messagingSenderId: "133687140686",
  appId: "1:133687140686:web:47f415a91025cf08c1fe1f",
  measurementId: "G-DQX7FCE5F6",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: false,
});

export type LeaderboardCategory = "time" | "kills";
export const PAGE_SIZE = 5;

export interface LeaderboardEntry {
  id?: string;
  name: string;
  color: string;
  score: number; 
  category: LeaderboardCategory;
  difficulty: string;
  bigMode: boolean;
  deviceId: string;
  timestamp?: any;
  deleted?: boolean;
}

export function getDeviceId(): string {
  let id = localStorage.getItem("dot_game_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("dot_game_device_id", id);
  }
  return id;
}

export async function getLeaderboardPage(
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean,
  pageIndex: number
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  try {
    // Fallbacks just in case the UI fails to pass these down
    const safeCategory = category || "time";
    const safeDifficulty = difficulty || "Medium";
    const safeBigMode = bigMode ?? false;

    const col = collection(db, "leaderboard");
    const orderDir = "desc";

    const baseQuery = query(
      col,
      where("category", "==", safeCategory),
      where("difficulty", "==", safeDifficulty),
      where("bigMode", "==", safeBigMode),
      orderBy("score", orderDir)
    );

    const allSnap = await getDocs(baseQuery);
    const activeDocs = allSnap.docs.filter((d) => d.data().deleted !== true);

    const total = activeDocs.length;
    const start = pageIndex * PAGE_SIZE;
    const pageSlice = activeDocs.slice(start, start + PAGE_SIZE);

    const entries: LeaderboardEntry[] = pageSlice.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LeaderboardEntry, "id">),
    }));

    return { entries, total };
  } catch (error) {
    console.error("Leaderboard connection dropped: ", error);
    return { entries: [], total: 0 };
  }
}

export async function deleteExistingScore(
  deviceId: string,
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean
): Promise<void> {
  try {
    // Bulletproof fallbacks to prevent the "where() undefined" crash
    const safeCategory = category || "time";
    const safeDifficulty = difficulty || "Medium";
    const safeBigMode = bigMode ?? false;

    const col = collection(db, "leaderboard");
    const q = query(
      col,
      where("deviceId", "==", deviceId),
      where("category", "==", safeCategory),
      where("difficulty", "==", safeDifficulty),
      where("bigMode", "==", safeBigMode)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length > 0) await batch.commit();
  } catch (error) {
    console.error("Failed to clear existing score:", error);
  }
}

export async function markEntriesDeleted(deviceId: string): Promise<void> {
  const col = collection(db, "leaderboard");
  const q = query(col, where("deviceId", "==", deviceId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { deleted: true }));
  if (snap.docs.length > 0) await batch.commit();
}

export async function submitScore(
  name: string,
  color: string,
  score: number,
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean
): Promise<void> {
  try {
    const deviceId = getDeviceId();
    
    // Bulletproof fallbacks to prevent the "addDoc undefined color" crash
    const safeName = name || "Anonymous";
    const safeColor = color || "#FFFFFF"; // Instantly fixes the color bug
    const safeScore = score ?? 0;
    const safeCategory = category || "time";
    const safeDifficulty = difficulty || "Medium";
    const safeBigMode = bigMode ?? false;

    await deleteExistingScore(deviceId, safeCategory, safeDifficulty, safeBigMode);

    const col = collection(db, "leaderboard");
    await addDoc(col, {
      name: safeName,
      color: safeColor,
      score: safeScore,
      category: safeCategory,
      difficulty: safeDifficulty,
      bigMode: safeBigMode,
      deviceId,
      timestamp: serverTimestamp(),
      deleted: false,
    });
  } catch (error) {
    console.error("Submission failed: ", error);
    throw error;
  }
}