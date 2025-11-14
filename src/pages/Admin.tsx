import React, { useState, useMemo } from 'react';
import Card from '../components/Card.tsx';
import Button from '../components/Button.tsx';
import { UserRole, User, Team, Event, EventCategory } from '../types.ts';
import { getUsers, updateUserRole, register, STORAGE_KEYS, getLeaderboard, getEvents } from '../services/api.ts';
import { useToast } from '../hooks/useToast.ts';
import { useModal } from '../hooks/useModal.ts';
import Input from '../components/Input.tsx';
import { useVisibility } from '../hooks/useVisibility.ts';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import AnimatedPage from '../components/AnimatedPage.tsx';
import Skeleton from '../components/Skeleton.tsx';
import { getTeamStyles } from '../config.ts';
import { motion, AnimatePresence } from 'framer-motion';
import { AMARANTH_JOKERS_TEAM_ID } from '../constants.ts';
import { usePageViewLogger } from '../hooks/usePageViewLogger.ts';
import { timeAgo } from '../utils/time.ts';


const getUserPosition = (user: User, teams: Team[]): React.ReactNode => {
    if (user.teamId) {
        const team = teams.find(t => t.id === user.teamId);
        if (team) {
            const style = getTeamStyles(team.id);
            let positionTitle: string | undefined;
            
            if (team.unitLeader === user.id) positionTitle = 'Leader';
            else if (team.unitSecretary === user.id) positionTitle = 'Secretary';
            else if (team.unitTreasurer === user.id) positionTitle = 'Treasurer';
            else if (team.adviser === user.id) positionTitle = 'Adviser';
            else if (team.unitErrands?.includes(user.id)) positionTitle = 'Errands';
            else if (team.id === AMARANTH_JOKERS_TEAM_ID) {
                const facilitator = team.facilitators?.find(f => f.userId === user.id);
                positionTitle = facilitator?.position;
            }

            const positionText = positionTitle ? `${positionTitle}, ${team.name}` : team.name;

            return (
                <div className="flex items-center gap-2">
                    <i className={`${style.icon}`} style={{ color: style.gradient.from }}></i>
                    <span>{positionText}</span>
                </div>
            );
        }
    }
    return 'N/A';
};

const calculateAge = (birthdate?: string): number | null => {
    if (!birthdate) return null;
    try {
        const birthDate = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age > 0 ? age : null;
    } catch {
        return null;
    }
};


const UserManagement: React.FC = () => {
    const { data: usersData, loading: usersLoading } = useSyncedData<User[]>(getUsers, [STORAGE_KEYS.USERS]);
    const { data: teamsData, loading: teamsLoading } = useSyncedData<Team[]>(getLeaderboard, [STORAGE_KEYS.TEAMS]);
    const { data: eventsData, loading: eventsLoading } = useSyncedData<Event[]>(getEvents, [STORAGE_KEYS.EVENTS]);
    const users = usersData || [];
    const teams = teamsData || [];
    const allEvents = eventsData || [];
    const loading = usersLoading || teamsLoading || eventsLoading;
    
    const { openModal, closeModal } = useModal();
    const { addToast } = useToast();

    const [filters, setFilters] = useState({
        name: '',
        role: '',
        gender: '',
        ageBracket: '',
        yearLevel: '',
        event: ''
    });

    const yearLevelOptions = useMemo(() => [...new Set(users.map(u => u.yearLevel).filter(Boolean))].sort(), [users]);
    const ageBrackets = {
        '': 'All Ages',
        '15-18': '15-18 years',
        '19-22': '19-22 years',
        '23-25': '23-25 years',
        '26+': '26+ years',
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const nameMatch = filters.name.toLowerCase();
            if (filters.name && !(user.name.toLowerCase().includes(nameMatch) || user.studentId?.toLowerCase().includes(nameMatch))) {
                return false;
            }
            if (filters.role && user.role !== filters.role) {
                return false;
            }
            if (filters.gender && user.gender !== filters.gender) {
                return false;
            }
            if (filters.yearLevel && user.yearLevel !== filters.yearLevel) {
                return false;
            }
            if (filters.event && !user.interestedEvents?.includes(filters.event)) {
                return false;
            }
            if (filters.ageBracket) {
                const age = calculateAge(user.birthdate);
                if (age === null) return false;

                const bracketParts = filters.ageBracket.split('-');
                const min = parseInt(bracketParts[0], 10);
                const max = bracketParts[1] ? parseInt(bracketParts[1], 10) : Infinity;

                if (age < min || age > max) return false;
            }
            return true;
        });
    }, [users, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilters = () => {
        setFilters({
            name: '',
            role: '',
            gender: '',
            ageBracket: '',
            yearLevel: '',
            event: ''
        });
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        try {
            await updateUserRole(userId, newRole);
            addToast('User role updated successfully', 'success');
        } catch (error) {
            addToast('Failed to update user role', 'error');
        }
    }

    const handleAddUser = () => {
        let newUser: Partial<User> = { role: UserRole.USER };

        const AddUserModalContent = () => {
            const [formState, setFormState] = useState(newUser);
            
            const handleSave = async () => {
                if (!formState.email || !formState.password || !formState.firstName || !formState.lastName) {
                    addToast('Please fill all required fields.', 'error');
                    return;
                }
                try {
                    await register(formState);
                    addToast('User added successfully!', 'success');
                    closeModal();
                } catch (error: any) {
                    addToast(error.message || 'Failed to add user.', 'error');
                }
            };
            
            return (
                <>
                <div className="p-6 space-y-4">
                    <Input id="firstName" label="First Name" onChange={(e) => setFormState({...formState, firstName: e.target.value})} />
                    <Input id="lastName" label="Last Name" onChange={(e) => setFormState({...formState, lastName: e.target.value})} />
                    <Input id="email" label="Email" type="email" onChange={(e) => setFormState({...formState, email: e.target.value})} />
                    <Input id="password" label="Password" type="password" onChange={(e) => setFormState({...formState, password: e.target.value})} />
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                        <select 
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-150"
                            value={formState.role} 
                            onChange={(e) => setFormState({...formState, role: e.target.value as UserRole})}
                        >
                            <option value={UserRole.USER}>User</option>
                            <option value={UserRole.TEAM_LEAD}>Team Lead</option>
                            <option value={UserRole.OFFICER}>Officer</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                    <Button onClick={handleSave}>Add User</Button>
                </div>
                </>
            );
        };
        openModal(<AddUserModalContent />);
    }

    const renderSkeleton = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full">
                <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-8 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-6 py-4 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );

    const selectClass = "w-full mt-1 px-3 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none";

    return (
        <Card>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">User Management</h2>
                    <Button onClick={handleAddUser}>Add User</Button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Name or ID</label>
                        <Input label="" id="name-filter" name="name" value={filters.name} onChange={handleFilterChange} placeholder="Search..." />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Role</label>
                        <select name="role" value={filters.role} onChange={handleFilterChange} className={selectClass}>
                            <option value="">All</option>
                            {Object.values(UserRole).map(role => (
                                <option key={role} value={role} className="capitalize">{role.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Gender</label>
                        <select name="gender" value={filters.gender} onChange={handleFilterChange} className={selectClass}>
                            <option value="">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Age Bracket</label>
                        <select name="ageBracket" value={filters.ageBracket} onChange={handleFilterChange} className={selectClass}>
                            {Object.entries(ageBrackets).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Year Level</label>
                        <select name="yearLevel" value={filters.yearLevel} onChange={handleFilterChange} className={selectClass}>
                            <option value="">All</option>
                            {yearLevelOptions.map(yl => <option key={yl} value={yl as string}>{yl}</option>)}
                        </select>
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Game Interest</label>
                        <select name="event" value={filters.event} onChange={handleFilterChange} className={selectClass}>
                            <option value="">All</option>
                            {allEvents.map(event => <option key={event.id} value={event.name}>{event.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users.
                    </p>
                    <Button variant="secondary" onClick={resetFilters} className="text-xs py-1 px-3">Reset Filters</Button>
                </div>
            </div>

            {loading ? renderSkeleton() : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Position</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Last Active</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-50">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{getUserPosition(user, teams)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <select 
                                            value={user.role} 
                                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                            className="text-xs py-1 px-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500/50 transition"
                                        >
                                            <option value={UserRole.USER}>User</option>
                                            <option value={UserRole.TEAM_LEAD}>Team Lead</option>
                                            <option value={UserRole.OFFICER}>Officer</option>
                                            <option value={UserRole.ADMIN}>Admin</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {user.lastActive ? timeAgo(user.lastActive) : 'Never'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

const ToggleSwitch: React.FC<{ id: string; label: string; checked: boolean; onChange: () => void; }> = ({ id, label, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <div className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                id={id}
                className="sr-only peer"
                checked={checked}
                onChange={onChange}
                aria-checked={checked}
            />
            <div className="w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-indigo-600 transition-colors duration-150 relative peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 peer-focus:ring-offset-2 dark:peer-focus:ring-indigo-800">
                <span className="absolute left-[2px] top-0.5 h-5 w-5 bg-white rounded-full border border-slate-300 dark:border-slate-600 transform transition-transform duration-150 peer-checked:translate-x-5"></span>
            </div>
        </div>
    </label>
);


const VisibilitySettings: React.FC = () => {
    const { settings, setSettings } = useVisibility();
    const { addToast } = useToast();
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    if (!settings) return <div>Loading settings...</div>;

    const handleToggle = (path: string[], value: boolean) => {
        const newSettings = JSON.parse(JSON.stringify(settings));
        let current = newSettings;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
        setSettings(newSettings);
        addToast('Visibility setting updated.', 'info');
    };

    const ExpandableCard: React.FC<{title: string; cardKey: string; children: React.ReactNode}> = ({ title, cardKey, children }) => {
        const isExpanded = expandedCard === cardKey;
        return (
            <Card className="p-0">
                <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : cardKey)}>
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                        <i className="bi bi-chevron-down text-slate-500"></i>
                    </motion.div>
                </div>
                 <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                {children}
                            </div>
                        </motion.div>
                    )}
                 </AnimatePresence>
            </Card>
        )
    };
    
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Control which sections are visible to non-privileged users. This is useful for building suspense during final rounds.</p>
            
            <Card className="p-4">
                <ToggleSwitch id="global-scores" label="Show Competition Scores, Ranks & Points" checked={settings.competitionScores} onChange={() => handleToggle(['competitionScores'], !settings.competitionScores)} />
            </Card>
            
            <ExpandableCard title="Page Visibility (Sidebar)" cardKey="pages">
                <ToggleSwitch id="page-teams" label="Teams Page" checked={settings.pages.teams} onChange={() => handleToggle(['pages', 'teams'], !settings.pages.teams)} />
                <ToggleSwitch id="page-events" label="Events Page" checked={settings.pages.events} onChange={() => handleToggle(['pages', 'events'], !settings.pages.events)} />
                <ToggleSwitch id="page-rules" label="Rules Page" checked={settings.pages.rules} onChange={() => handleToggle(['pages', 'rules'], !settings.pages.rules)} />
                <ToggleSwitch id="page-reports" label="Reports Page" checked={settings.pages.reports} onChange={() => handleToggle(['pages', 'reports'], !settings.pages.reports)} />
            </ExpandableCard>

            <ExpandableCard title="Dashboard Components" cardKey="dashboard">
                <ToggleSwitch id="dash-summary" label="Summary Cards" checked={settings.dashboard.summaryCards} onChange={() => handleToggle(['dashboard', 'summaryCards'], !settings.dashboard.summaryCards)} />
                <ToggleSwitch id="dash-ranking" label="Leaderboard Ranking Chart" checked={settings.dashboard.leaderboardRanking} onChange={() => handleToggle(['dashboard', 'leaderboardRanking'], !settings.dashboard.leaderboardRanking)} />
                <ToggleSwitch id="dash-top-teams" label="Top Teams List" checked={settings.dashboard.topTeams} onChange={() => handleToggle(['dashboard', 'topTeams'], !settings.dashboard.topTeams)} />
                <ToggleSwitch id="dash-progress" label="Team Score Progression Chart" checked={settings.dashboard.teamScoreProgression} onChange={() => handleToggle(['dashboard', 'teamScoreProgression'], !settings.dashboard.teamScoreProgression)} />
            </ExpandableCard>
            
            <ExpandableCard title="Leaderboard Tabs" cardKey="leaderboard">
                <ToggleSwitch id="lb-standings" label="Team Standings Tab" checked={settings.leaderboard.tabs.standings} onChange={() => handleToggle(['leaderboard', 'tabs', 'standings'], !settings.leaderboard.tabs.standings)} />
                <ToggleSwitch id="lb-records" label="Competition Records Tab" checked={settings.leaderboard.tabs.records} onChange={() => handleToggle(['leaderboard', 'tabs', 'records'], !settings.leaderboard.tabs.records)} />
                <ToggleSwitch id="lb-merits" label="Merit & Demerit Log Tab" checked={settings.leaderboard.tabs.meritsLog} onChange={() => handleToggle(['leaderboard', 'tabs', 'meritsLog'], !settings.leaderboard.tabs.meritsLog)} />
            </ExpandableCard>

                <ExpandableCard title="Teams Page Sections" cardKey="teams">
                    <ToggleSwitch id="teams-facilitating" label="Facilitating Team Section" checked={settings.teams.facilitatingTeam} onChange={() => handleToggle(['teams', 'facilitatingTeam'], !settings.teams.facilitatingTeam)} />
                    <ToggleSwitch id="teams-participating" label="Participating Teams Section" checked={settings.teams.participatingTeams} onChange={() => handleToggle(['teams', 'participatingTeams'], !settings.teams.participatingTeams)} />
                    <div className="ml-4 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Team Hub Tabs:</p>
                        <ToggleSwitch id="teams-tab-overview" label="Overview Tab" checked={settings.teams.tabs.overview} onChange={() => handleToggle(['teams', 'tabs', 'overview'], !settings.teams.tabs.overview)} />
                        <ToggleSwitch id="teams-tab-leadership" label="Leadership Tab" checked={settings.teams.tabs.leadership} onChange={() => handleToggle(['teams', 'tabs', 'leadership'], !settings.teams.tabs.leadership)} />
                        <ToggleSwitch id="teams-tab-progress" label="Progress Charts" checked={settings.teams.tabs.progress} onChange={() => handleToggle(['teams', 'tabs', 'progress'], !settings.teams.tabs.progress)} />
                        <ToggleSwitch id="teams-tab-merits" label="Merits & Demerits" checked={settings.teams.tabs.merits} onChange={() => handleToggle(['teams', 'tabs', 'merits'], !settings.teams.tabs.merits)} />
                        <ToggleSwitch id="teams-tab-scores" label="Event Scorecards" checked={settings.teams.tabs.scores} onChange={() => handleToggle(['teams', 'tabs', 'scores'], !settings.teams.tabs.scores)} />
                    </div>
                </ExpandableCard>

                <ExpandableCard title="Events Categories" cardKey="events">
                    <div className="space-y-2">
                        <ToggleSwitch id="event-joker-flag" label={`${EventCategory.JOKER_FLAG}`} checked={settings.events.categories[EventCategory.JOKER_FLAG]} onChange={() => handleToggle(['events', 'categories', EventCategory.JOKER_FLAG], !settings.events.categories[EventCategory.JOKER_FLAG])} />
                        <ToggleSwitch id="event-cit-quest" label={`${EventCategory.CIT_QUEST}`} checked={settings.events.categories[EventCategory.CIT_QUEST]} onChange={() => handleToggle(['events', 'categories', EventCategory.CIT_QUEST], !settings.events.categories[EventCategory.CIT_QUEST])} />
                        <ToggleSwitch id="event-mindscape" label={`${EventCategory.MINDSCAPE}`} checked={settings.events.categories[EventCategory.MINDSCAPE]} onChange={() => handleToggle(['events', 'categories', EventCategory.MINDSCAPE], !settings.events.categories[EventCategory.MINDSCAPE])} />
                        <ToggleSwitch id="event-hoop-spike" label={`${EventCategory.HOOP_SPIKE}`} checked={settings.events.categories[EventCategory.HOOP_SPIKE]} onChange={() => handleToggle(['events', 'categories', EventCategory.HOOP_SPIKE], !settings.events.categories[EventCategory.HOOP_SPIKE])} />
                        <ToggleSwitch id="event-coding" label={`${EventCategory.CODING_TECH_CHALLENGES}`} checked={settings.events.categories[EventCategory.CODING_TECH_CHALLENGES]} onChange={() => handleToggle(['events', 'categories', EventCategory.CODING_TECH_CHALLENGES], !settings.events.categories[EventCategory.CODING_TECH_CHALLENGES])} />
                        <ToggleSwitch id="event-pixel-play" label={`${EventCategory.PIXEL_PLAY}`} checked={settings.events.categories[EventCategory.PIXEL_PLAY]} onChange={() => handleToggle(['events', 'categories', EventCategory.PIXEL_PLAY], !settings.events.categories[EventCategory.PIXEL_PLAY])} />
                        <ToggleSwitch id="event-table-masters" label={`${EventCategory.TABLE_MASTERS}`} checked={settings.events.categories[EventCategory.TABLE_MASTERS]} onChange={() => handleToggle(['events', 'categories', EventCategory.TABLE_MASTERS], !settings.events.categories[EventCategory.TABLE_MASTERS])} />
                    </div>
                </ExpandableCard>

                <ExpandableCard title="Rules Sections" cardKey="rules">
                    <ToggleSwitch id="rules-objectives" label="Objectives Section" checked={settings.rules.sections.objectives} onChange={() => handleToggle(['rules', 'sections', 'objectives'], !settings.rules.sections.objectives)} />
                    <ToggleSwitch id="rules-house-rules" label="House Rules Section" checked={settings.rules.sections.house_rules} onChange={() => handleToggle(['rules', 'sections', 'house_rules'], !settings.rules.sections.house_rules)} />
                    <ToggleSwitch id="rules-demerit" label="Demerit System Section" checked={settings.rules.sections.demerit_system} onChange={() => handleToggle(['rules', 'sections', 'demerit_system'], !settings.rules.sections.demerit_system)} />
                    <ToggleSwitch id="rules-complaints" label="Complaints Section" checked={settings.rules.sections.complaints} onChange={() => handleToggle(['rules', 'sections', 'complaints'], !settings.rules.sections.complaints)} />
                    <ToggleSwitch id="rules-scoring" label="Scoring System Section" checked={settings.rules.sections.scoring_system} onChange={() => handleToggle(['rules', 'sections', 'scoring_system'], !settings.rules.sections.scoring_system)} />
                    <ToggleSwitch id="rules-categories" label="Categories & Mechanics Section" checked={settings.rules.sections.categories_mechanics} onChange={() => handleToggle(['rules', 'sections', 'categories_mechanics'], !settings.rules.sections.categories_mechanics)} />
                </ExpandableCard>
        </div>
    );
};

const Admin: React.FC = () => {
    usePageViewLogger('admin');
    const [activeTab, setActiveTab] = useState<'users' | 'visibility'>('users');

    return (
        <AnimatedPage className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-50">Admin Panel</h1>
            <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setActiveTab('users')} 
                    className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors ${activeTab === 'users' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    User Management
                </button>
                <button 
                    onClick={() => setActiveTab('visibility')} 
                    className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors ${activeTab === 'visibility' ? 'bg-white dark:bg-slate-800 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Content Visibility
                </button>
            </div>
            
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'visibility' && <VisibilitySettings />}
        </AnimatedPage>
    );
};

export default Admin;