import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Add useNavigate to handle team selection without using the broken modal.
import { useSearchParams, useNavigate } from 'react-router-dom';
import Card from '../components/Card.tsx';
import { getLeaderboard, getEvents, updateEventResults, addPointLog, deletePointLog, updatePointLog, STORAGE_KEYS } from '../services/api.ts';
import { Team, Event, EventResult, UserRole, PointLog, EventCategory, ScoreAdjustment, CriteriaItem } from '../types.ts';
import { useToast } from '../hooks/useToast.ts';
import Button from '../components/Button.tsx';
import Input from '../components/Input.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import { useVisibility } from '../hooks/useVisibility.ts';
import AnimatedPage from '../components/AnimatedPage.tsx';
import Skeleton from '../components/Skeleton.tsx';
import { useEventContext } from '../hooks/useEventContext.ts';
import NoDataComponent from '../components/NoDataComponent.tsx';
import { useModal } from '../hooks/useModal.ts';
import { getTeamStyles } from '../config.ts';
import { motion, AnimatePresence } from 'framer-motion';
import { usePageViewLogger } from '../hooks/usePageViewLogger.ts';
import { getSortedTeamsWithRanks } from '../utils/ranking.ts';
import { AMARANTH_JOKERS_TEAM_ID } from '../constants.ts';

type ViewMode = 'standings' | 'records' | 'merits';

const PointLogModalContent: React.FC<{
    log: Partial<PointLog> & { teamId: string, type: 'merit' | 'demerit' };
    teams: Team[];
    onClose: () => void;
    onSave: (log: Partial<PointLog> & { teamId: string, type: 'merit' | 'demerit' }) => void;
}> = ({ log, teams, onClose, onSave }) => {
    const [currentLog, setCurrentLog] = useState(log);
    const competingTeams = teams.filter(t => t.id !== AMARANTH_JOKERS_TEAM_ID);
    const selectClass = "w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentLog(prev => ({ ...prev!, [name]: name === 'points' ? parseInt(value) || 0 : value }));
    };

    return (
        <>
            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{log.id ? 'Edit' : 'Add'} Merit/Demerit Entry</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team</label>
                    <select name="teamId" value={currentLog.teamId} onChange={handleChange} className={selectClass}>
                        <option value="">Select Team...</option>
                        {competingTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select name="type" value={currentLog.type} onChange={handleChange} className={selectClass}>
                        <option value="merit">Merit (+)</option>
                        <option value="demerit">Demerit (-)</option>
                    </select>
                </div>
                <Input id="reason" name="reason" label="Reason" value={currentLog.reason || ''} onChange={handleChange} />
                <Input id="points" name="points" label="Points (Positive Value)" type="number" value={currentLog.points || ''} onChange={handleChange} />
            </div>
            <div className="flex-shrink-0 flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={() => onSave(currentLog)}>Save Entry</Button>
            </div>
        </>
    );
};

const Leaderboard: React.FC = () => {
  usePageViewLogger('leaderboard');
  const { openModal, closeModal } = useModal();
  const [viewMode, setViewMode] = useState<ViewMode>('standings');
  const { addToast } = useToast();
  const { user } = useAuth();
  const { settings, isPrivileged } = useVisibility();
  const { isDataAvailable } = useEventContext();
  const navigate = useNavigate();
  
  const { data: teamsData, loading: teamsLoading } = useSyncedData<Team[]>(getLeaderboard, [STORAGE_KEYS.TEAMS, STORAGE_KEYS.EVENTS, STORAGE_KEYS.USERS]);
  const { data: eventsData, loading: eventsLoading } = useSyncedData<Event[]>(getEvents, [STORAGE_KEYS.EVENTS]);
  
  const teams = teamsData || [];
  const events = eventsData || [];
  const loading = teamsLoading || eventsLoading;

  const [expandedTeamIdInView, setExpandedTeamIdInView] = useState<string | null>(null);

  const canEditScores = user?.role === UserRole.ADMIN || user?.role === UserRole.OFFICER || user?.teamId === AMARANTH_JOKERS_TEAM_ID;
  const isAdmin = user?.role === UserRole.ADMIN;

  const groupedEvents = useMemo(() => {
    return events.reduce((acc, event) => {
        (acc[event.category] = acc[event.category] || []).push(event);
        return acc;
    }, {} as Record<string, Event[]>);
  }, [events]);

  const categoryOrder = Object.values(EventCategory);

  const handleTeamSelect = (team: Team) => {
    navigate(`/teams?teamId=${team.id}`, { replace: true });
  };

  const handleEditScores = (event: Event) => {
      openModal(<InputScoresModal event={event} teams={teams} onClose={closeModal} />);
  };
  
  const handleSavePointLog = async (logToSave: Partial<PointLog> & { teamId: string, type: 'merit' | 'demerit' }) => {
    if (!logToSave.teamId || !logToSave.reason || logToSave.points === undefined || logToSave.points <= 0) {
        addToast('Please fill all fields with valid values (points must be > 0).', 'error');
        return;
    }

    try {
        if (logToSave.id) { // Editing existing log
            // FIX: Pass 2 arguments to updatePointLog instead of 3.
            await updatePointLog(logToSave.id, logToSave);
            addToast('Log entry updated!', 'success');
        } else { // Adding new log
            // FIX: Cast `logToSave` to the type expected by `addPointLog`. The preceding conditional check ensures that `reason` and `points` properties are present and valid, making this cast safe.
            await addPointLog(logToSave as { teamId: string; type: 'merit' | 'demerit'; reason: string; points: number; });
            addToast('New log entry added!', 'success');
        }
        closeModal();
    } catch (error: any) {
        addToast(error.message || 'Failed to save log entry.', 'error');
    }
  };

  const handleOpenPointLogModal = (log?: PointLog & { teamId: string, type: 'merit' | 'demerit' }) => {
    const logData = log || { teamId: '', type: 'merit' as const, reason: '', points: 0 };
    openModal(
        <PointLogModalContent 
            log={logData} 
            teams={teams}
            onClose={closeModal}
            onSave={handleSavePointLog}
        />
    );
  };

  const handleDeletePointLog = async (logId: string, teamId: string, type: 'merit' | 'demerit') => {
    if (window.confirm('Are you sure you want to delete this log entry?')) {
        try {
            // FIX: Pass 1 argument to deletePointLog instead of 3.
            await deletePointLog(logId);
            addToast('Log entry deleted.', 'success');
        } catch(error) {
            addToast('Failed to delete log entry.', 'error');
        }
    }
  };
  
  const competingTeams = useMemo(() => {
    const filtered = teams.filter(t => t.id !== AMARANTH_JOKERS_TEAM_ID);
    return getSortedTeamsWithRanks(filtered);
  }, [teams]);
  
  const allLogs = teams.flatMap(team => [
    ...(team.merits || []).map(log => ({ ...log, teamName: team.name, teamId: team.id, type: 'merit' as const })),
    ...(team.demerits || []).map(log => ({ ...log, teamName: team.name, teamId: team.id, type: 'demerit' as const })),
  ]).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const renderStandingsSkeleton = () => (
    <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
             <Card key={i} className="p-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                    <Skeleton className="h-8 w-12" /> {/* Rank */}
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" /> {/* Icon */}
                        <div className="space-y-2">
                           <Skeleton className="h-6 w-32" /> {/* Name */}
                           <Skeleton className="h-4 w-48" /> {/* Badges */}
                        </div>
                    </div>
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-6 w-20 ml-auto" /> {/* Score */}
                        <Skeleton className="h-4 w-16 ml-auto" /> {/* Members */}
                    </div>
                </div>
             </Card>
        ))}
    </div>
  );

  const placementLegend = [
      { label: '1st Place', bg: 'bg-yellow-500', text: 'text-white' },
      { label: '2nd Place', bg: 'bg-slate-300', text: 'text-slate-800' },
      { label: '3rd Place', bg: 'bg-amber-700', text: 'text-white' },
      { label: '4th Place', bg: 'bg-slate-200', text: 'text-slate-600' },
      { label: 'Merit', bg: 'bg-blue-500', text: 'text-white' },
      { label: 'Demerit', bg: 'bg-red-500', text: 'text-white' },
  ];

  if (!isDataAvailable) {
    return <AnimatedPage><NoDataComponent /></AnimatedPage>;
  }

  return (
    <AnimatedPage className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-50">Leaderboard</h1>

      <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-700">
          {((isPrivileged || settings.leaderboard.tabs.standings) && (isPrivileged || settings.competitionScores)) && <button onClick={() => setViewMode('standings')} className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors whitespace-nowrap ${viewMode === 'standings' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Team Standings</button>}
          {(isPrivileged || settings.leaderboard.tabs.records) && <button onClick={() => setViewMode('records')} className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors whitespace-nowrap ${viewMode === 'records' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Competition Records</button>}
          {(isPrivileged || settings.leaderboard.tabs.meritsLog) && <button onClick={() => setViewMode('merits')} className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors whitespace-nowrap ${viewMode === 'merits' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>Merit & Demerit Log</button>}
      </div>

      {viewMode === 'standings' && ((isPrivileged || settings.leaderboard.tabs.standings) && (isPrivileged || settings.competitionScores)) && (
        loading ? renderStandingsSkeleton() : (
          <>
            <div className="flex flex-wrap gap-4 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-soft dark:shadow-soft-dark text-xs sm:text-sm">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Legend:</span>
                {placementLegend.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-1.5">
                        <span className={`inline-block w-4 h-4 rounded-full ${item.bg}`}></span>
                        <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    </div>
                ))}
            </div>
            <div className="space-y-3">
                {[...competingTeams].sort((a,b) => a.rank - b.rank).map((team) => {
                    const style = getTeamStyles(team.id);
                    return (
                        <Card 
                            key={team.id} 
                            className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            onClick={() => handleTeamSelect(team)}
                        >
                            <div className="grid grid-cols-[auto_1fr_auto] items-center p-4 gap-4">
                                {(isPrivileged || settings.competitionScores) && (
                                    <div className="w-12 text-center">
                                        <span className="text-2xl font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors">#{team.rank}</span>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4">
                                    <i className={`${style.icon} text-3xl`} style={{ color: style.gradient.from }}></i>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">{team.name}</h3>
                                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                                            <span className="px-2 py-0.5 rounded-full bg-yellow-500 text-white flex items-center gap-1" title="1st Places">
                                                <i className="bi bi-trophy-fill"></i> {team.placementStats?.first || 0}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-300 text-slate-800 flex items-center gap-1" title="2nd Places">
                                                <i className="bi bi-award-fill"></i> {team.placementStats?.second || 0}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-amber-700 text-white flex items-center gap-1" title="3rd Places">
                                                <i className="bi bi-award-fill"></i> {team.placementStats?.third || 0}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1" title="4th Places">
                                                4th: {team.placementStats?.fourth || 0}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white flex items-center gap-1" title="Merits">
                                                M: {team.placementStats?.merits || 0}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-1" title="Demerits">
                                                D: {team.placementStats?.demerits || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {(isPrivileged || settings.competitionScores) && (
                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{team.score} pts</p>
                                    )}
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{team.playersCount} Members</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
          </>
        )
      )}

      {viewMode === 'records' && (isPrivileged || settings.leaderboard.tabs.records) && (
          <div className="space-y-6">
              {loading ? <Skeleton className="h-96 w-full" /> : events.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 dark:text-slate-400">No events found.</p>
              ) : (
                  categoryOrder.map(category => 
                    groupedEvents[category] && (
                      <div key={category}>
                        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 pb-2 border-b-2 border-indigo-200 dark:border-indigo-800">{category}</h2>
                        <div className="space-y-4">
                        {groupedEvents[category].map(event => {
                            const isCompleted = !!event.results && event.results.length > 0;
                            return (
                                <Card key={event.id} className="p-5">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{event.name}{isCompleted && <i className="bi bi-check-circle-fill text-green-500 text-sm"></i>}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(event.date).toLocaleDateString()} {(isPrivileged || settings.competitionScores) && `• Max Points: ${event.competitionPoints}`}</p>
                                        </div>
                                        {canEditScores && <Button variant="secondary" className="text-sm py-1.5 px-3" onClick={() => handleEditScores(event)}>{isCompleted ? 'Update Scores' : 'Input Scores'}</Button>}
                                    </div>
                                    
                                    {isCompleted ? (
                                        <div className="mt-4 space-y-3">
                                            {[...competingTeams].sort((a, b) => (a.eventScores?.find(es => es.eventId === event.id)?.placement || 999) - (b.eventScores?.find(es => es.eventId === event.id)?.placement || 999)).map(t => {
                                                const teamScore = t.eventScores?.find(es => es.eventId === event.id);
                                                if (!teamScore) return null;
                                                const isExpanded = expandedTeamIdInView === t.id;
                                                const roster = t.rosters?.find(r => r.eventId === event.id)?.participants;
                                                const style = getTeamStyles(t.id);

                                                return (
                                                    <div key={t.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => setExpandedTeamIdInView(isExpanded ? null : t.id)}>
                                                          <div className="flex items-center gap-4">
                                                              {(isPrivileged || settings.competitionScores) && <span className="font-bold text-lg w-8 text-center">#{teamScore.placement}</span>}
                                                              <div>
                                                                  <h4 className="font-semibold flex items-center gap-2" style={{ color: style.gradient.from }}>
                                                                    <i className={`${style.icon} text-lg`}></i>
                                                                    <span>{t.name}</span>
                                                                  </h4>
                                                                  {(isPrivileged || settings.competitionScores) && <p className="text-xs text-slate-500 dark:text-slate-400">{teamScore.competitionPoints} pts earned</p>}
                                                              </div>
                                                          </div>
                                                          <div className="flex items-center gap-3">
                                                              {(isPrivileged || settings.competitionScores) && <div className="text-right"><span className="font-bold text-lg text-slate-800 dark:text-slate-100">{teamScore.rawScore}</span><span className="text-xs block text-slate-500 dark:text-slate-400">Total Raw</span></div>}
                                                              <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-400`}></i>
                                                          </div>
                                                        </div>
                                                        
                                                        {isExpanded && (
                                                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                                                {(isPrivileged || settings.competitionScores) && <div>
                                                                    <h5 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Criteria Breakdown</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">{teamScore.scores.map(score => (<div key={score.criteria} className="p-2 rounded bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"><div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{score.criteria}</div><div className="font-semibold">{score.score} / {score.maxScore}</div></div>))}</div>
                                                                </div>}
                                                                { (roster && roster.length > 0) &&
                                                                  <div>
                                                                    <h5 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Registered Participants</h5>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {roster.map((name, idx) => <span key={idx} className="text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-2 py-1 rounded-full">{name}</span>)}
                                                                    </div>
                                                                  </div>
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">Scores not yet finalized for this event.</p>
                                    )}
                                </Card>
                            );
                        })}
                        </div>
                      </div>
                    )
                  )
              )}
          </div>
      )}

      {viewMode === 'merits' && (isPrivileged || settings.leaderboard.tabs.meritsLog) && (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Merit & Demerit Log</h2>
                {isAdmin && <Button onClick={() => handleOpenPointLogModal()}>Add Entry</Button>}
            </div>
            {loading ? <Skeleton className="h-64 w-full" /> : allLogs.length === 0 ? (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">No merits or demerits have been recorded yet.</p>
            ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {allLogs.map(log => {
                        const style = getTeamStyles(log.teamId);
                        return (
                        <div key={log.id} className={`p-3 rounded-lg flex justify-between items-start gap-4 ${log.type === 'merit' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{log.reason}</p>
                                <small className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <i className={`${style.icon}`} style={{color: style.gradient.from}}></i>
                                    <span>Team: {log.teamName} • By {log.updatedBy} on {new Date(log.timestamp).toLocaleDateString()}</span>
                                </small>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-bold text-lg ${log.type === 'merit' ? 'text-green-500' : 'text-red-500'}`}>{log.type === 'merit' ? `+${log.points}` : `-${log.points}`}</span>
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <Button variant="secondary" className="!p-0 h-6 w-6 text-xs" onClick={() => handleOpenPointLogModal({ ...log, type: log.type })}><i className="bi bi-pencil-fill"></i></Button>
                                        <Button variant="danger" className="!p-0 h-6 w-6 text-xs" onClick={() => handleDeletePointLog(log.id!, log.teamId, log.type)}><i className="bi bi-trash-fill"></i></Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            )}
        </Card>
      )}
    </AnimatedPage>
  );
};

const InputScoresModal: React.FC<{event: Event, teams: Team[], onClose: () => void}> = ({ event, teams, onClose }) => {
  const { addToast } = useToast();
  const [editingResults, setEditingResults] = useState<EventResult[]>([]);

  useEffect(() => {
    const initialResults: EventResult[] = teams.map(team => {
        const existing = event.results?.find(r => r.teamId === team.id);
        if (existing) return { ...existing, criteriaScores: { ...existing.criteriaScores }, merits: [...(existing.merits || [])], demerits: [...(existing.demerits || [])] };
        const criteriaScores: Record<string, number> = {};
        event.criteria.forEach(c => criteriaScores[c.name] = 0);
        return { teamId: team.id, criteriaScores, meritAdjustment: 0, demeritAdjustment: 0, merits: [], demerits: [] };
    });
    setEditingResults(initialResults);
  }, [event, teams]);

  const handleScoreChange = (teamIdx: number, key: string, value: string) => {
      const numVal = parseFloat(value) || 0;
      const updated = [...editingResults];
      updated[teamIdx].criteriaScores[key] = numVal;
      setEditingResults(updated);
  };

  const handleSaveScores = async () => {
    try {
        await updateEventResults(event.id, editingResults);
        addToast('Scores updated and leaderboard synchronized!', 'success');
        onClose();
    } catch (error) {
        addToast('Failed to save scores.', 'error');
    }
  };

  return (
    <>
      <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 id="modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Input Scores: {event.name}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><i className="bi bi-x-lg"></i></button>
      </div>
      <div className="flex-grow min-h-0 overflow-y-auto p-6 space-y-4">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-slate-700 dark:text-slate-300 mb-4">
            <p><strong>Instructions:</strong> Enter raw criteria scores in the table below. The system automatically calculates total raw scores and final placement points.</p>
        </div>
        
        {editingResults.map((res, teamIdx) => {
            const team = teams.find(t => t.id === res.teamId);
            if (!team || team.id === AMARANTH_JOKERS_TEAM_ID) return null;
            const style = getTeamStyles(team.id);

            return (
                <Card key={team.id} className="p-4">
                    <h4 className="font-bold text-lg mb-3" style={{ color: style.gradient.from }}>{team.name}</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Criteria</th>
                                    <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Description</th>
                                    <th className="p-3 text-center font-semibold text-slate-600 dark:text-slate-300 w-32">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {event.criteria.map((crit: CriteriaItem) => (
                                    <tr key={crit.name}>
                                        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{crit.name}</td>
                                        <td className="p-3 text-slate-600 dark:text-slate-300">{crit.description}</td>
                                        <td className="p-3 text-center">
                                            <Input
                                                id={`${team.id}-${crit.name}`}
                                                label=""
                                                type="number"
                                                min="0"
                                                max={crit.points}
                                                value={res.criteriaScores[crit.name] || ''}
                                                onChange={(e) => handleScoreChange(teamIdx, crit.name, e.target.value)}
                                                className="!mt-0 w-24 text-center mx-auto"
                                                placeholder={`Max: ${crit.points}`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            );
        })}
      </div>
      <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveScores}>Save & Calculate Rankings</Button>
      </div>
    </>
  )
}


export default Leaderboard;