import { LeadProfile } from "../types";

const DB_NAME = 'TradeFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'leads';

class IndexedDBService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.dbPromise = this.openDB();
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // Use companyName as the unique key
          db.createObjectStore(STORE_NAME, { keyPath: 'companyName' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // Helper to get the store
  private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    if (!db) throw new Error("Database not initialized");
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  // Get all saved leads
  async getLeads(): Promise<LeadProfile[]> {
    if (typeof window === 'undefined') return [];
    try {
      const store = await this.getStore('readonly');
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as LeadProfile[]);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to get leads:", e);
      return [];
    }
  }

  // Save a single lead
  async saveLead(lead: LeadProfile): Promise<void> {
    try {
      const store = await this.getStore('readwrite');
      store.put(lead); // put updates if exists, adds if not
    } catch (e) {
      console.error("Failed to save lead:", e);
    }
  }

  // Save multiple leads (Batch)
  async saveLeads(newLeads: LeadProfile[]): Promise<void> {
    try {
      const db = await this.dbPromise;
      if (!db) return;
      
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      newLeads.forEach(lead => {
        store.put(lead);
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to save leads batch:", e);
    }
  }

  // Delete a lead
  async deleteLead(companyName: string): Promise<void> {
    try {
      const store = await this.getStore('readwrite');
      return new Promise((resolve, reject) => {
        const request = store.delete(companyName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to delete lead:", e);
    }
  }

  // Clear all
  async clearAll(): Promise<void> {
    try {
      const store = await this.getStore('readwrite');
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to clear DB:", e);
    }
  }
}

export const storageService = new IndexedDBService();