import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Card from '../components/Card.tsx';
// FIX: Remove `cancelJoinRequest` from import as it does not exist in the API service.
import { getLeaderboard, getUsers, STORAGE_KEYS, requestToJoinTeam, updateTeam, getEvents, updateTeamRoster, manageJoinRequest, getTeamUsers, removeUserFromTeam } from '../services/api.ts';
import { Team, User, Event, UserRole, Facilitator, FacilitatorPermission, EventCategory, PointLog } from '../types.ts';
import { useSearchParams } from 'react-router-dom';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import AnimatedPage from '../components/AnimatedPage.tsx';
import { SkeletonCard } from '../components/Skeleton.tsx';
import { useEventContext } from '../hooks/useEventContext.ts';
import NoDataComponent from '../components/NoDataComponent.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import Button from '../components/Button.tsx';
import { getTeamStyles } from '../config.ts';
import { useVisibility } from '../hooks/useVisibility.ts';
import { motion } from 'framer-motion';
import { usePermissions } from '../hooks/usePermissions.ts';
import { useTheme } from '../hooks/useTheme.ts';
import Input from '../components/Input.tsx';
import Skeleton from '../components/Skeleton.tsx';
import Modal from '../components/Modal.tsx';
import TeamProgressLineChart from '../components/TeamProgressLineChart.tsx';
import { AMARANTH_JOKERS_TEAM_ID } from '../constants.ts';
import { usePageViewLogger } from '../hooks/usePageViewLogger.ts';


// --- Components adapted from TeamDetailsModal ---

const getMaxParticipants = (info: string): number => {
    if (!info) return Infinity;
    const lowerInfo = info.toLowerCase();
    if (lowerInfo.includes('all') || lowerInfo.includes('open')) {
        return Infinity;
    }
    
    const rangeMatch = info.match(/(\d+)\s*–\s*(\d+)/) || info.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch && rangeMatch[2]) {
        return parseInt(rangeMatch[2], 10);
    }

    const singleMatch = info.match(/(\d+)/);
    if (singleMatch && singleMatch[1]) {
        return parseInt(singleMatch[1], 10);
    }

    return Infinity;
};


interface EventRosterTabProps {
    team: Team;
    allEvents: Event[];
}

const EventRosterTab: React.FC<EventRosterTabProps> = ({ team, allEvents }) => {
    const { canManageRosters } = usePermissions();
    const canEdit = canManageRosters(team.id);

    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [newParticipantName, setNewParticipantName] = useState<Record<string, string>>({});
    const { addToast } = useToast();

    const participantEventCount = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!team.rosters) return counts;

        for (const roster of team.rosters) {
            for (const participant of roster.participants) {
                counts[participant] = (counts[participant] || 0) + 1;
            }
        }
        return counts;
    }, [team.rosters]);


    const groupedEvents = useMemo(() => {
        return allEvents.reduce((acc, event) => {
            (acc[event.category] = acc[event.category] || []).push(event);
            return acc;
        }, {} as Record<string, Event[]>);
    }, [allEvents]);

    const categoryOrder = Object.values(EventCategory);

    const handleAddParticipant = async (eventId: string, maxParticipants: number) => {
        const name = newParticipantName[eventId]?.trim();
        if (!name) {
            addToast('Please enter a participant name.', 'error');
            return;
        }

        const currentRoster = team.rosters?.find(r => r.eventId === eventId);
        const currentParticipants = currentRoster?.participants || [];
        
        if (currentParticipants.length >= maxParticipants) {
            addToast(`This event has a maximum of ${maxParticipants} participants.`, 'error');
            return;
        }
        
        const newParticipants = [...currentParticipants, name];

        try {
            await updateTeamRoster(team.id, eventId, newParticipants);
            addToast('Participant added successfully!', 'success');
            setNewParticipantName(prev => ({ ...prev, [eventId]: '' }));
        } catch (error: any) {
            addToast(error.message || 'Failed to add participant.', 'error');
        }
    };

    const handleRemoveParticipant = async (eventId: string, indexToRemove: number) => {
        const currentRoster = team.rosters?.find(r => r.eventId === eventId);
        if (!currentRoster) return;

        const newParticipants = currentRoster.participants.filter((_, index) => index !== indexToRemove);
        
        try {
            await updateTeamRoster(team.id, eventId, newParticipants);
            addToast('Participant removed.', 'success');
        } catch (error: any) {
            addToast(error.message || 'Failed to remove participant.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {categoryOrder.map(category => 
                groupedEvents[category] && (
                    <div key={category}>
                        <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700">{category}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {groupedEvents[category].map(event => {
                                const roster = team.rosters?.find(r => r.eventId === event.id);
                                const participants = roster?.participants || [];
                                const maxParticipants = getMaxParticipants(event.participantsInfo);
                                const isExpanded = expandedEventId === event.id;
                                
                                return (
                                    <Card key={event.id} className="p-4" disableLayoutAnimation>
                                        <div 
                                            className="flex justify-between items-start mb-3 cursor-pointer"
                                            onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                        >
                                            <div>
                                                <h4 className="font-semibold text-slate-800 dark:text-slate-100">{event.name}</h4>
                                                <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                                                    <i className="bi bi-people-fill"></i>
                                                    <span>{event.participantsInfo}</span>
                                                    <span className="font-bold">(Reg: {participants.length} / {isFinite(maxParticipants) ? maxParticipants : '∞'})</span>
                                                </p>
                                            </div>
                                            <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-400 text-lg`}></i>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                                {participants.length > 0 ? (
                                                    <ul className="space-y-2">
                                                        {participants.map((name, index) => {
                                                            const eventCount = participantEventCount[name] || 1;
                                                            return (
                                                                <li key={index} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg text-sm">
                                                                    <div className="flex items-center">
                                                                        <span className="font-medium text-slate-700 dark:text-slate-200">{name}</span>
                                                                        {eventCount > 1 && (
                                                                            <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded-full" title={`${name} is in ${eventCount} events.`}>
                                                                                {eventCount} events
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {canEdit && (
                                                                        <button onClick={() => handleRemoveParticipant(event.id, index)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-bold">REMOVE</button>
                                                                    )}
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                ) : <p className="text-xs text-slate-500 dark:text-slate-400 italic">No participants registered for this event.</p>}

                                                {canEdit && participants.length < maxParticipants && (
                                                    <div className="flex gap-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            placeholder="Enter participant name..."
                                                            className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                                            value={newParticipantName[event.id] || ''}
                                                            onChange={e => setNewParticipantName(prev => ({...prev, [event.id]: e.target.value}))}
                                                        />
                                                        <Button onClick={() => handleAddParticipant(event.id, maxParticipants)} disabled={!newParticipantName[event.id]}>Add</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )
            )}
        </div>
    );
};


interface TabButtonProps {
  label: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`}
  >
    {label}
  </button>
);

const PointLogItem: React.FC<{ log: any; canViewDetails: boolean; type: 'merit' | 'demerit' }> = ({ log, canViewDetails, type }) => (
    <li className={`p-3 rounded-lg ${type === 'merit' ? 'bg-green-50 dark:bg-green-900/50' : 'bg-red-50 dark:bg-red-900/50'}`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{log.reason}</p>
                <small className="text-slate-500 dark:text-slate-400">
                    By {log.updatedBy} on {new Date(log.timestamp).toLocaleDateString()}
                    {type === 'demerit' && log.responsiblePerson && (
                        canViewDetails ? <span className="text-red-500"> (Player: {log.responsiblePerson})</span> : <span className="text-red-500"> (Player involved)</span>
                    )}
                </small>
            </div>
            <span className={`font-bold text-lg ${type === 'merit' ? 'text-green-500' : 'text-red-500'}`}>
                {log.points > 0 ? `+${log.points}` : log.points}
            </span>
        </div>
    </li>
);

// FIX: Hoist getUserName function to be accessible by both TeamHub and JokerTeamHub.
const getUserName = (userId: string | undefined, allUsers: User[]): string => {
    if (!userId) return 'Not Assigned';
    return allUsers.find(u => u.id === userId)?.name || 'Unknown User';
};

const JokerTeamHub: React.FC<{ team: Team, allUsers: User[], onClose: () => void }> = ({ team, allUsers, onClose }) => {
    const { isAdmin } = usePermissions();
    const { addToast } = useToast();
    const { user } = useAuth();
    
    const [localTeam, setLocalTeam] = useState(team);
    const [editingFacilitatorId, setEditingFacilitatorId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formState, setFormState] = useState<Partial<Facilitator>>({});
    const [activeTab, setActiveTab] = useState<'governors' | 'facilitators'>('governors');
    
    useEffect(() => {
      setLocalTeam(team);
    }, [team]);

    const handleStartAdd = () => {
        setFormState({ 
            userId: '',
            position: '', roleDescription: '', 
            permissions: { canAdd: false, canDelete: false, canPassScores: true, canUpdate: true }
        });
        setIsAdding(true);
        setEditingFacilitatorId(null);
    }

    const handleStartEdit = (facilitator: Facilitator) => {
        setFormState(JSON.parse(JSON.stringify(facilitator))); // deep copy to avoid modifying state directly
        setEditingFacilitatorId(facilitator.userId);
        setIsAdding(false);
    }

    const handleCancel = () => {
        setEditingFacilitatorId(null);
        setIsAdding(false);
        setFormState({});
    }
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            const permKey = name as keyof FacilitatorPermission;
            setFormState(prev => ({
                ...prev,
                permissions: { ...prev?.permissions, [permKey]: checked } as FacilitatorPermission
            }));
        } else {
            setFormState(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async () => {
        if (!formState || !formState.userId || !formState.position) {
            addToast('User and Position are required.', 'error');
            return;
        }

        if (formState.position === 'Governor') {
            formState.permissions = { canAdd: true, canDelete: true, canUpdate: true, canPassScores: true };
        }

        let updatedFacilitators: Facilitator[];
        
        if (isAdding) {
            updatedFacilitators = [...(localTeam.facilitators || []), formState as Facilitator];
        } else {
            updatedFacilitators = (localTeam.facilitators || []).map(f => f.userId === formState.userId ? formState as Facilitator : f);
        }

        try {
            await updateTeam({ ...localTeam, facilitators: updatedFacilitators });
            handleCancel();
            addToast(`Facilitator ${isAdding ? 'added' : 'updated'}.`, 'success');
        } catch (error) {
            addToast('Failed to update facilitators; changes will be synced when online.', 'info');
            try { const { enqueue, processQueue } = await import('../utils/syncQueue'); enqueue('team:update', { ...localTeam, facilitators: updatedFacilitators }); enqueue('activity:log', { userId: (user && user.id) || 'unknown', action: 'updated_facilitators', target: { type: 'team', name: localTeam.name, link: `/teams?teamId=${localTeam.id}` } }); processQueue(); } catch (e) { console.warn('Failed to enqueue team update', e); }
        }
    };
    
    const handleDelete = async (idToDelete: string) => {
        if (!window.confirm("Are you sure you want to remove this member?")) return;

        const updatedFacilitators = localTeam.facilitators?.filter(f => f.userId !== idToDelete);
        try {
            await updateTeam({ ...localTeam, facilitators: updatedFacilitators });
            addToast('Facilitator removed.', 'success');
        } catch (error) {
            addToast('Failed to remove facilitator; change will be synced when online.', 'info');
            try { const { enqueue, processQueue } = await import('../utils/syncQueue'); enqueue('team:update', { ...localTeam, facilitators: updatedFacilitators }); enqueue('activity:log', { userId: (user && user.id) || 'unknown', action: 'removed_facilitator', target: { type: 'team', name: localTeam.name, link: `/teams?teamId=${localTeam.id}` } }); processQueue(); } catch (e) { console.warn('Failed to enqueue team update', e); }
        }
    };

    const renderPermissionChecklist = (permissions: Partial<FacilitatorPermission>, disabled: boolean) => (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {(Object.keys(permissions) as Array<keyof FacilitatorPermission>).map(key => (
          <label key={key} className="flex items-center space-x-2 text-sm">
            <input 
              type="checkbox"
              name={key}
              checked={permissions[key]}
              onChange={handleFormChange}
              disabled={disabled}
              className="rounded text-indigo-500 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-slate-600 dark:text-slate-300 capitalize">{key.replace('can', '')}</span>
          </label>
        ))}
      </div>
    );

    const teamStyle = getTeamStyles(team.id);
    const governors = localTeam.facilitators?.filter(f => f.position === 'Governor') || [];
    const otherFacilitators = localTeam.facilitators?.filter(f => f.position !== 'Governor') || [];

    const renderFacilitatorCard = (f: Facilitator) => {
        const facilitatorUser = allUsers.find(u => u.id === f.userId);
        return (
            <Card key={f.userId} className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{facilitatorUser?.name || 'Unknown User'}</h4>
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            {f.position === 'Governor' && <i className="bi bi-star-fill text-yellow-500"></i>}
                            {f.position}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{f.roleDescription}</p>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2 flex-shrink-0 ml-4">
                            <Button variant="secondary" className="!p-2 h-8 w-8 text-xs" onClick={() => handleStartEdit(f)}><i className="bi bi-pencil-fill"></i></Button>
                            <Button variant="danger" className="!p-2 h-8 w-8 text-xs" onClick={() => handleDelete(f.userId)} disabled={f.position === 'Governor'}><i className="bi bi-trash-fill"></i></Button>
                        </div>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <>
            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 id="modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 overflow-hidden">
                    <span>Facilitator Hub:</span>
                    <i className={`${teamStyle.icon} text-2xl`} style={{ color: teamStyle.gradient.from }}></i>
                    <span style={{ color: teamStyle.gradient.from }} className="truncate">{team.name}</span>
                </h2>
            </div>
            <div className="flex-shrink-0 overflow-x-auto border-b border-slate-200 dark:border-slate-700 px-4 pt-2">
                <div className="flex space-x-2">
                    <TabButton 
                        label={<span className="flex items-center gap-1"><i className="bi bi-star-fill"></i>Governors {governors.length > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">{governors.length}</span>}</span>} 
                        isActive={activeTab === 'governors'} 
                        onClick={() => setActiveTab('governors')} 
                    />
                    <TabButton 
                        label={<span className="flex items-center gap-1">Facilitators {otherFacilitators.length > 0 && <span className="ml-1 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">{otherFacilitators.length}</span>}</span>} 
                        isActive={activeTab === 'facilitators'} 
                        onClick={() => setActiveTab('facilitators')} 
                    />
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {activeTab === 'governors' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <i className="bi bi-star-fill text-yellow-500"></i>
                                    Governors Management
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Governors have full permissions and cannot be deleted</p>
                            </div>
                            {isAdmin && !isAdding && !editingFacilitatorId && governors.length < 5 && (
                                <Button onClick={handleStartAdd} className="text-xs py-1 px-3">
                                    <i className="bi bi-plus-lg mr-1"></i> Add Governor
                                </Button>
                            )}
                        </div>
                        
                        {(isAdding || editingFacilitatorId) && formState.position === 'Governor' && (
                            <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 mb-4">
                                <h4 className="font-bold mb-3 text-yellow-900 dark:text-yellow-100">{isAdding ? 'Add New Governor' : 'Edit Governor'}</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">User</label>
                                        {isAdding ? (
                                            <select name="userId" value={formState.userId || ''} onChange={handleFormChange} className="w-full text-sm p-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg">
                                                <option value="">Select a user</option>
                                                {allUsers.filter(u => u.teamId !== AMARANTH_JOKERS_TEAM_ID && !governors.find(g => g.userId === u.id)).map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input label="" id="name" name="name" value={allUsers.find(u => u.id === formState.userId)?.name || ''} disabled />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role Description</label>
                                        <textarea name="roleDescription" value={formState.roleDescription || ''} onChange={handleFormChange} rows={2} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20" />
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm">
                                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Permissions (Auto-set for Governors):</p>
                                        <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                                            <p><i className="bi bi-check-circle-fill text-green-500 mr-2"></i>Can Add Members</p>
                                            <p><i className="bi bi-check-circle-fill text-green-500 mr-2"></i>Can Delete Members</p>
                                            <p><i className="bi bi-check-circle-fill text-green-500 mr-2"></i>Can Update Information</p>
                                            <p><i className="bi bi-check-circle-fill text-green-500 mr-2"></i>Can Pass Scores</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                                    <Button onClick={handleSave}>Save Governor</Button>
                                </div>
                            </Card>
                        )}

                        {governors.length > 0 ? (
                            <div className="space-y-3">
                                {governors.map(renderFacilitatorCard)}
                            </div>
                        ) : (
                            <Card className="p-6 text-center bg-slate-50 dark:bg-slate-900/30">
                                <i className="bi bi-star text-4xl text-slate-300 dark:text-slate-600 mb-2"></i>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">No governors assigned yet</p>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'facilitators' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Facilitator Management</h3>
                            {isAdmin && !isAdding && !editingFacilitatorId && (
                                <Button onClick={handleStartAdd} className="text-xs py-1 px-3">
                                    <i className="bi bi-plus-lg mr-1"></i> Add Facilitator
                                </Button>
                            )}
                        </div>
                        
                        {(isAdding || editingFacilitatorId) && formState.position !== 'Governor' && (
                            <Card className="p-4 bg-slate-50 dark:bg-slate-900/50 mb-4">
                                <h4 className="font-bold mb-3">{isAdding ? 'Add New Facilitator' : 'Edit Facilitator'}</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">User</label>
                                            {isAdding ? (
                                                <select name="userId" value={formState.userId || ''} onChange={handleFormChange} className="w-full text-sm p-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg">
                                                    <option value="">Select a user</option>
                                                    {allUsers.filter(u => u.teamId !== AMARANTH_JOKERS_TEAM_ID).map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <Input label="" id="name" name="name" value={allUsers.find(u => u.id === formState.userId)?.name || ''} disabled />
                                            )}
                                        </div>
                                        <Input label="Position" id="position" name="position" value={formState.position || ''} onChange={handleFormChange}/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role Description</label>
                                        <textarea name="roleDescription" value={formState.roleDescription || ''} onChange={handleFormChange} rows={2} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Permissions</label>
                                        {renderPermissionChecklist(formState.permissions || {}, false)}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                                    <Button onClick={handleSave}>Save Facilitator</Button>
                                </div>
                            </Card>
                        )}

                        {otherFacilitators.length > 0 ? (
                            <div className="space-y-3">
                                {otherFacilitators.map(renderFacilitatorCard)}
                            </div>
                        ) : (
                            <Card className="p-6 text-center bg-slate-50 dark:bg-slate-900/30">
                                <i className="bi bi-people text-4xl text-slate-300 dark:text-slate-600 mb-2"></i>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">No facilitators assigned yet</p>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

type Tab = 'overview' | 'leadership' | 'members';

interface TeamHubProps {
  team: Team;
  allUsers: User[];
  allEvents: Event[];
  onClose: () => void;
}

export const TeamHub: React.FC<TeamHubProps> = ({ team, allUsers, allEvents, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { addToast } = useToast();
  const { theme } = useTheme();
  const { canManageTeamInfo, canViewDemeritDetails } = usePermissions();
  const { settings, isPrivileged } = useVisibility();
    const { user } = useAuth();

  const { data: teamMembers, loading: membersLoading } = useSyncedData(
    () => getTeamUsers(team.id),
    [STORAGE_KEYS.USERS]
  );
  
  const [isEditingLeadership, setIsEditingLeadership] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(team.description || '');
  const [leadershipForm, setLeadershipForm] = useState({
      unitLeader: '', unitSecretary: '', unitTreasurer: '',
      unitErrands: ['', '', '', ''], adviser: '',
  });

  const [isEditingMembers, setIsEditingMembers] = useState(false);
  const [userToAdd, setUserToAdd] = useState('');
  
  const canManage = canManageTeamInfo(team?.id);

  useEffect(() => {
    setActiveTab('overview');
    setDescription(team.description || '');
    setIsEditingDescription(false);
  }, [team.id, team.description]);

  useEffect(() => {
      if (team) {
          setLeadershipForm({
              unitLeader: team.unitLeader || '',
              unitSecretary: team.unitSecretary || '',
              unitTreasurer: team.unitTreasurer || '',
              unitErrands: team.unitErrands || ['', '', '', ''],
              adviser: team.adviser || '',
          });
      }
  }, [team]);

    const handleAddMember = async () => {
        if (!userToAdd || !team) return;
        try {
            // FIX: Correctly call `manageJoinRequest`. Assuming an admin adding a user is like accepting a request for that user to join the current team.
            await manageJoinRequest(team.id, userToAdd, 'accepted');
            addToast('Member added successfully!', 'success');
            setUserToAdd('');
        } catch(e: any) {
            addToast(e.message || 'Failed to add member', 'error');
        }
    }

    const handleRemoveMember = async (userId: string) => {
        if (!window.confirm('Are you sure you want to remove this member from the team?')) return;
        try {
            await removeUserFromTeam(userId);
            addToast('Member removed successfully!', 'success');
        } catch(e: any) {
            addToast(e.message || 'Failed to remove member', 'error');
        }
    }

  const handleErrandChange = (index: number, value: string) => {
      const newErrands = [...leadershipForm.unitErrands];
      newErrands[index] = value;
      setLeadershipForm({ ...leadershipForm, unitErrands: newErrands });
  };
  
  const handleSaveDescription = async () => {
    if (!team) return;
      try {
        await updateTeam({ ...team, description });
        addToast("Team description updated!", "success");
        setIsEditingDescription(false);
      } catch (error) {
                addToast("Failed to update description; change will be synced when online.", "info");
                try { const { enqueue, processQueue } = await import('../utils/syncQueue'); enqueue('team:update', { ...team, description }); enqueue('activity:log', { userId: (user && user.id) || 'unknown', action: 'updated_team_description', target: { type: 'team', name: team.name, link: `/teams?teamId=${team.id}` } }); processQueue(); } catch (e) { console.warn('Failed to enqueue team description update', e); }
      }
  };

  const handleSaveLeadership = async () => {
    if (!team) return;
      try {
        await updateTeam({ ...team, ...leadershipForm });
        addToast("Leadership details saved!", "success");
        setIsEditingLeadership(false);
      } catch (error) {
                addToast("Failed to save leadership; change will be synced when online.", "info");
                try { const { enqueue, processQueue } = await import('../utils/syncQueue'); enqueue('team:update', { ...team, ...leadershipForm }); enqueue('activity:log', { userId: (user && user.id) || 'unknown', action: 'updated_team_leadership', target: { type: 'team', name: team.name, link: `/teams?teamId=${team.id}` } }); processQueue(); } catch (e) { console.warn('Failed to enqueue team leadership update', e); }
      }
  };
  
    const handleManageRequest = async (userId: string, action: 'accepted' | 'rejected') => {
        if (!team) return;
        try {
            // FIX: Pass the correct arguments to `manageJoinRequest`.
            await manageJoinRequest(team.id, userId, action);
            addToast(`Request has been ${action}.`, 'success');
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
  const renderUserSelector = (name: keyof typeof leadershipForm, label: string) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <select
            name={name}
            value={(leadershipForm as any)[name]}
            onChange={e => setLeadershipForm(prev => ({ ...prev, [name]: e.target.value }))}
            disabled={!isEditingLeadership}
            className="w-full text-sm p-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-70"
        >
            <option value="">Not Assigned</option>
            {allUsers.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
            ))}
        </select>
    </div>
  );
  
  if (team.id === AMARANTH_JOKERS_TEAM_ID) {
      return <JokerTeamHub team={team} allUsers={allUsers} onClose={onClose} />
  }

  const joinRequestCount = team.joinRequests?.length || 0;
  const teamStyle = getTeamStyles(team.id);

  return (
    <>
      <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 id="modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 overflow-hidden">
            <span>Team Hub:</span>
            <i className={`${teamStyle.icon} text-2xl`} style={{ color: teamStyle.gradient.from }}></i>
            <span style={{ color: teamStyle.gradient.from }} className="truncate">{team.name}</span>
        </h2>
      </div>
        <div className="flex-shrink-0 overflow-x-auto border-b border-slate-200 dark:border-slate-700 px-4 pt-2">
            <div className="flex space-x-2">
                <TabButton label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                <TabButton label="Leadership" isActive={activeTab === 'leadership'} onClick={() => setActiveTab('leadership')} />
                <TabButton label={
                    <span className="relative">
                        Members
                        {canManage && joinRequestCount > 0 && <span className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center">{joinRequestCount}</span>}
                    </span>
                } isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
            </div>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="p-4">
                      <h4 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{(isPrivileged || settings.competitionScores) ? `${team.score} pts` : 'Scores Hidden'}</h4>
                      {(isPrivileged || settings.competitionScores) && <p className="text-sm text-slate-500 dark:text-slate-400">Current Rank: #{team.rank}</p>}
                  </Card>
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">Team Description</h3>
                            {canManage && !isEditingDescription && (
                                <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => setIsEditingDescription(true)}>Edit</Button>
                            )}
                        </div>
                        {isEditingDescription ? (
                            <div className="space-y-2">
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50"
                                    rows={4}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                                    <Button className="text-xs py-1 px-2" onClick={handleSaveDescription}>Save</Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">{team.description || 'No description available.'}</p>
                        )}
                    </Card>
                </div>

                {(isPrivileged || settings.competitionScores) && (
                  <div>
                    <h3 className="font-bold text-lg mb-4">Progress Graph</h3>
                    <Card className="p-4">
                        <TeamProgressLineChart teams={[team]} />
                        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-2">Shows score progression over time. Click on a chart to see a detailed log.</p>
                    </Card>
                  </div>
                )}

                {(isPrivileged || settings.competitionScores) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-bold text-lg mb-2 text-green-600 dark:text-green-400">Merits</h3>
                            <Card className="p-4 max-h-80 overflow-y-auto">
                                {team.merits?.length ? (
                                    <ul className="space-y-2">
                                        {team.merits.map((merit, i) => <PointLogItem key={i} log={merit} canViewDetails={canViewDemeritDetails} type="merit" />)}
                                    </ul>
                                ) : <p className="text-slate-500 dark:text-slate-400">No merits recorded.</p>}
                            </Card>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-2 text-red-600 dark:text-red-400">Demerits</h3>
                             <Card className="p-4 max-h-80 overflow-y-auto">
                                {team.demerits?.length ? (
                                    <ul className="space-y-2">
                                        {team.demerits.map((demerit, i) => <PointLogItem key={i} log={demerit} canViewDetails={canViewDemeritDetails} type="demerit" />)}
                                    </ul>
                                ) : <p className="text-slate-500 dark:text-slate-400">No demerits recorded.</p>}
                            </Card>
                        </div>
                    </div>
                )}

                {(isPrivileged || settings.competitionScores) && (
                    <div>
                        <h3 className="font-bold text-lg mb-2">Event Scorecards</h3>
                        {team.eventScores?.length ? (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {team.eventScores.map((event, i) => (
                                    <Card key={i} className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold text-indigo-600 dark:text-indigo-400">{event.eventName}</h4>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">Placement: {event.placement}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Competition Points: <span className="font-semibold">{event.competitionPoints}</span></p>
                                        <ul className="text-sm space-y-1">
                                            {event.scores.map((score, j) => (
                                                <li key={j} className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1">
                                                    <span>{score.criteria}:</span>
                                                    <span className="font-medium">{score.score} / {score.maxScore}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                ))}
                            </div>
                        ) : <p className="text-slate-500 dark:text-slate-400">No event scores available.</p>}
                    </div>
                )}
            </div>
          )}

          {activeTab === 'leadership' && (
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">Team Leadership Structure</h3>
                    {canManage && !isEditingLeadership && (
                        <Button variant="secondary" className="py-1 px-3 text-xs" onClick={() => setIsEditingLeadership(true)}>Edit Information</Button>
                    )}
                    {isEditingLeadership && (
                         <div className="space-x-2">
                            <Button variant="secondary" className="py-1 px-3 text-xs" onClick={() => setIsEditingLeadership(false)}>Cancel</Button>
                            <Button className="py-1 px-3 text-xs" onClick={handleSaveLeadership}>Save Changes</Button>
                         </div>
                    )}
                  </div>
                  
                  {!isEditingLeadership ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="p-4"><h5 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Unit Leader</h5><p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{getUserName(team.unitLeader, allUsers)}</p></Card>
                        <Card className="p-4"><h5 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Unit Adviser</h5><p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{getUserName(team.adviser, allUsers)}</p></Card>
                        <Card className="p-4"><h5 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Unit Secretary</h5><p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{getUserName(team.unitSecretary, allUsers)}</p></Card>
                        <Card className="p-4"><h5 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Unit Treasurer</h5><p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{getUserName(team.unitTreasurer, allUsers)}</p></Card>
                      </div>
                       <Card className="p-4">
                        <h5 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Unit Operational Errands</h5>
                        <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                          {(team.unitErrands?.filter(e => e) ?? []).length > 0 ? (
                            team.unitErrands?.map((errandId, index) => errandId && <li key={index}>{getUserName(errandId, allUsers)}</li>)
                          ) : (
                            <li className="list-none italic">No members assigned.</li>
                          )}
                        </ul>
                      </Card>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderUserSelector('unitLeader', 'Unit Leader')}
                          {renderUserSelector('adviser', 'Unit Adviser')}
                          {renderUserSelector('unitSecretary', 'Unit Secretary')}
                          {renderUserSelector('unitTreasurer', 'Unit Treasurer')}
                      </div>
                      <div>
                          <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-2">Unit Operational Errands</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Array.from({length: 4}).map((_, index) => (
                                <div key={index}>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{`Errand ${index+1}`}</label>
                                    <select
                                        value={leadershipForm.unitErrands[index] || ''}
                                        onChange={e => handleErrandChange(index, e.target.value)}
                                        className="w-full text-sm p-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg"
                                    >
                                        <option value="">Not Assigned</option>
                                        {allUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                                    </select>
                                </div>
                            ))}
                          </div>
                      </div>
                    </>
                  )}
              </div>
          )}

          {activeTab === 'members' && (
              <div className="space-y-6">
                  {canManage && (
                      <div>
                          <h3 className="font-bold text-lg mb-2">Join Requests</h3>
                          {team.joinRequests && team.joinRequests.length > 0 ? (
                              <div className="space-y-3">
                                  {team.joinRequests.map(req => {
                                      const requester = allUsers.find(u => u.id === req.userId);
                                      return (
                                          <Card key={req.userId} className="p-4 flex justify-between items-center">
                                              <div>
                                                  <p className="font-semibold text-slate-800 dark:text-slate-100">{requester?.name || 'Unknown User'}</p>
                                                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(req.timestamp).toLocaleString()}</p>
                                              </div>
                                              <div className="flex gap-2">
{/* FIX: Use "accepted" and "rejected" for the action parameter to match the required type. */}
                                                  <Button className="text-xs py-1 px-3" onClick={() => handleManageRequest(req.userId, 'accepted')}>Accept</Button>
                                                  <Button variant="danger" className="text-xs py-1 px-3" onClick={() => handleManageRequest(req.userId, 'rejected')}>Reject</Button>
                                              </div>
                                          </Card>
                                      )
                                  })}
                              </div>
                          ) : (
                              <p className="text-slate-500 dark:text-slate-400">No pending join requests.</p>
                          )}
                      </div>
                  )}

                  <div>
                      <h3 className="font-bold text-lg mb-2">Event Roster</h3>
                      <EventRosterTab team={team} allEvents={allEvents} />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mt-6">
                        <h3 className="font-bold text-lg">Team Members & Prospects</h3>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 text-sm text-indigo-700 dark:text-indigo-300 my-4">
                        <p><i className="bi bi-info-circle mr-2"></i>This list shows registered team members and their self-declared interest in specific events.</p>
                    </div>
                    
                    <div className="space-y-3">
                        {membersLoading ? <Skeleton className="h-48 w-full" /> : teamMembers && teamMembers.length > 0 ? (
                        teamMembers.map(member => (
                            <Card key={member.id} className="p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    <img src={member.avatar} alt={member.name} className="h-12 w-12 rounded-full object-cover" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                            <h5 className="font-bold text-slate-800 dark:text-slate-100">{member.firstName} {member.lastName}</h5>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{member.yearLevel} • {member.section}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded capitalize">{member.role.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        {member.interestedEvents && member.interestedEvents.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Interested in:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {member.interestedEvents.map((evt, idx) => (
                                                        <span key={idx} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full">
                                                            {evt}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {member.bio && (
                                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 italic">"{member.bio}"</p>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))
                        ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-center py-4">No members found for this team.</p>
                        )}
                    </div>
                </div>
                {canManage && (
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-lg">Member Management</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Directly add or remove members from this team. This action bypasses the join request system.</p>
                        
                        <Card className="p-4 mb-4 bg-slate-100 dark:bg-slate-900/50">
                            <h4 className="font-semibold mb-2">Add a member to {team.name}</h4>
                            <div className="flex gap-2">
                                <select 
                                    value={userToAdd}
                                    onChange={(e) => setUserToAdd(e.target.value)}
                                    className="w-full text-sm p-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg"
                                >
                                    <option value="">Select a user to add...</option>
                                    {allUsers.filter(u => !u.teamId).map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                                <Button onClick={handleAddMember} disabled={!userToAdd}>Add</Button>
                            </div>
                        </Card>
                        
                        <div className="space-y-3">
                            <h4 className="font-semibold text-md mb-2">Remove Current Members</h4>
                            {teamMembers && teamMembers.length > 0 ? (
                                teamMembers.map(member => (
                                    <div key={member.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <img src={member.avatar} alt={member.name} className="h-8 w-8 rounded-full" />
                                            <span className="font-medium text-sm">{member.name}</span>
                                        </div>
                                        <Button 
                                            variant="danger" 
                                            className="text-xs py-1 px-3"
                                            onClick={() => handleRemoveMember(member.id)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))
                            ) : <p className="text-sm text-slate-500 italic">No members to manage.</p>}
                        </div>
                    </div>
                )}
              </div>
          )}
        </div>
    </>
  )
}


const Teams: React.FC = () => {
  usePageViewLogger('teams');
  const { isDataAvailable } = useEventContext();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { settings, isPrivileged } = useVisibility();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const { data: teamsData, loading: teamsLoading } = useSyncedData<Team[]>(getLeaderboard, [STORAGE_KEYS.TEAMS, STORAGE_KEYS.EVENTS, STORAGE_KEYS.USERS]);
  const { data: usersData, loading: usersLoading } = useSyncedData<User[]>(getUsers, [STORAGE_KEYS.USERS]);
  const { data: eventsData, loading: eventsLoading } = useSyncedData<Event[]>(getEvents, [STORAGE_KEYS.EVENTS]);

  const allTeams = teamsData || [];
  const allUsers = usersData || [];
  const allEvents = eventsData || [];
  const loading = teamsLoading || usersLoading || eventsLoading;

  const handleTeamSelect = useCallback((team: Team) => {
    setSelectedTeam(team);
    setSearchParams({ teamId: team.id }, { replace: true });
  }, [setSearchParams]);

  const handleCloseDetailView = useCallback(() => {
    setSelectedTeam(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  
  useEffect(() => {
    const teamIdFromUrl = searchParams.get('teamId');
    if (teamIdFromUrl && allTeams.length > 0) {
        const team = allTeams.find(t => t.id === teamIdFromUrl);
        if (team) {
            setSelectedTeam(team);
        } else {
            handleCloseDetailView();
        }
    } else if (!teamIdFromUrl) {
        setSelectedTeam(null);
    }
  }, [searchParams, allTeams, handleCloseDetailView]);

  const handleJoinRequest = async (teamId: string) => {
    if (!user) return;
    try {
        // FIX: Pass only one argument to requestToJoinTeam as defined in the API.
        await requestToJoinTeam(teamId);
        addToast('Request to join sent!', 'success');
    } catch (error: any) {
        addToast(error.message, 'error');
    }
  };

  const userPendingRequest = useMemo(() => {
    if (!user) return null;
    for (const team of allTeams) {
        const req = team.joinRequests?.find(r => r.userId === user.id);
// FIX: Include teamId in the returned object to correctly identify the team when cancelling a request.
        if (req) return { ...req, teamId: team.id };
    }
    return null;
  }, [allTeams, user]);


  const handleCancelRequest = async () => {
    if (!user || !userPendingRequest) return;
    try {
        // FIX: Use `manageJoinRequest` to cancel (reject) a request, as `cancelJoinRequest` is not available. Also pass all required arguments.
        await manageJoinRequest(userPendingRequest.teamId, userPendingRequest.userId, 'rejected');
        addToast('Join request cancelled.', 'info');
    } catch (error: any) {
        addToast(error.message, 'error');
    }
  };

  const userHasPendingRequest = !!userPendingRequest;


  const facilitatingTeams = useMemo(() => allTeams.filter(team => team.id === AMARANTH_JOKERS_TEAM_ID), [allTeams]);
  const participatingTeams = useMemo(() => allTeams.filter(team => team.id !== AMARANTH_JOKERS_TEAM_ID).sort((a,b) => a.rank - b.rank), [allTeams]);
  
  const renderTeamCard = (team: Team) => {
      const style = getTeamStyles(team.id);
      const governors = team.facilitators?.filter(f => f.position === 'Governor') || [];
      
      return (
        <Card 
            key={team.id} 
            className="cursor-pointer group flex flex-col transition-all duration-300"
            onClick={() => handleTeamSelect(team)}
        >
            <div className="p-5 flex-grow">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        <i className={`${style.icon} text-2xl`} style={{ color: style.gradient.from }}></i>
                        <span>{team.name}</span>
                    </h3>
                    {(isPrivileged || settings.competitionScores) && team.rank > 0 && <span className="text-2xl font-bold" style={{color: style.gradient.from}}>#{team.rank}</span>}
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <p><i className="bi bi-person-circle mr-2"></i>Leader: {allUsers.find(u => u.id === team.unitLeader)?.name || 'TBA'}</p>
                    <p><i className="bi bi-people mr-2"></i>Members: {team.playersCount}</p>
                </div>
                {team.id === AMARANTH_JOKERS_TEAM_ID && governors.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <h5 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">Governors</h5>
                        <div className="flex flex-wrap gap-2">
                            {governors.map(gov => {
                                const govUser = allUsers.find(u => u.id === gov.userId);
                                return (
                                    <button
                                        key={gov.userId}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTeamSelect(team);
                                        }}
                                        className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full font-semibold transition-colors"
                                        title={`${govUser?.name} - Governor`}
                                    >
                                        <i className="bi bi-star-fill mr-1"></i>{govUser?.name || 'Unknown'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-auto px-5 pb-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                {(isPrivileged || settings.competitionScores) ? <span className="font-bold text-slate-800 dark:text-slate-100">{team.score} pts</span> : <div/>}
                <span className="text-xs text-slate-500 dark:text-slate-400">View Details <i className="bi bi-arrow-right ml-1"></i></span>
            </div>
        </Card>
      );
  }

  if (!isDataAvailable) {
    return <AnimatedPage><NoDataComponent /></AnimatedPage>;
  }

  return (
    <AnimatedPage>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Teams</h1>
            {!user?.teamId && userHasPendingRequest && (
                <Button variant="secondary" onClick={handleCancelRequest}>Cancel Join Request</Button>
            )}
        </div>
      
        <div className="space-y-8">
             {loading ? (
                <>
                    <div>
                        <Skeleton className="h-8 w-1/2 mb-4" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><SkeletonCard /></div>
                    </div>
                    <div>
                        <Skeleton className="h-8 w-1/2 mb-4 mt-6" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
                    </div>
                </>
             ) : (
                <>
                    {facilitatingTeams.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 pb-2 border-b-2 border-indigo-200 dark:border-indigo-800">Facilitating Team</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {facilitatingTeams.map(renderTeamCard)}
                            </div>
                        </div>
                    )}
                    {participatingTeams.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 pb-2 border-b-2 border-indigo-200 dark:border-indigo-800">Participating Teams</h2>
                            {!user?.teamId && !userHasPendingRequest && (
                                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                                    You are not yet on a team. Click a team card to view details and request to join.
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {participatingTeams.map(renderTeamCard)}
                            </div>
                        </div>
                    )}
                </>
             )}
        </div>
        
        <Modal isOpen={!!selectedTeam} onClose={handleCloseDetailView}>
            {selectedTeam && (
                <TeamHub 
                    team={selectedTeam} 
                    allUsers={allUsers} 
                    allEvents={allEvents} 
                    onClose={handleCloseDetailView}
                />
            )}
        </Modal>
    </AnimatedPage>
  );
};

export default Teams;