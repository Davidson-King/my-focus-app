import React, { useState, useContext, Fragment, useRef, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext.tsx';
import GlobalSearchModal from '../components/GlobalSearchModal.tsx';
import NotificationContainer from '../components/Notification.tsx';
import { 
    HomeIcon, CheckCircleIcon, DocumentTextIcon, BookOpenIcon, TrophyIcon, MapIcon, CalendarDaysIcon, Cog6ToothIcon, SearchIcon, Bars3Icon, PencilSquareIcon, XIcon, SunIcon, MoonIcon, ArrowLeftOnRectangleIcon, HeartIcon, ChartBarIcon, AwardIcon, QuestionMarkCircleIcon
} from '../components/Icons.tsx';
import { ThemeContext } from '../contexts/ThemeContext.tsx';
import { useNotifier } from '../contexts/NotificationContext.tsx';
import { fileToBase64, resizeImage } from '../utils/image.ts';
import ProfilePictureModal from '../components/ProfilePictureModal.tsx';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import OnboardingModal from '../components/OnboardingModal.tsx';
import WhatsNewModal from '../components/WhatsNewModal.tsx';
import BackupReminderModal from '../components/BackupReminderModal.tsx';
import { db } from '../services/db.ts';
import { exportData } from '../utils/data.ts';

const APP_VERSION = '1.1.0';

const navItems = [
    { name: 'Home', href: 'home', icon: HomeIcon },
    { name: 'Tasks', href: 'tasks', icon: CheckCircleIcon },
    { name: 'Notes', href: 'notes', icon: DocumentTextIcon },
    { name: 'Journal', href: 'journal', icon: BookOpenIcon },
    { name: 'Goals', href: 'goals', icon: TrophyIcon },
    { name: 'Achievements', href: 'achievements', icon: AwardIcon },
    { name: 'Timeline', href: 'timeline', icon: MapIcon },
    { name: 'Calendar', href: 'calendar', icon: CalendarDaysIcon },
    { name: 'Weekly Review', href: 'review', icon: ChartBarIcon },
    { name: 'Support Us', href: 'support', icon: HeartIcon },
    { name: 'Help', href: 'help', icon: QuestionMarkCircleIcon },
    { name: 'Settings', href: 'settings', icon: Cog6ToothIcon },
];

const Sidebar: React.FC<{ isSidebarOpen: boolean }> = ({ isSidebarOpen }) => (
    <aside className={`absolute inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out w-64 bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border flex-shrink-0 flex flex-col z-30`}>
        <div className="p-4 border-b border-light-border dark:border-dark-border">
            <Link to="/" className="text-2xl font-bold">FocusFlow</Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
            {navItems.map(item => (
                <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-light-bg dark:hover:bg-dark-border'}`}
                >
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                    <span>{item.name}</span>
                </NavLink>
            ))}
        </nav>
    </aside>
);

const DashboardLayout: React.FC = () => {
    const { user, updateUser } = useContext(AuthContext);
    const { mode, toggleMode } = useContext(ThemeContext);
    const { addNotification } = useNotifier();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isEditLayout, setIsEditLayout] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const [isTourComplete, setIsTourComplete] = useLocalStorage('focusflow-tour-complete', false);
    const [isTourOpen, setIsTourOpen] = useState(!isTourComplete);

    const [lastSeenVersion, setLastSeenVersion] = useLocalStorage('focusflow-last-seen-version', '0.0.0');
    const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(lastSeenVersion !== APP_VERSION);
    
    const [showBackupReminder, setShowBackupReminder] = useState(false);

    useEffect(() => {
        const checkBackupStatus = async () => {
            const lastDismissed = sessionStorage.getItem('backupReminderDismissed');
            if (lastDismissed) {
                const dismissedDate = new Date(parseInt(lastDismissed, 10));
                const today = new Date();
                if (dismissedDate.toDateString() === today.toDateString()) {
                    return; // Dismissed today, don't show
                }
            }

            const frequency = await db.get('settings', 'exportReminderFrequency');
            if (frequency === undefined || frequency === 0) {
                return; // Reminders disabled or not set
            }

            const lastExport = await db.get('settings', 'lastExportDate');
            const now = Date.now();
            const frequencyMs = frequency * 24 * 60 * 60 * 1000;

            if (!lastExport || (now - lastExport > frequencyMs)) {
                setShowBackupReminder(true);
            }
        };
        
        // Check after a short delay to not interrupt initial page load
        const timer = setTimeout(checkBackupStatus, 3000);
        return () => clearTimeout(timer);
    }, []);

    const handleDismissReminder = () => {
        setShowBackupReminder(false);
        sessionStorage.setItem('backupReminderDismissed', Date.now().toString());
    };

    const handleBackupFromModal = async () => {
        const success = await exportData();
        if (success) {
            addNotification('Data exported successfully.', 'success');
            setShowBackupReminder(false); // Close modal on success
        } else {
            addNotification('Failed to export data. Please try again.', 'error');
        }
    };

    const handleCloseWhatsNew = () => {
        setIsWhatsNewOpen(false);
        setLastSeenVersion(APP_VERSION);
    };

    const handleAvatarClick = () => {
        avatarInputRef.current?.click();
    };
    
    const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            addNotification('File is too large. Max size is 2MB.', 'error');
            return;
        }
    
        try {
            const base64 = await fileToBase64(file);
            setPreviewAvatar(base64);
            setIsAvatarModalOpen(true);
        } catch (error) {
            addNotification('Could not read file.', 'error');
        } finally {
            e.target.value = ''; // Reset file input to allow re-selecting the same file
        }
    };
    
    const handleSaveAvatar = async () => {
        if (!previewAvatar) return;
        try {
            const resized = await resizeImage(previewAvatar);
            await updateUser({ avatar: resized });
            addNotification('Profile picture updated!', 'success');
        } catch (error) {
            addNotification('Failed to update profile picture.', 'error');
        } finally {
            setIsAvatarModalOpen(false);
            setPreviewAvatar(null);
        }
    };

    const handleLogout = () => {
        // Clear all app-specific local storage to reset the state for a "new user" experience
        localStorage.removeItem('focusflow-onboarding-complete');
        localStorage.removeItem('focusflow-username');
        localStorage.removeItem('focusflow-dashboard-layout');
        localStorage.removeItem('focusflow-theme-mode');
        localStorage.removeItem('focusflow-color-theme');
        // This new tour flag also needs to be cleared for a full reset
        localStorage.removeItem('focusflow-tour-complete');
        localStorage.removeItem('focusflow-last-seen-version');
        // Redirect to landing page
        navigate('/', { replace: true });
    };

    return (
        <div className="flex h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text overflow-hidden">
            <Sidebar isSidebarOpen={isSidebarOpen} />
            
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

            <div className="flex-1 flex flex-col">
                <header className="flex-shrink-0 bg-light-card dark:bg-dark-card border-b border-light-border dark:border-dark-border flex items-center justify-between p-3 h-16">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2" aria-label="Open sidebar menu">
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                    <div className="flex-1 flex justify-end items-center gap-4">
                        <button onClick={() => setIsSearchOpen(true)} aria-label="Open search" className="flex items-center gap-2 p-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-border">
                            <SearchIcon className="w-5 h-5 text-dark-text-secondary" />
                            <span className="hidden sm:inline text-sm text-dark-text-secondary">Search...</span>
                        </button>
                        
                        <button onClick={toggleMode} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} className="p-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-border">
                            {mode === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>

                        <NavLink to="home">
                            {({ isActive }) => (
                                isActive && (
                                <button onClick={() => setIsEditLayout(p => !p)} className={`flex items-center gap-2 p-2 rounded-lg font-semibold text-sm ${isEditLayout ? 'bg-primary/10 text-primary' : 'hover:bg-light-bg dark:hover:bg-dark-border'}`}>
                                    {isEditLayout ? <XIcon className="w-5 h-5" /> : <PencilSquareIcon className="w-5 h-5" />}
                                    <span className="hidden sm:inline">{isEditLayout ? 'Done Editing' : 'Edit Layout'}</span>
                                </button>
                                )
                            )}
                        </NavLink>
                        
                        <div className="flex items-center gap-2 border-l border-light-border dark:border-dark-border pl-4">
                            <button onClick={handleAvatarClick} className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-dark-card" aria-label="Change profile picture">
                                <img src={user?.avatar} alt="User avatar" className="w-8 h-8 rounded-full object-cover" />
                            </button>
                            <input type="file" ref={avatarInputRef} onChange={handleAvatarFileSelect} accept="image/png, image/jpeg, image/webp" className="hidden" />

                            <span className="hidden md:inline font-semibold text-sm">{user?.name}</span>
                            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-light-bg dark:hover:bg-dark-border" aria-label="Logout">
                                <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto">
                    <div key={location.pathname} className="page-transition p-6">
                        <Outlet context={{ isEditLayout }} />
                    </div>
                </main>
            </div>
            
            <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            <NotificationContainer />
            <ProfilePictureModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                onSave={handleSaveAvatar}
                imageSrc={previewAvatar}
            />
            <OnboardingModal
                isOpen={isTourOpen}
                onClose={() => {
                    setIsTourOpen(false);
                    setIsTourComplete(true);
                }}
            />
            <WhatsNewModal
                isOpen={isWhatsNewOpen && isTourComplete}
                onClose={handleCloseWhatsNew}
                version={APP_VERSION}
            />
            <BackupReminderModal
                isOpen={showBackupReminder}
                onClose={handleDismissReminder}
                onExport={handleBackupFromModal}
            />
        </div>
    );
};

export default DashboardLayout;