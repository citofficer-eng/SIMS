import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.ts';
import { useTheme } from '../hooks/useTheme.ts';
import { useNotification } from '../hooks/useNotification.ts';
import { useNavigate } from 'react-router-dom';
import { getEvents, getLeaderboard, getUsers, STORAGE_KEYS } from '../services/api.ts';
import { Team, Event, User } from '../types.ts';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import { motion } from 'framer-motion';
import ConnectionStatus from './ConnectionStatus';

const HamburgerIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300 ease-in-out"
    >
        <path d={isOpen ? "M 4 4 L 20 20" : "M 4 6 H 20"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: 'd 0.3s' }} />
        <path d="M 4 12 H 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: 'opacity 0.3s', opacity: isOpen ? 0 : 1 }} />
        <path d={isOpen ? "M 4 20 L 20 4" : "M 4 18 H 20"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: 'd 0.3s' }} />
    </svg>
);


const Header: React.FC<{ onToggleSidebar: () => void, sidebarOpen: boolean }> = ({ onToggleSidebar, sidebarOpen }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ teams: Team[], events: Event[], users: User[] }>({ teams: [], events: [], users: [] });
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const { data: teams, isSynced: teamsSynced } = useSyncedData<Team[]>(getLeaderboard, [STORAGE_KEYS.TEAMS, STORAGE_KEYS.USERS]);
  const { data: events, isSynced: eventsSynced } = useSyncedData<Event[]>(getEvents, [STORAGE_KEYS.EVENTS]);
  const { data: allUsers, isSynced: usersSynced } = useSyncedData<User[]>(getUsers, [STORAGE_KEYS.USERS]);
  
  const isLive = teamsSynced || eventsSynced || usersSynced;

  const searchRefDesktop = useRef<HTMLDivElement>(null);
  const searchRefMobile = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as Node;
          if (
              (searchRefDesktop.current && !searchRefDesktop.current.contains(target)) &&
              (searchRefMobile.current && !searchRefMobile.current.contains(target))
          ) {
              setShowResults(false);
          }
          if (notificationRef.current && !notificationRef.current.contains(target)) {
              setShowNotifications(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      }
  }, []);

  useEffect(() => {
      if (searchQuery.trim() === '' || !teams || !events || !allUsers) {
          setSearchResults({ teams: [], events: [], users: [] });
          return;
      }
      const lowerQuery = searchQuery.toLowerCase();
      const matchedTeams = teams.filter(t => t.name.toLowerCase().includes(lowerQuery));
      const matchedEvents = events.filter(e => e.name.toLowerCase().includes(lowerQuery));
      const matchedUsers = allUsers.filter(u => 
        (u.name && u.name.toLowerCase().includes(lowerQuery)) ||
        (u.firstName && u.firstName.toLowerCase().includes(lowerQuery)) ||
        (u.lastName && u.lastName.toLowerCase().includes(lowerQuery)) ||
        (u.studentId && u.studentId.toLowerCase().includes(lowerQuery))
      );
      setSearchResults({ teams: matchedTeams, events: matchedEvents, users: matchedUsers });
  }, [searchQuery, teams, events, allUsers]);

  const handleSearchResultClick = (type: 'team' | 'event' | 'user', id: string) => {
      setSearchQuery('');
      setShowResults(false);
      if (type === 'team') {
          navigate(`/teams?teamId=${id}`);
      } else if (type === 'event') {
          navigate(`/events?eventId=${id}`);
      } else if (type === 'user') {
          navigate(`/profile/${id}`);
      }
  }

  const handleNotificationClick = (notificationId: string, link: string) => {
      markAsRead(notificationId);
      setShowNotifications(false);
      navigate(link);
  }
  
  const handleBellClick = () => {
      setShowNotifications(!showNotifications);
      if (showNotifications) { // if it was open and we're closing it
        setShowAllNotifications(false);
      }
  }

  const searchResultsDropdown = (
    showResults && searchQuery && (searchResults.teams.length > 0 || searchResults.events.length > 0 || searchResults.users.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
            {searchResults.teams.length > 0 && (
                <div className="p-2">
                    <h6 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 mb-1">TEAMS</h6>
                    <ul>
                        {searchResults.teams.slice(0, 3).map(team => (
                            <li key={team.id} onClick={() => handleSearchResultClick('team', team.id)} className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors text-sm text-slate-700 dark:text-slate-200 flex justify-between">
                                <span>{team.name}</span>
                                <span className="text-xs text-slate-500">Rank #{team.rank}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {searchResults.events.length > 0 && (
                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                    <h6 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 mb-1">EVENTS</h6>
                     <ul>
                        {searchResults.events.slice(0, 3).map(event => (
                            <li key={event.id} onClick={() => handleSearchResultClick('event', event.id)} className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors text-sm text-slate-700 dark:text-slate-200">
                                <span>{event.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {searchResults.users.length > 0 && (
                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                    <h6 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 mb-1">USERS</h6>
                     <ul>
                        {searchResults.users.slice(0, 3).map(u => (
                            <li key={u.id} onClick={() => handleSearchResultClick('user', u.id)} className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors text-sm text-slate-700 dark:text-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <img src={u.avatar} alt={u.name} className="h-6 w-6 rounded-full object-cover" />
                                    <span>{u.name}</span>
                                </div>
                                <span className="text-xs text-slate-500">{u.studentId}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
  );

  const visibleNotifications = showAllNotifications ? notifications : notifications.slice(0, 20);


  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-soft dark:shadow-soft-dark z-30 p-4 relative flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="text-slate-600 dark:text-slate-300 md:hidden">
            <HamburgerIcon isOpen={sidebarOpen} />
          </button>

          <div className="flex items-center gap-2 md:hidden">
            <div className="logo bg-indigo-600 text-white h-8 w-8 rounded-lg flex items-center justify-center text-md font-bold">S</div>
            <div className="font-bold text-slate-800 dark:text-slate-100">SIMS</div>
          </div>

          <div className="hidden md:block">
            <h5 className="font-bold text-lg text-slate-800 dark:text-slate-50 mb-0">Welcome back, {user?.firstName || user?.name}! 👋</h5>
            <small className="text-slate-500 dark:text-slate-400">Here's a look at the current standings.</small>
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-4">
            <div className={`hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300 ${isLive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-md shadow-green-500/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                <span className={`h-2.5 w-2.5 rounded-full transition-colors ${isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span className="font-semibold">{isLive ? 'Live Sync' : 'Real-time'}</span>
            </div>
            <ConnectionStatus />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block w-64" ref={searchRefDesktop}>
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              className="pl-9 pr-4 py-2 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition" 
              placeholder="Search teams, events, users..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
            />
            {searchResultsDropdown}
          </div>
          <motion.button 
            whileHover={{ scale: 1.15, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme} 
            className="p-2 h-10 w-10 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? <i className="bi bi-sun-fill text-lg"></i> : <i className="bi bi-moon-fill text-lg"></i>}
          </motion.button>
          
          <div className="relative" ref={notificationRef}>
              <motion.button 
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleBellClick} 
                className="p-2 h-10 w-10 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 relative transition-colors"
              >
                <i className="bi bi-bell-fill text-lg"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-white dark:border-slate-900">
                      {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.button>
              
              {showNotifications && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col max-h-[80vh]">
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                          <h6 className="font-bold text-slate-800 dark:text-slate-100">Notifications</h6>
                          {unreadCount > 0 && (
                              <button onClick={markAllAsRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Mark all read</button>
                          )}
                      </div>
                      <div className="overflow-y-auto">
                          {notifications.length === 0 ? (
                              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">No notifications yet.</div>
                          ) : (
                              <ul>
                                  {visibleNotifications.map(notif => (
                                      <li key={notif.id} onClick={() => handleNotificationClick(notif.id, notif.link)} className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${!notif.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                          <div className="flex gap-3 items-start">
                                              <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!notif.read ? 'bg-indigo-600' : 'bg-transparent'}`}></div>
                                              <div>
                                                  <h6 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight mb-1">{notif.title}</h6>
                                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{notif.message}</p>
                                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">{new Date(notif.timestamp).toLocaleString()}</span>
                                              </div>
                                          </div>
                                      </li>
                                  ))}
                              </ul>
                          )}
                      </div>
                      {notifications.length > 20 && (
                          <div className="p-2 text-center border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
                              <button onClick={() => setShowAllNotifications(prev => !prev)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                  {showAllNotifications ? 'Show Less' : `Show ${notifications.length - 20} more`}
                              </button>
                          </div>
                      )}
                  </div>
              )}
          </div>
        </div>
      </div>
      <div className="relative mt-4 md:hidden" ref={searchRefMobile}>
        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input 
          className="pl-9 pr-4 py-2 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition" 
          placeholder="Search teams, events, users..." 
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {searchResultsDropdown}
      </div>
    </header>
  );
};

export default Header;
