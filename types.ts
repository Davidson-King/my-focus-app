// types.ts

export type Mode = 'light' | 'dark';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  dashboardLayout: DashboardLayoutItem[];
  isMockUser?: boolean;
}

export type Priority = 0 | 1 | 2 | 3; // 0: None, 1: Low, 2: Medium, 3: High

export interface Recurrence {
  frequency: 'daily' | 'weekly' | 'monthly';
}

export interface Task {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string; // YYYY-MM-DD
  parentId: string | null;
  createdAt: number;
  updatedAt?: number;
  // FIX: Added optional recurring property to support recurring tasks.
  recurring?: Recurrence;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string; // HTML content from rich text editor
  tags: string[];
  folderId: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string; // HTML content
  folderId: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface Goal {
  id: string;
  user_id: string;
  text: string;
  type: 'habit' | 'target';
  // for habits
  completedDates?: string[]; // YYYY-MM-DD
  currentStreak?: number;
  longestStreak?: number;
  // FIX: Added optional targetType property to support different habit target types.
  targetType?: 'completions' | 'streak';
  // for targets
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface TimelineEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    description: string;
}

export interface Timeline {
    id: string;
    user_id: string;
    name: string;
    events: TimelineEvent[];
    createdAt: number;
    updatedAt?: number;
}

export interface Folder {
    id: string;
    user_id: string;
    name: string;
    type: 'note' | 'journal';
    createdAt: number;
    updatedAt?: number;
}

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

export interface ColorTheme {
    name: string;
    displayName: string;
    colors: {
        primary: string;
        primaryHover: string;
        primaryGlow: string;
    };
}

export interface DashboardLayoutItem {
  id: 'welcome' | 'due_soon' | 'recent_notes' | 'active_goals';
  visible: boolean;
}

export interface FeedbackOutboxItem {
    id: string;
    subject: string;
    body: string;
    createdAt: number;
}

export interface Achievement {
  id: string;
  user_id: string;
  text: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}