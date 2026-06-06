import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore, // Forcing alternative connection protocols
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

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with long-polling disabled to stop client-side blocks
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: false,
});

export type LeaderboardCategory = "time" | "kills";
export const PAGE_SIZE = 20;

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

/**
 * Generates or retrieves a persistent unique client ID stored in localStorage
 */
export function getDeviceId(): string {
  let id = localStorage.getItem("dot_game_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("dot_game_device_id", id);
  }
  return id;
}

/**
 * Fetches a paginated slice of active leaderboard entries
 */
export async function getLeaderboardPage(
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean,
  pageIndex: number
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const col = collection(db, "leaderboard");
  const orderDir = category === "time" ? "desc" : "desc"; // Match your current sorting configuration

  const baseQuery = query(
    col,
    where("category", "==", category),
    where("difficulty", "==", difficulty),
    where("bigMode", "==", bigMode),
    orderBy("score", orderDir)
  );

  const allSnap = await getDocs(baseQuery);
  
  // Filter out any entries marked as soft-deleted
  const activeDocs = allSnap.docs.filter((d) => d.data().deleted !== true);

  const total = activeDocs.length;
  const start = pageIndex * PAGE_SIZE;
  const pageSlice = activeDocs.slice(start, start + PAGE_SIZE);

  const entries: LeaderboardEntry[] = pageSlice.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<LeaderboardEntry, "id">),
  }));

  return { entries, total };
}

/**
 * Hard-deletes previous submissions matching the current configuration settings
 */
export async function deleteExistingScore(
  deviceId: string,
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean
): Promise<void> {
  const col = collection(db, "leaderboard");
  const q = query(
    col,
    where("deviceId", "==", deviceId),
    where("category", "==", category),
    where("difficulty", "==", difficulty),
    where("bigMode", "==", bigMode)
  );
  
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length > 0) {
    await batch.commit();
  }
}

/**
 * Soft-deletes user submissions globally across all history fields
 */
export async function markEntriesDeleted(deviceId: string): Promise<void> {
  const col = collection(db, "leaderboard");
  const q = query(col, where("deviceId", "==", deviceId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { deleted: true });
  });
  if (snap.docs.length > 0) {
    await batch.commit();
  }
}

/**
 * Submits a fresh personal best score to the leaderboard collection
 */
export async function submitScore(
  name: string,
  color: string,
  score: number,
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean
): Promise<void> {
  const deviceId = getDeviceId();

  // Clear previous matching configurations out first
  await deleteExistingScore(deviceId, category, difficulty, bigMode);

  const col = collection(db, "leaderboard");
  await addDoc(col, {
    name,
    color,
    score,
    category,
    difficulty,
    bigMode,
    deviceId,
    timestamp: serverTimestamp(),
    deleted: false,
  });
}
