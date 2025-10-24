import { useState, useEffect, useCallback, useContext } from 'react';
import { db } from '../services/db';
import { AuthContext } from '../contexts/AuthContext';
// Fix: Import all possible item types to create a union type for stronger type safety.
import type { Task, Note, JournalEntry, Goal, Timeline, Folder, Achievement } from '../types';
import { generateUUID } from '../utils/uuid.ts';
import { useNotifier } from '../contexts/NotificationContext.tsx';
import { useDataVersion } from '../contexts/DataContext.tsx';

// Fix: Create a union type of all possible database items to constrain the generic hook.
type Item = Task | Note | JournalEntry | Goal | Timeline | Folder | Achievement;

type StoreName = 'tasks' | 'notes' | 'journal' | 'goals' | 'timelines' | 'folders' | 'achievements';

// Fix: Changed the generic constraint from `WithId` to `Item` to ensure that any type `T`
// used with this hook is a valid type that can be passed to the syncService.
export const useIndexedDB = <T extends Item>(storeName: StoreName) => {
    const [items, setItems] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useContext(AuthContext);
    const { addNotification } = useNotifier();
    const { dataVersion } = useDataVersion();

    const fetchItems = useCallback(async () => {
        try {
            const data = await db.getAll(storeName);
            setItems(data as T[]);
        } catch (error) {
            console.error(`Failed to fetch from ${storeName}:`, error);
        }
    }, [storeName]);
    
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await db.getAll(storeName);
                if (isMounted) {
                    setItems(data as T[]);
                }
            } catch (error) {
                console.error(`Failed to fetch from ${storeName}:`, error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        loadData();
        return () => { isMounted = false; };
    }, [storeName, dataVersion]);

    const handleError = (error: unknown, action: 'add' | 'update' | 'delete') => {
        console.error(`Failed to ${action} item in ${storeName}:`, error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            addNotification(
                'Storage Full. Could not save changes. Please free up space or clear some data.',
                'error'
            );
        } else {
            addNotification(`Failed to ${action} item. Please try again.`, 'error');
        }
        throw error;
    };

    // FIX: Add an explicit return type to assist with TypeScript type inference in consuming components.
    const addItem = async (itemData: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<T> => {
        const newItem = { ...itemData, id: generateUUID(), createdAt: itemData.createdAt || Date.now() } as unknown as T;
        try {
            await db.put(storeName, newItem);
            setItems(prev => [...prev, newItem]);
            return newItem;
        } catch (error) {
            handleError(error, 'add');
            await fetchItems(); // Re-sync state with DB on failure
            throw error;
        }
    };

    const updateItem = async (id: string, updates: Partial<T>) => {
        try {
            const existingItem = await db.get(storeName, id);
            if (existingItem) {
                const updatedItem = { ...existingItem, ...updates, updatedAt: Date.now() } as T;
                await db.put(storeName, updatedItem);
                setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
            }
        } catch (error) {
            handleError(error, 'update');
            await fetchItems(); // Re-sync state with DB on failure
        }
    };

    const deleteItem = async (id: string) => {
        try {
            await db.delete(storeName, id);
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            handleError(error, 'delete');
            await fetchItems(); // Re-sync state with DB on failure
        }
    };

    return { items, isLoading, addItem, updateItem, deleteItem, fetchItems };
};