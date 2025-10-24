import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ThemeContext } from '../contexts/ThemeContext.tsx';
import { AuthContext } from '../contexts/AuthContext.tsx';
import { themes } from '../constants/themes.ts';
import { useNotifier } from '../contexts/NotificationContext.tsx';
import { db } from '../services/db.ts';
import ButtonSpinner from '../components/ButtonSpinner.tsx';
import { SunIcon, MoonIcon } from '../components/Icons.tsx';
import ImportConfirmationModal from '../components/ImportConfirmationModal.tsx';
import PreImportWarningModal from '../components/PreImportWarningModal.tsx';
import { fileToBase64, resizeImage } from '../utils/image.ts';
import { useDataVersion } from '../contexts/DataContext.tsx';
import { exportData } from '../utils/data.ts';

const showImportOverlay = (status: 'importing' | 'reloading' | 'error', message?: string) => {
    let overlay = document.getElementById('import-process-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'import-process-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', backgroundColor: 'rgba(18, 18, 18, 0.95)', zIndex: '99999',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#E5E5E7', fontFamily: "'Inter', sans-serif", transition: 'opacity 0.3s ease-in-out', opacity: '0'
        });
        document.body.appendChild(overlay);
        setTimeout(() => overlay!.style.opacity = '1', 10);
    }

    const spinnerHTML = `<div style="width: 48px; height: 48px; border: 5px solid #007AFF; border-bottom-color: transparent; border-radius: 50%; display: inline-block; box-sizing: border-box; animation: splash-rotation 1s linear infinite; margin-top: 20px;"></div>`;
    const styleSheet = document.createElement("style");
    styleSheet.id = "overlay-spinner-style";
    styleSheet.innerText = `@keyframes splash-rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    if (!document.getElementById('overlay-spinner-style')) {
        document.head.appendChild(styleSheet);
    }
    
    let titleText = '';
    let messageText = '';

    switch(status) {
        case 'importing':
            titleText = 'Merging Data...';
            messageText = 'Please do not close this page.';
            overlay.innerHTML = `<h1 style="font-size: 2rem; font-weight: 700;">${titleText}</h1><p style="margin-top: 1rem;">${messageText}</p>${spinnerHTML}`;
            break;
        case 'reloading':
            titleText = 'Merge Successful';
            messageText = 'Updating application...';
            overlay.innerHTML = `<h1 style="font-size: 2rem; font-weight: 700;">${titleText}</h1><p style="margin-top: 1rem;">${messageText}</p>${spinnerHTML}`;
            break;
        case 'error':
             titleText = 'Import Failed';
             messageText = message || 'The file may be invalid or corrupted.';
             overlay.innerHTML = `<h1 style="font-size: 2rem; font-weight: 700; color: #EF4444;">${titleText}</h1><p style="margin-top: 1rem;">${messageText}</p><button id="close-overlay-btn" style="margin-top: 2rem; padding: 0.75rem 1.5rem; background-color: #007AFF; color: white; border: none; border-radius: 8px; cursor: pointer;">Close</button>`;
             document.getElementById('close-overlay-btn')?.addEventListener('click', () => removeImportOverlay());
             break;
    }
};

const removeImportOverlay = () => {
    const overlay = document.getElementById('import-process-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
    const styleSheet = document.getElementById('overlay-spinner-style');
    if (styleSheet) {
        styleSheet.remove();
    }
};

const validateBackupData = (data: any): boolean => {
    if (typeof data !== 'object' || data === null) {
        throw new Error("Invalid file format. The backup file should contain a single JSON object.");
    }

    const requiredStores: Record<string, 'array' | 'keyvalue'> = {
        tasks: 'array',
        notes: 'array',
        journal: 'array',
        goals: 'array',
        timelines: 'array',
        folders: 'array',
        achievements: 'array',
        userProfile: 'keyvalue',
        settings: 'keyvalue'
    };

    for (const storeName in requiredStores) {
        if (!(storeName in data)) {
            throw new Error(`Corrupted backup file. Missing required data store: '${storeName}'. This does not appear to be a FocusFlow backup.`);
        }
        const storeData = data[storeName];
        if (!Array.isArray(storeData)) {
             throw new Error(`Corrupted backup file. Data for '${storeName}' is not in the correct format.`);
        }
        
        // Basic schema check for an item in each store
        if (storeData.length > 0) {
            const item = storeData[0];
            if (typeof item !== 'object' || item === null) {
                throw new Error(`Corrupted backup file. Invalid item found in '${storeName}'.`);
            }

            if (requiredStores[storeName] === 'array' && typeof item.id !== 'string') {
                throw new Error(`Corrupted backup file. An item in '${storeName}' is missing a required 'id'.`);
            }
            
            if (requiredStores[storeName] === 'keyvalue' && typeof item.key === 'undefined') {
                throw new Error(`Corrupted backup file. A key-value item in '${storeName}' is malformed.`);
            }
        }
    }
    
    return true;
}


const Settings: React.FC = () => {
    const { mode, toggleMode, colorTheme, setColorTheme } = useContext(ThemeContext);
    const { user, updateUser } = useContext(AuthContext);
    const { addNotification } = useNotifier();
    const { incrementDataVersion } = useDataVersion();
    
    const [name, setName] = useState(user?.name || '');
    const [isPreImportModalOpen, setIsPreImportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const importInputRef = React.useRef<HTMLInputElement>(null);
    const avatarInputRef = React.useRef<HTMLInputElement>(null);
    const [isSavingName, setIsSavingName] = useState(false);
    const [exportReminderFreq, setExportReminderFreq] = useState(30);

    useEffect(() => {
        if (user) {
            setName(user.name);
        }
        db.get('settings', 'exportReminderFrequency').then(freq => {
            if (freq !== undefined) setExportReminderFreq(freq);
        });
    }, [user]);

    useEffect(() => {
        if (importFile) {
            setIsImportModalOpen(true);
        }
    }, [importFile]);

    const handleNameUpdate = async () => {
        if (user && name.trim() && name !== user.name) {
            setIsSavingName(true);
            try {
                await updateUser({ name: name.trim() });
                addNotification('Name updated successfully!', 'success');
            } finally {
                setIsSavingName(false);
            }
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            const resizedBase64 = await resizeImage(base64);
            await updateUser({ avatar: resizedBase64 });
            addNotification('Profile picture updated!', 'success');
        } catch (error) {
            addNotification('Failed to update profile picture.', 'error');
            console.error(error);
        } finally {
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    const handleRemoveAvatar = async () => {
        await updateUser({ avatar: 'DEFAULT' });
        addNotification('Profile picture removed.', 'success');
    };

    const handleExportData = async () => {
        const success = await exportData();
        if (success) {
            addNotification('Data exported successfully.', 'success');
        } else {
            addNotification('Failed to export data. Please try again.', 'error');
        }
    };

    const handleProceedToImport = () => {
        setIsPreImportModalOpen(false);
        importInputRef.current?.click();
    };

    const handleConfirmImport = useCallback(() => {
        if (!importFile) return;
        
        setIsImportModalOpen(false);
        showImportOverlay('importing');
    
        const reader = new FileReader();
    
        reader.onload = async (e) => {
            try {
                if (!e.target?.result) throw new Error("File appears to be empty.");

                let data;
                try {
                    data = JSON.parse(e.target.result as string);
                } catch (jsonError) {
                    throw new Error("Invalid file format. The file is not valid JSON.");
                }

                validateBackupData(data); // This will throw a specific error on failure

                const allStores = ['tasks', 'notes', 'journal', 'goals', 'timelines', 'folders', 'userProfile', 'settings', 'achievements'];

                for (const storeName of allStores) {
                    if (data[storeName] && Array.isArray(data[storeName])) {
                        if (storeName === 'userProfile' || storeName === 'settings') {
                           for (const item of data[storeName]) {
                               if (typeof item.key !== 'undefined') {
                                   await db.put(storeName, item.value, item.key);
                               }
                           }
                        } else {
                            await db.putAll(storeName, data[storeName]);
                        }
                    }
                }

                showImportOverlay('reloading');
                incrementDataVersion();
                setTimeout(() => removeImportOverlay(), 1500);
    
            } catch (err) {
                console.error("Import failed:", err);
                showImportOverlay('error', (err as Error).message);
            } finally {
                if(importInputRef.current) importInputRef.current.value = "";
                setImportFile(null);
            }
        };
    
        reader.onerror = () => {
            console.error("File reading failed");
            showImportOverlay('error', 'Failed to read the selected file.');
            if(importInputRef.current) importInputRef.current.value = "";
            setImportFile(null);
        };
    
        reader.readAsText(importFile);
    
    }, [importFile, incrementDataVersion]);

    const handleReminderFreqChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const freq = Number(e.target.value);
        setExportReminderFreq(freq);
        db.put('settings', freq, 'exportReminderFrequency');
        addNotification('Reminder settings saved.', 'success');
    };
    
    const handleCloseImportModal = useCallback(() => {
        setIsImportModalOpen(false);
        setImportFile(null);
        if(importInputRef.current) importInputRef.current.value = "";
    }, []);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            
            <section className="bg-light-card dark:bg-dark-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">Profile</h2>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="name-input" className="block text-sm font-medium mb-1">Name</label>
                        <div className="flex gap-2">
                            <input id="name-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="flex-1 p-2 bg-light-bg dark:bg-dark-bg border dark:border-dark-border rounded-lg" />
                            <button onClick={handleNameUpdate} disabled={isSavingName} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 flex justify-center items-center w-24 h-10">
                                {isSavingName ? <ButtonSpinner /> : 'Save'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Profile Picture</label>
                        <div className="flex items-center gap-4">
                            <img src={user?.avatar} alt="Current profile" className="w-16 h-16 rounded-full object-cover bg-dark-bg" />
                            <div className="flex gap-2">
                                <button onClick={() => avatarInputRef.current?.click()} className="py-2 px-4 rounded-lg bg-light-bg dark:bg-dark-border">Change</button>
                                <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                                {user?.avatar !== '/favicon.svg' && (
                                    <button onClick={handleRemoveAvatar} className="py-2 px-4 rounded-lg text-red-500 hover:bg-red-500/10">Remove</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            <section className="bg-light-card dark:bg-dark-card p-6 rounded-xl">
                 <h2 className="text-xl font-semibold mb-4">Appearance</h2>
                <div className="flex items-center justify-between mb-6">
                    <span>Theme Mode</span>
                    <button
                        onClick={toggleMode}
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-dark-card ${mode === 'dark' ? 'bg-primary' : 'bg-dark-border'}`}
                        role="switch"
                        aria-checked={mode === 'dark'}
                    >
                        <span className="sr-only">Use {mode === 'dark' ? 'light' : 'dark'} theme</span>
                        <span
                            className={`pointer-events-none relative inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mode === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
                        >
                            <span
                                className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-200 ease-in ${mode === 'dark' ? 'opacity-0 duration-100 ease-out' : 'opacity-100'}`}
                                aria-hidden="true"
                            >
                                <SunIcon className="h-4 w-4 text-dark-bg" aria-hidden="true" />
                            </span>
                            <span
                                className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-200 ease-in ${mode === 'dark' ? 'opacity-100' : 'opacity-0 duration-100 ease-out'}`}
                                aria-hidden="true"
                            >
                                <MoonIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                            </span>
                        </span>
                    </button>
                </div>
                <div>
                    <span>Color Theme</span>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                         {themes.map(theme => (
                             <button key={theme.name} onClick={() => setColorTheme(theme.name)} aria-label={`Set theme to ${theme.displayName}`} className={`p-2 rounded-lg border-2 ${colorTheme === theme.name ? 'border-primary' : 'border-transparent'}`}>
                                <div className="w-full h-8 rounded" style={{ backgroundColor: theme.colors.primary }}></div>
                                <span className="text-sm mt-1">{theme.displayName}</span>
                             </button>
                         ))}
                    </div>
                </div>
            </section>
            
            <section className="bg-light-card dark:bg-dark-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">Data Management</h2>
                 <p className="text-sm text-dark-text-secondary mb-4">Your data is stored locally on this device. Use these tools to back it up or restore from a previous backup.</p>
                <div className="flex flex-col md:flex-row gap-2">
                    <button onClick={handleExportData} className="flex-1 py-2 px-4 rounded-lg bg-light-bg dark:bg-dark-border">Export Data</button>
                    <button onClick={() => setIsPreImportModalOpen(true)} className="flex-1 py-2 px-4 rounded-lg bg-light-bg dark:bg-dark-border">Import Data</button>
                    <input type="file" ref={importInputRef} onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)} accept=".json" className="hidden" />
                </div>
                <div className="mt-4">
                    <label htmlFor="reminder-freq" className="block text-sm font-medium mb-1">Backup Reminder Frequency</label>
                    <select id="reminder-freq" value={exportReminderFreq} onChange={handleReminderFreqChange} className="w-full md:w-1/2 p-2 bg-light-bg dark:bg-dark-bg border dark:border-dark-border rounded-lg">
                        <option value="7">Weekly</option>
                        <option value="30">Monthly</option>
                        <option value="90">Every 3 Months</option>
                        <option value="0">Never</option>
                    </select>
                </div>
            </section>
            
            <PreImportWarningModal
                isOpen={isPreImportModalOpen}
                onClose={() => setIsPreImportModalOpen(false)}
                onProceed={handleProceedToImport}
                onExport={handleExportData}
            />
            <ImportConfirmationModal 
                isOpen={isImportModalOpen}
                onClose={handleCloseImportModal}
                onConfirm={handleConfirmImport}
                isImporting={false}
            />
        </div>
    );
};

export default Settings;