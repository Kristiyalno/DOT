import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  DocumentSnapshot,
  serverTimestamp,
  writeBatch,
  getDoc,
  setDoc,
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
export const db = getFirestore(app);

export type LeaderboardCategory = "time" | "kills";
export const PAGE_SIZE = 20;

export interface LeaderboardEntry {
  id?: string;
  name: string;
  color: string;
  score: number; // seconds for time, count for kills
  category: LeaderboardCategory;
  difficulty: string;
  bigMode: boolean;
  deviceId: string;
  deleted?: boolean;
  timestamp?: any;
}

// Get or create a stable device ID for this browser
export function getDeviceId(): string {
  let id = localStorage.getItem("dot_device_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("dot_device_id", id);
  }
  return id;
}

export async function submitScore(entry: Omit<LeaderboardEntry, "id" | "timestamp">): Promise<string> {
  const ref = await addDoc(collection(db, "leaderboard"), {
    ...entry,
    timestamp: serverTimestamp(),
    deleted: false,
  });
  return ref.id;
}

export async function getLeaderboardPage(
  category: LeaderboardCategory,
  difficulty: string,
  bigMode: boolean,
  pageIndex: number
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const col = collection(db, "leaderboard");
  const orderDir = "desc";

  // Query without `deleted` field to avoid needing a 5-field composite index.
  // Deleted entries are filtered out client-side after fetch.
  const baseQuery = query(
    col,
    where("category", "==", category),
    where("difficulty", "==", difficulty),
    where("bigMode", "==", bigMode),
    orderBy("score", orderDir)
  );

  const allSnap = await getDocs(baseQuery);
  // Filter deleted entries client-side
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
  if (snap.docs.length > 0) await batch.commit();
}

export async function markEntriesDeleted(deviceId: string): Promise<void> {
  const col = collection(db, "leaderboard");
  const q = query(col, where("deviceId", "==", deviceId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { deleted: true, name: "[deleted_account]" });
  });
  await batch.commit();
}
