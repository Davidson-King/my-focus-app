import React, { useMemo, useEffect, PropsWithChildren } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { OfflineProvider } from './contexts/OfflineContext.tsx';
import { ThemeContext } from './contexts/ThemeContext.tsx';
import { useLocalStorage } from './hooks/useLocalStorage.ts';
import { themes } from './constants/themes.ts';
// FIX: Corrected import path for types.ts
import type { Mode } from './types.ts';
import { DataProvider } from './contexts/DataContext.tsx';

import ErrorBoundary from './components/ErrorBoundary.tsx';
import LandingPage from './pages/LandingPage.tsx';
import DashboardLayout from './pages/DashboardLayout.tsx';
import Home from './pages/dashboard/Home.tsx';
import Tasks from './pages/dashboard/Tasks.tsx';
import Notes from './pages/dashboard/Notes.tsx';
import Journal from './pages/dashboard/Journal.tsx';
// FIX: Corrected import path for Goals.tsx
import Goals from './pages/dashboard/Goals.tsx';
import Timeline from './pages/dashboard/Timeline.tsx';
import Calendar from './pages/dashboard/Calendar.tsx';
import Settings from './pages/Settings.tsx';
import Support from './pages/Support.tsx';
import Contact from './pages/Contact.tsx';
import PrivacyPolicy from './pages/legal/PrivacyPolicy.tsx';
import TermsOfService from './pages/legal/TermsOfService.tsx';
import FAQ from './pages/legal/FAQ.tsx';
import TestRunner from './tests/TestRunner.tsx';
import WeeklyReview from './pages/dashboard/WeeklyReview.tsx';
import SetupWizard from './pages/SetupWizard.tsx';
import Achievements from './pages/dashboard/Achievements.tsx';
import Help from './pages/Help.tsx';

const AppThemeProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
    const [mode, setMode] = useLocalStorage<Mode>('focusflow-theme-mode', 'dark');
    const [colorTheme, setColorTheme] = useLocalStorage('focusflow-color-theme', 'default');

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mode);
    }, [mode]);

    useEffect(() => {
        const theme = themes.find(t => t.name === colorTheme) || themes[0];
        const root = window.document.documentElement;
        // FIX: Ensure theme colors are correctly applied to prevent errors when value is unknown.
        Object.entries(theme.colors).forEach(([name, value]) => {
            const cssVarName = `--color-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVarName, value as string);
        });
    }, [colorTheme]);

    const toggleMode = () => {
        setMode(prevMode => (prevMode === 'light' ? 'dark' : 'light'));
    };

    const value = useMemo(() => ({
        mode,
        toggleMode,
        colorTheme,
        setColorTheme,
    }), [mode, colorTheme, setColorTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

const ProtectedRoute: React.FC<{ isAllowed: boolean; redirectPath?: string; children: React.ReactElement }> = ({ isAllowed, redirectPath = '/', children }) => {
    if (!isAllowed) {
        return <Navigate to={redirectPath} replace />;
    }
    return children;
};

const AppRoutes: React.FC = () => {
    const [onboardingComplete, setOnboardingComplete] = useLocalStorage('focusflow-onboarding-complete', false);

    const handleFinishOnboarding = () => {
        setOnboardingComplete(true);
    };

    return (
        <Routes>
            {/* Legal & Other Pages */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/tests" element={<TestRunner />} />
            
            {/* Onboarding Flow */}
            <Route path="/setup" element={
                <ProtectedRoute isAllowed={!onboardingComplete} redirectPath="/dashboard/home">
                    <SetupWizard onFinish={handleFinishOnboarding} />
                </ProtectedRoute>
            } />

            {/* Main Application */}
            <Route path="/dashboard/*" element={
                <ProtectedRoute isAllowed={onboardingComplete} redirectPath="/setup">
                    <DashboardLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="home" replace />} />
                <Route path="home" element={<Home />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="notes" element={<Notes />} />
                <Route path="journal" element={<Journal />} />
                <Route path="goals" element={<Goals />} />
                <Route path="achievements" element={<Achievements />} />
                <Route path="timeline" element={<Timeline />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="review" element={<WeeklyReview />} />
                <Route path="support" element={<Support />} />
                <Route path="contact" element={<Contact />} />
                <Route path="settings" element={<Settings />} />
                <Route path="help" element={<Help />} />
            </Route>

            {/* Entry Point */}
            <Route path="/" element={onboardingComplete ? <Navigate to="/dashboard/home" replace /> : <LandingPage />} />
            
            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}


const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                <AppThemeProvider>
                    <AuthProvider>
                        <OfflineProvider>
                            <DataProvider>
                                <HashRouter>
                                    <AppRoutes />
                                </HashRouter>
                            </DataProvider>
                        </OfflineProvider>
                    </AuthProvider>
                </AppThemeProvider>
            </NotificationProvider>
        </ErrorBoundary>
    );
};

export default App;