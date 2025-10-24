import React, { useState, useMemo, useContext } from 'react';
import { useIndexedDB } from '../../hooks/useIndexedDB.ts';
import type { Achievement } from '../../types.ts';
import { PlusIcon, TrashIcon, AwardIcon } from '../../components/Icons.tsx';
import EmptyState from '../../components/EmptyState.tsx';
import Spinner from '../../components/Spinner.tsx';
import { AuthContext } from '../../contexts/AuthContext.tsx';
import { useNotifier } from '../../contexts/NotificationContext.tsx';
import { getLocalISODateString } from '../../utils/date.ts';
import ButtonSpinner from '../../components/ButtonSpinner.tsx';

const Achievements: React.FC = () => {
    const { user } = useContext(AuthContext);
    const { addNotification } = useNotifier();
    const { items: allAchievements, isLoading, addItem, deleteItem } = useIndexedDB<Achievement>('achievements');
    
    const [selectedDate, setSelectedDate] = useState(getLocalISODateString(new Date()));
    const [newAchievementText, setNewAchievementText] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const achievementsForDay = useMemo(() => {
        return allAchievements
            .filter(a => a.date === selectedDate)
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [allAchievements, selectedDate]);

    const handleAddAchievement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAchievementText.trim() || !user || isAdding) return;
        
        setIsAdding(true);
        try {
            await addItem({
                user_id: user.id,
                text: newAchievementText.trim(),
                date: selectedDate,
            });
            setNewAchievementText('');
            addNotification('Achievement logged!', 'success');
        } catch (error) {
            addNotification('Failed to add achievement.', 'error');
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleDeleteAchievement = async (id: string) => {
        try {
            await deleteItem(id);
            addNotification('Achievement removed.', 'success');
        } catch (error) {
            addNotification('Failed to remove achievement.', 'error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold">Log Your Achievements</h1>
                <div>
                    <label htmlFor="achievement-date" className="sr-only">Select Date</label>
                    <input
                        id="achievement-date"
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        max={getLocalISODateString(new Date())} // Prevent selecting future dates
                        className="p-2 bg-light-card dark:bg-dark-card border dark:border-dark-border rounded-lg"
                    />
                </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-6 rounded-xl">
                <h2 className="text-2xl font-semibold mb-4">
                    What did you achieve on {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}?
                </h2>
                <form onSubmit={handleAddAchievement} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newAchievementText}
                        onChange={e => setNewAchievementText(e.target.value)}
                        placeholder="e.g., Launched a new project"
                        className="flex-1 p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg"
                        aria-label="New achievement"
                    />
                    <button type="submit" disabled={isAdding} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 w-28 flex justify-center items-center">
                        {isAdding ? <ButtonSpinner /> : 'Add'}
                    </button>
                </form>

                {isLoading ? (
                    <Spinner />
                ) : achievementsForDay.length > 0 ? (
                    <ul className="space-y-3">
                        {achievementsForDay.map(achievement => (
                            <li key={achievement.id} className="flex items-center gap-4 p-3 bg-light-bg dark:bg-dark-bg rounded-lg group">
                                <AwardIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" aria-hidden="true" />
                                <span className="flex-1">{achievement.text}</span>
                                <button
                                    onClick={() => handleDeleteAchievement(achievement.id)}
                                    className="opacity-0 group-hover:opacity-100 text-dark-text-secondary hover:text-red-500"
                                    aria-label={`Delete achievement: ${achievement.text}`}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-dark-text-secondary py-8">No achievements logged for this day. Add one above to get started!</p>
                )}
            </div>
        </div>
    );
};

export default Achievements;