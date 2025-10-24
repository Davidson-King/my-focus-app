import React from 'react';
import { useIndexedDB } from '../../hooks/useIndexedDB.ts';
import { Task, Note, JournalEntry, Goal } from '../../types.ts';
import { getPreviousWeekRange } from '../../utils/date.ts';
import { countWords } from '../../utils/text.ts';
import { CheckCircleIcon, BookOpenIcon, FireIcon } from '../../components/Icons.tsx';
import Spinner from '../../components/Spinner.tsx';
import { Link } from 'react-router-dom';

// A card for displaying a single stat
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; children?: React.ReactNode }> = ({ title, value, icon, children }) => (
    <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl">
        <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg">{icon}</div>
            <div>
                <p className="text-sm text-dark-text-secondary">{title}</p>
                <p className="text-3xl font-bold">{value}</p>
            </div>
        </div>
        {children && <div className="mt-4 text-sm text-dark-text-secondary">{children}</div>}
    </div>
);

const WeeklyReview: React.FC = () => {
    const { items: tasks, isLoading: tasksLoading } = useIndexedDB<Task>('tasks');
    const { items: notes, isLoading: notesLoading } = useIndexedDB<Note>('notes');
    const { items: journal, isLoading: journalLoading } = useIndexedDB<JournalEntry>('journal');
    const { items: goals, isLoading: goalsLoading } = useIndexedDB<Goal>('goals');

    const { start, end } = getPreviousWeekRange();

    const stats = React.useMemo(() => {
        const startTime = start.getTime();
        const endTime = end.getTime();

        // Completed Tasks: Check if the 'updatedAt' timestamp falls within the last week.
        const completedTasks = tasks.filter(task => {
            const completionTime = task.updatedAt;
            return task.completed && completionTime && completionTime >= startTime && completionTime <= endTime;
        });

        // Words Written: Sum words from notes and journal entries created or updated last week.
        const writtenNotes = notes.filter(note => (note.updatedAt || note.createdAt) >= startTime && (note.updatedAt || note.createdAt) <= endTime);
        const writtenJournal = journal.filter(entry => (entry.updatedAt || entry.createdAt) >= startTime && (entry.updatedAt || entry.createdAt) <= endTime);
        const wordsInNotes = writtenNotes.reduce((sum, note) => sum + countWords(note.content), 0);
        const wordsInJournal = writtenJournal.reduce((sum, entry) => sum + countWords(entry.content), 0);

        // Habits Maintained: Count completed dates for each habit within the last week.
        const habits = goals.filter(g => g.type === 'habit');
        const habitStats = habits.map(habit => {
            const completedInWeek = (habit.completedDates || []).filter(dateStr => {
                const date = new Date(`${dateStr}T00:00:00`);
                return date >= start && date <= end;
            }).length;
            return { name: habit.text, count: completedInWeek };
        }).filter(stat => stat.count > 0).sort((a, b) => b.count - a.count);

        return {
            completedTasksCount: completedTasks.length,
            totalWordsWritten: wordsInNotes + wordsInJournal,
            habitStats: habitStats,
            totalHabitDays: habitStats.reduce((acc, h) => acc + h.count, 0),
        };
    }, [tasks, notes, journal, goals, start, end]);

    const isLoading = tasksLoading || notesLoading || journalLoading || goalsLoading;

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">Weekly Review</h1>
            <p className="text-dark-text-secondary mb-6">
                Here's your progress from {start.toLocaleDateString()} to {end.toLocaleDateString()}.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Tasks Completed" value={stats.completedTasksCount} icon={<CheckCircleIcon className="w-8 h-8"/>} />
                <StatCard title="Words Written" value={stats.totalWordsWritten.toLocaleString()} icon={<BookOpenIcon className="w-8 h-8"/>} />
                <StatCard title="Habit Days" value={stats.totalHabitDays} icon={<FireIcon className="w-8 h-8"/>}>
                    {stats.habitStats.length > 0 && (
                        <ul className="space-y-1 mt-2 font-medium">
                           {stats.habitStats.slice(0, 3).map(habit => (
                               <li key={habit.name} className="flex justify-between">
                                   <span>{habit.name}</span>
                                   <span className="font-semibold">{habit.count} day{habit.count > 1 ? 's' : ''}</span>
                               </li>
                           ))}
                        </ul>
                    )}
                </StatCard>
            </div>
            
             <div className="mt-8 bg-dark-card p-6 rounded-xl text-center">
                <h2 className="text-2xl font-semibold">Ready for a new week?</h2>
                <p className="text-dark-text-secondary mt-2 mb-4">Set your goals and tasks to make this week even better.</p>
                <Link to="/dashboard/tasks" className="bg-primary text-white font-semibold px-6 py-3 rounded-lg hover:bg-primary-hover transition-colors">
                    Plan Your Week
                </Link>
            </div>
        </div>
    );
};

export default WeeklyReview;