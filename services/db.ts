import { IDBPDatabase, openDB } from 'https://esm.sh/idb@7';

const DB_NAME = 'focusflow-db';
const DB_VERSION = 5; // Incremented version for schema change

const upgradeDB = (db: IDBPDatabase) => {
    if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('dueDate', 'dueDate'); // Add index for date queries
    } else if (!db.transaction('tasks').store.indexNames.contains('dueDate')) {
        db.transaction('tasks', 'readwrite').store.createIndex('dueDate', 'dueDate');
    }

    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('journal')) {
        const journalStore = db.createObjectStore('journal', { keyPath: 'id' });
        journalStore.createIndex('createdAt', 'createdAt'); // Add index for date queries
    } else if (!db.transaction('journal').store.indexNames.contains('createdAt')) {
        db.transaction('journal', 'readwrite').store.createIndex('createdAt', 'createdAt');
    }
    
    if (!db.objectStoreNames.contains('achievements')) {
        const achievementStore = db.createObjectStore('achievements', { keyPath: 'id' });
        achievementStore.createIndex('date', 'date');
    }

    if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('timelines')) {
        db.createObjectStore('timelines', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('userProfile')) {
        db.createObjectStore('userProfile'); // Key-value store
    }
    if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings'); // Key-value store
    }
    if (!db.objectStoreNames.contains('feedback-outbox')) {
        db.createObjectStore('feedback-outbox', { keyPath: 'id' });
    }
};

const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        upgradeDB(db);
    },
});

export const db = {
    async get(storeName: string, key: IDBValidKey) {
        return (await dbPromise).get(storeName, key);
    },
    async getAll(storeName: string) {
        return (await dbPromise).getAll(storeName);
    },
    async getAllKeys(storeName: string) {
        return (await dbPromise).getAllKeys(storeName);
    },
    async getAllByIndex(storeName: string, indexName: string, query: any) {
        return (await dbPromise).getAllFromIndex(storeName, indexName, query);
    },
    async put(storeName: string, value: any, key?: IDBValidKey) {
        const tx = (await dbPromise).transaction(storeName, 'readwrite');
        tx.store.put(value, key);
        return tx.done;
    },
    async putAll(storeName: string, values: any[]) {
        const tx = (await dbPromise).transaction(storeName, 'readwrite');
        for (const value of values) {
            tx.store.put(value);
        }
        return tx.done;
    },
    async delete(storeName: string, key: string) {
        return (await dbPromise).delete(storeName, key);
    },
    async clear(storeName: string) {
        return (await dbPromise).clear(storeName);
    },
    async getAllEntries(storeName: string) {
        const db = await dbPromise;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.store;
        const entries: { key: IDBValidKey; value: any }[] = [];
        let cursor = await store.openCursor();
        while (cursor) {
            entries.push({ key: cursor.key, value: cursor.value });
            cursor = await cursor.continue();
        }
        await tx.done;
        return entries;
    },
};