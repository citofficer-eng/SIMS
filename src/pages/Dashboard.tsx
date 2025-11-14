import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card from '../components/Card.tsx';
import LeaderboardBarChart from '../components/LeaderboardBarChart.tsx';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Team } from '../types.ts';
import { getLeaderboard, STORAGE_KEYS, subscribeToFirebaseData } from '../services/api.ts';
import { useEventContext } from '../hooks/useEventContext.ts';
import { availableEvents } from '../contexts/EventContext.tsx';
import AnimatedPage from '../components/AnimatedPage.tsx';
import NoDataComponent from '../components/NoDataComponent.tsx';
import Skeleton, { SkeletonCard, SkeletonList } from '../components/Skeleton.tsx';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import { usePageViewLogger } from '../hooks/usePageViewLogger.ts';
import TeamProgressLineChart from '../components/TeamProgressLineChart.tsx';
import { AMARANTH_JOKERS_TEAM_ID } from '../constants.ts';
import { getTeamStyles } from '../config.ts';
import { getSortedTeamsWithRanks } from '../utils/ranking.ts';
import { TrendIcon, getTrendType } from '../utils/trends.tsx';

const Dashboard: React.FC = () => {
    usePageViewLogger('dashboard');
    const { selectedEvent, setSelectedEvent, isDataAvailable } = useEventContext();
    const navigate = useNavigate();
    
    // Subscribe to Firebase real-time updates for teams
    const [leaderboardData, setLeaderboardData] = useState<Team[] | null>(null);
    const [leaderboardLoading, setLeaderboardLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Initial fetch
        const doFetch = async () => {
            try {
                const data = await getLeaderboard();
                if (isMounted) {
                    setLeaderboardData(data);
                    setLeaderboardLoading(false);
                }
            } catch (e) {
                console.warn('Failed to fetch leaderboard', e);
                if (isMounted) setLeaderboardLoading(false);
            }
        };

        doFetch();

        // Subscribe to Firebase real-time updates
        const unsubscribe = subscribeToFirebaseData('teams', (teamsData: { [key: string]: Team }) => {
            if (isMounted && teamsData) {
                const teamsArray = Object.values(teamsData);
                setLeaderboardData(teamsArray);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);
    
    const competingTeams = useMemo(() => {
        const filtered = (leaderboardData || []).filter(t => t.id !== AMARANTH_JOKERS_TEAM_ID);
        return getSortedTeamsWithRanks(filtered);
    }, [leaderboardData]);

    const totalPoints = useMemo(() => {
        return (competingTeams || []).reduce((sum, t) => sum + (t.score || 0), 0);
    }, [competingTeams]);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const renderSkeletons = () => (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3 p-6"><Skeleton className="h-80 w-full" /></Card>
                <div className="lg:col-span-2 space-y-4">
                    <Skeleton className="h-8 w-1/3 mb-2" />
                    <SkeletonList count={3} />
                </div>
            </div>
            <Card className="p-6">
                <Skeleton className="h-80 w-full" />
            </Card>
        </>
    );

  return (
    <AnimatedPage className="space-y-6">
       <div className="text-center mb-6">
          <div className="relative inline-block" ref={dropdownRef}>
             <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-center gap-3 text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 focus:outline-none transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
             >
                <span>{selectedEvent}</span>
                <i className={`bi bi-chevron-down text-2xl transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
             </button>
             
             <AnimatePresence>
                {isDropdownOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-10"
                    >
                        <ul className="p-2">
                            {availableEvents.map(event => (
                                <li
                                    key={event}
                                    onClick={() => {
                                        setSelectedEvent(event);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg cursor-pointer transition-colors ${selectedEvent === event ? 'text-indigo-600' : ''}`}
                                >
                                    {event}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}
             </AnimatePresence>
          </div>
       </div>

      { !isDataAvailable ? <NoDataComponent /> : leaderboardLoading ? renderSkeletons() : (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {competingTeams.slice(0, 4).map((team) => {
                    const history = team.progressHistory || [];
                    let percentageChange = 0;
                    if (history.length >= 2) {
                        const currentScore = history[history.length - 1].score;
                        const previousScore = history[history.length - 2].score;
                        if (previousScore > 0) {
                            percentageChange = ((currentScore - previousScore) / previousScore) * 100;
                        } else if (currentScore > 0) {
                            percentageChange = 100.0;
                        }
                    }

                    const isPositive = percentageChange >= 0;
                    const teamStyle = getTeamStyles(team.id);
                    const trendType = getTrendType(percentageChange);

                    const shareOfTotal = totalPoints > 0 ? (team.score / totalPoints) * 100 : 0;
                    const shareText = `${shareOfTotal.toFixed(1)}%`;

                    return (
                        <Card key={team.id} className="p-5 transform transition-transform hover:-translate-y-1">
                            <div className="flex justify-between items-start">
                                <small className="text-slate-500 dark:text-slate-400 font-semibold">{team.name}</small>
                                <i className={`${teamStyle.icon} text-2xl`} style={{ color: teamStyle.gradient.from }}></i>
                            </div>

                            <div className="flex items-baseline justify-between mt-3 mb-2">
                                <h4 className="font-bold text-2xl text-slate-800 dark:text-slate-100 mb-0">{team.score} Pts</h4>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Share of total</span>
                                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{shareText}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Change</span>
                                        <span className={`font-semibold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            {percentageChange !== 0 ? (isPositive ? '+' : '') + Math.abs(percentageChange).toFixed(1) + '%' : '0%'}
                                        </span>
                                    </div>
                                    <TrendIcon trend={trendType} className="w-5 h-5" />
                                </div>
                            </div>
                            <small className="text-slate-500 dark:text-slate-400 mt-2 block">
                                <i className="bi bi-trophy-fill text-yellow-500 mr-1"></i>
                                {team.placementStats?.first || 0} 1st place{(team.placementStats?.first || 0) !== 1 ? 's' : ''}
                            </small>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3">
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-4">Leaderboard Ranking</h2>
                    </div>
                    <div className="px-6 pb-6">
                        <LeaderboardBarChart teams={competingTeams} />
                    </div>
                </Card>
                <div className="lg:col-span-2 space-y-4">
                     <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Top Teams</h2>
                        <div className="space-y-3 mt-2">
                            {competingTeams.slice(0, 5).map(team => (
                                <Card key={team.id} className="p-4 cursor-pointer group" onClick={() => navigate(`/teams?teamId=${team.id}`)}>
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">{team.name}</h3>
                                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">#{team.rank}</span>
                                  </div>
                                  <div className="flex justify-between items-end pt-2 border-t border-slate-100 dark:border-slate-700">
                                      <div className="text-sm text-slate-500 dark:text-slate-400">
                                          <i className="bi bi-people-fill mr-1"></i>{team.playersCount} Members
                                      </div>
                                      <span className="font-bold text-slate-800 dark:text-slate-100">{team.score} pts</span>
                                  </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">Team Score Progression</h2>
                </div>
                <div className="px-6 pb-6">
                    <TeamProgressLineChart teams={competingTeams} />
                </div>
            </Card>
        </>
      )}

    </AnimatedPage>
  );
};

export default Dashboard;