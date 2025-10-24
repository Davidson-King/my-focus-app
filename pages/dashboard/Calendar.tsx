import React, { useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { useIndexedDB } from '../../hooks/useIndexedDB.ts';
import type { Task, JournalEntry, Achievement } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import { useNotifier } from '../../contexts/NotificationContext.tsx';
import { AuthContext } from '../../contexts/AuthContext.tsx';
import { PlusIcon, BookOpenIcon, CheckCircleIcon, ClockIcon, AwardIcon } from '../../components/Icons.tsx';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/db.ts';
import Spinner from '../../components/Spinner.tsx';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, getLocalISODateString } from '../../utils/date.ts';
import ButtonSpinner from '../../components/ButtonSpinner.tsx';

type CalendarView = 'month' | 'week' | 'day';
type CalendarEvent = 
    | (Task & { itemType: 'task' }) 
    | (JournalEntry & { itemType: 'journal' })
    | (Achievement & { itemType: 'achievement' });

const CalendarHeader: React.FC<{
    currentDate: Date;
    view: CalendarView;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onViewChange: (view: CalendarView) => void;
}> = ({ currentDate, view, onPrev, onNext, onToday, onViewChange }) => {
    const title = useMemo(() => {
        switch (view) {
            case 'month':
                return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            case 'week':
                const start = startOfWeek(currentDate);
                const end = endOfWeek(currentDate);
                return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            case 'day':
                return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        }
    }, [currentDate, view]);

    return (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
                <button onClick={onPrev} className="p-2 rounded-full hover:bg-light-bg dark:hover:bg-dark-border">&lt;</button>
                <button onClick={onNext} className="p-2 rounded-full hover:bg-light-bg dark:hover:bg-dark-border">&gt;</button>
                <button onClick={onToday} className="px-4 py-2 text-sm font-semibold rounded-lg border border-light-border dark:border-dark-border hover:bg-light-bg dark:hover:bg-dark-border">Today</button>
            </div>
            <h2 className="text-xl font-bold text-center">{title}</h2>
            <div className="flex items-center gap-1 p-1 bg-light-bg dark:bg-dark-bg rounded-lg">
                {(['month', 'week', 'day'] as CalendarView[]).map(v => (
                    <button
                        key={v}
                        onClick={() => onViewChange(v)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === v ? 'bg-primary text-white' : 'hover:bg-dark-border'}`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    );
};

const DayDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    events: CalendarEvent[];
    onAddTask: (task: Omit<Task, 'id' | 'user_id'>) => Promise<any>;
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
}> = ({ isOpen, onClose, selectedDate, events, onAddTask, onUpdateTask }) => {
    const { user } = useContext(AuthContext);
    const [taskText, setTaskText] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const navigate = useNavigate();

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskText.trim() || !user || isAdding) return;
        setIsAdding(true);
        try {
            await onAddTask({
                text: taskText, completed: false, priority: 0,
                dueDate: getLocalISODateString(selectedDate),
                parentId: null, createdAt: Date.now(),
            });
            setTaskText('');
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleNavigate = (path: string, state?: any) => {
        navigate(path, { state });
        onClose();
    };

    const formattedDate = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const sortedEvents = events.sort((a,b) => a.createdAt - b.createdAt);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={formattedDate}>
            <div className="space-y-4">
                {sortedEvents.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {sortedEvents.map(event => (
                            <div key={`${event.itemType}-${event.id}`} className="flex items-start gap-3 p-2 rounded-lg bg-light-bg dark:bg-dark-bg">
                                {event.itemType === 'task' ? (
                                    <>
                                        <input type="checkbox" checked={event.completed} onChange={() => onUpdateTask(event.id, { completed: !event.completed })} className="mt-1 w-5 h-5 rounded-md text-primary bg-dark-border border-dark-border focus:ring-primary focus:ring-2" />
                                        <span className={`flex-1 ${event.completed ? 'line-through text-dark-text-secondary' : ''}`}>{event.text}</span>
                                    </>
                                ) : event.itemType === 'journal' ? (
                                    <>
                                        <BookOpenIcon className="w-5 h-5 mt-1 text-green-500 flex-shrink-0" />
                                        <button onClick={() => handleNavigate('/dashboard/journal', { selectedEntryId: event.id })} className="flex-1 text-left hover:underline">{event.title}</button>
                                    </>
                                ) : (
                                     <>
                                        <AwardIcon className="w-5 h-5 mt-1 text-yellow-400 flex-shrink-0" />
                                        <span className="flex-1">{event.text}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-dark-text-secondary">No events for this day.</p>
                )}

                <form onSubmit={handleAddTask} className="pt-4 border-t border-dark-border">
                    <h3 className="font-semibold mb-2">Add New Task</h3>
                    <div className="flex gap-2">
                        <input type="text" value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="New task..." className="flex-1 w-full p-2 bg-dark-bg border border-dark-border rounded-lg" autoFocus />
                        <button type="submit" disabled={isAdding} className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 w-24 flex justify-center items-center">
                            {isAdding ? <ButtonSpinner /> : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

const MonthView: React.FC<{ currentDate: Date; events: CalendarEvent[]; onDateClick: (date: Date) => void; }> = ({ currentDate, events, onDateClick }) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const { month, year } = { month: currentDate.getMonth(), year: currentDate.getFullYear() };
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        events.forEach(event => {
            const dateStr = event.itemType === 'task' && event.dueDate 
                ? event.dueDate 
                : event.itemType === 'achievement' 
                    ? event.date
                    : getLocalISODateString(new Date(event.createdAt));
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(event);
        });
        return map;
    }, [events]);

    const grid = [];
    let day = 1;
    for (let i = 0; i < 6; i++) {
        const week = [];
        for (let j = 0; j < 7; j++) {
            if ((i === 0 && j < firstDayOfMonth) || day > daysInMonth) {
                week.push(<div key={`empty-${i}-${j}`} className="p-1 border-r border-b border-light-border dark:border-dark-border bg-light-bg/50 dark:bg-dark-bg/50"></div>);
            } else {
                const date = new Date(year, month, day);
                const dateString = getLocalISODateString(date);
                const isToday = getLocalISODateString(new Date()) === dateString;
                const dayEvents = eventsByDate[dateString] || [];

                week.push(
                    <div key={day} onClick={() => onDateClick(date)} className="p-1 border-r border-b border-light-border dark:border-dark-border cursor-pointer hover:bg-light-bg dark:hover:bg-dark-border transition-colors h-28 flex flex-col focus:outline-none focus:ring-1 focus:ring-primary focus:z-10">
                        <span className={`font-semibold text-sm mb-1 ${isToday ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : 'ml-2'}`}>{day}</span>
                        <div className="space-y-1 overflow-y-auto text-xs">
                            {dayEvents.slice(0, 2).map(event => {
                                let colorClass = '';
                                switch(event.itemType) {
                                    case 'task': colorClass = 'bg-blue-500/20 text-blue-300'; break;
                                    case 'journal': colorClass = 'bg-green-500/20 text-green-300'; break;
                                    case 'achievement': colorClass = 'bg-yellow-500/20 text-yellow-300'; break;
                                }
                                return (
                                    <div key={`${event.itemType}-${event.id}`} className={`truncate px-1 rounded ${colorClass}`}>
                                        {/* FIX: Use 'in' operator for type narrowing to access correct property. */}
                                        {'title' in event ? event.title : event.text}
                                    </div>
                                );
                            })}
                            {dayEvents.length > 2 && <div className="text-xs text-dark-text-secondary pl-1">+{dayEvents.length - 2} more</div>}
                        </div>
                    </div>
                );
                day++;
            }
        }
        grid.push(<div key={i} className="grid grid-cols-7 border-l border-t border-light-border dark:border-dark-border">{week}</div>);
        if (day > daysInMonth) break;
    }

    return (
        <div>
            <div className="grid grid-cols-7 text-center font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {days.map(d => <div key={d} className="py-2">{d}</div>)}
            </div>
            {grid}
        </div>
    );
};

const WeekView: React.FC<{ currentDate: Date; events: CalendarEvent[]; onDateClick: (date: Date) => void; }> = ({ currentDate, events, onDateClick }) => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    return (
        <div className="grid grid-cols-7 border-t border-l border-dark-border">
            {days.map(day => {
                const dateString = getLocalISODateString(day);
                const isToday = getLocalISODateString(new Date()) === dateString;
                const dayEvents = events.filter(e => {
                     const eventDateStr = e.itemType === 'task' && e.dueDate 
                        ? e.dueDate 
                        : e.itemType === 'achievement'
                            ? e.date
                            : getLocalISODateString(new Date(e.createdAt));
                     return eventDateStr === dateString;
                });

                return (
                    <div key={dateString} className="border-b border-r border-dark-border min-h-[400px]">
                        <div className={`p-2 text-center border-b border-dark-border ${isToday ? 'bg-primary/10' : ''}`}>
                            <p className="text-sm text-dark-text-secondary">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            <p className="font-bold text-2xl">{day.getDate()}</p>
                        </div>
                        <div className="p-2 space-y-2">
                            {dayEvents.map(event => {
                                let colorClass = '';
                                switch(event.itemType) {
                                    case 'task': colorClass = 'bg-blue-500/20 text-blue-300'; break;
                                    case 'journal': colorClass = 'bg-green-500/20 text-green-300'; break;
                                    case 'achievement': colorClass = 'bg-yellow-500/20 text-yellow-300'; break;
                                }
                                return (
                                    <div key={`${event.itemType}-${event.id}`} className={`text-xs p-1.5 rounded truncate ${colorClass}`}>
                                        {/* FIX: Use 'in' operator for type narrowing to access correct property. */}
                                        {'title' in event ? event.title : event.text}
                                    </div>
                                );
                            })}
                             <button onClick={() => onDateClick(day)} className="w-full text-center text-xs text-primary mt-2 hover:underline">+ Add</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const DayView: React.FC<{ currentDate: Date; events: CalendarEvent[]; }> = ({ currentDate, events }) => {
    const dateString = getLocalISODateString(currentDate);
    const allDayEvents = events.filter(e => e.itemType === 'task' && e.dueDate === dateString);
    const timedEvents = events.filter(e => e.itemType !== 'task' && getLocalISODateString(new Date(e.createdAt)) === dateString);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="p-4">
            {allDayEvents.length > 0 && (
                <div className="mb-4 border-b border-dark-border pb-4">
                    <h3 className="font-semibold mb-2">All-day</h3>
                    <div className="space-y-2">
                        {allDayEvents.map(event => (
                            <div key={event.id} className="p-2 rounded bg-blue-500/20 text-blue-300 text-sm font-medium">
                                {event.text}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="relative">
                {hours.map(hour => (
                    <div key={hour} className="flex h-20 border-t border-dark-border">
                        <div className="w-16 text-right pr-2 pt-1 text-xs text-dark-text-secondary">
                            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </div>
                        <div className="flex-1 relative">
                             {timedEvents
                                .filter(e => new Date(e.createdAt).getHours() === hour)
                                .map(event => {
                                    const top = (new Date(event.createdAt).getMinutes() / 60) * 100;
                                    let colorClass = '';
                                    let icon = null;
                                    switch(event.itemType) {
                                        case 'journal': colorClass = 'bg-green-500/80 border-green-400'; icon = <BookOpenIcon className="w-4 h-4 mr-2"/>; break;
                                        case 'achievement': colorClass = 'bg-yellow-500/80 border-yellow-400'; icon = <AwardIcon className="w-4 h-4 mr-2"/>; break;
                                    }
                                    return (
                                        <div 
                                            key={`${event.itemType}-${event.id}`} 
                                            className={`absolute left-2 right-0 p-2 rounded-lg border-l-4 text-white text-sm flex items-center ${colorClass}`} 
                                            style={{ top: `${top}%` }}
                                        >
                                            {icon}
                                            <span className="font-semibold truncate">{event.itemType === 'achievement' ? event.text : event.title}</span>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const Calendar: React.FC = () => {
    const { user } = useContext(AuthContext);
    const { addItem: addTask, updateItem: updateTask } = useIndexedDB<Task>('tasks');
    const { addNotification } = useNotifier();

    const [view, setView] = useState<CalendarView>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchEvents = useCallback(async (range: { start: Date; end: Date }) => {
        setIsLoading(true);
        const dateRangeStr = IDBKeyRange.bound(getLocalISODateString(range.start), getLocalISODateString(range.end));
        const timeRange = IDBKeyRange.bound(range.start.getTime(), range.end.getTime());
        
        try {
            const [tasks, journalEntries, achievements] = await Promise.all([
                db.getAllByIndex('tasks', 'dueDate', dateRangeStr),
                db.getAllByIndex('journal', 'createdAt', timeRange),
                db.getAllByIndex('achievements', 'date', dateRangeStr),
            ]);
            const combinedEvents: CalendarEvent[] = [
                ...tasks.map((t: Task) => ({...t, itemType: 'task' as const })),
                ...journalEntries.map((j: JournalEntry) => ({...j, itemType: 'journal' as const })),
                ...achievements.map((a: Achievement) => ({...a, itemType: 'achievement' as const }))
            ];
            setEvents(combinedEvents);
        } catch (e) {
            console.error("Failed to fetch calendar data:", e);
            addNotification('Could not load calendar events.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        let range;
        if (view === 'month') range = { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
        else if (view === 'week') range = { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
        else range = { start: currentDate, end: currentDate };
        
        const start = view === 'day' ? new Date(currentDate) : range.start;
        start.setHours(0,0,0,0);
        const end = view === 'day' ? new Date(currentDate) : range.end;
        end.setHours(23,59,59,999);
        
        fetchEvents({ start, end });
    }, [currentDate, view, fetchEvents]);

    const handlePrev = () => {
        if (view === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
        else if (view === 'week') setCurrentDate(d => addDays(d, -7));
        else setCurrentDate(d => addDays(d, -1));
    };
    const handleNext = () => {
        if (view === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
        else if (view === 'week') setCurrentDate(d => addDays(d, 7));
        else setCurrentDate(d => addDays(d, 1));
    };
    const handleToday = () => setCurrentDate(new Date());
    
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setModalOpen(true);
    };

    const handleAddTask = async (task: Omit<Task, 'id' | 'user_id'>) => {
        if(!user) return Promise.reject();
        try {
            const newTask = await addTask({...task, user_id: user.id });
            addNotification('Task added successfully.', 'success');
            setEvents(prev => [...prev, { ...newTask, itemType: 'task' }]);
            return newTask;
        } catch (error) {
            addNotification('Failed to add task.', 'error');
            throw error;
        }
    };
    
    const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
        try {
            await updateTask(id, updates);
            setEvents(prev => prev.map(e => e.id === id && e.itemType === 'task' ? {...e, ...updates} : e));
            addNotification('Task updated.', 'success');
        } catch (error) {
             addNotification('Failed to update task.', 'error');
        }
    };

    const renderView = () => {
        if (isLoading) return <div className="h-96 flex items-center justify-center"><Spinner /></div>;
        switch (view) {
            case 'month': return <MonthView currentDate={currentDate} events={events} onDateClick={handleDateClick} />;
            case 'week': return <WeekView currentDate={currentDate} events={events} onDateClick={handleDateClick} />;
            case 'day': return <DayView currentDate={currentDate} events={events} />;
            default: return null;
        }
    };

    const eventsForModal = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = getLocalISODateString(selectedDate);
        return events.filter(e => {
            const eventDateStr = e.itemType === 'task' ? e.dueDate 
                : e.itemType === 'achievement' ? e.date
                : getLocalISODateString(new Date(e.createdAt));
            return eventDateStr === dateStr;
        });
    }, [events, selectedDate]);

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Calendar</h1>
            <div className="bg-light-card dark:bg-dark-card p-4 rounded-xl">
                <CalendarHeader currentDate={currentDate} view={view} onPrev={handlePrev} onNext={handleNext} onToday={handleToday} onViewChange={setView} />
                {renderView()}
            </div>
             {selectedDate && (
                <DayDetailModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    selectedDate={selectedDate}
                    events={eventsForModal}
                    onAddTask={handleAddTask}
                    onUpdateTask={handleUpdateTask}
                />
            )}
        </div>
    );
};

export default Calendar;