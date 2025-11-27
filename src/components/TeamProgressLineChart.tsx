import React from 'react';
import { Team, DetailedScoreHistoryPoint } from '../types.ts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '../hooks/useTheme.ts';
import { getTeamStyles } from '../config.ts';
import { useModal } from '../hooks/useModal.ts';
import Card from './Card.tsx';

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data: DetailedScoreHistoryPoint = payload[0].payload;
        return (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm">
                <p className="font-bold text-slate-800 dark:text-slate-100">{data.reason}</p>
                <p className={`font-semibold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    Change: {data.change >= 0 ? `+${data.change}` : data.change} pts
                </p>
                <p className="text-slate-600 dark:text-slate-300">Total Score: {data.score}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(data.timestamp).toLocaleString()}</p>
            </div>
        );
    }
    return null;
};

const ScoreHistoryModal: React.FC<{ team: Team }> = ({ team }) => {
    const teamStyle = getTeamStyles(team.id);

    return (
        <div className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <i className={`${teamStyle.icon}`} style={{ color: teamStyle.gradient.from }}></i>
                Score History for {team.name}
            </h3>
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
                {team.detailedProgressHistory && team.detailedProgressHistory.length > 1 ? (
                    team.detailedProgressHistory.slice(1).map((item, index) => (
                        <div key={index} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{item.reason}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold text-lg ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {item.change >= 0 ? `+${item.change}` : item.change}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Total: {item.score}</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-slate-500 dark:text-slate-400">No score updates recorded yet.</p>
                )}
            </div>
        </div>
    );
};

const SingleTeamChart: React.FC<{ team: Team, color: string }> = ({ team, color }) => {
    const { theme } = useTheme();
    const { openModal, closeModal } = useModal();
    const tickColor = theme === 'dark' ? '#94a3b8' : '#64748b';

    const handleChartClick = () => {
        openModal(
            <>
                <div className="flex justify-end p-2">
                    <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><i className="bi bi-x-lg"></i></button>
                </div>
                <ScoreHistoryModal team={team} />
            </>
        );
    };
    
    const raw = team.detailedProgressHistory || [];
    const hasMeaningfulData = raw.length > 0;

    if (!hasMeaningfulData) {
        return (
             <div className="h-48 flex flex-col">
                <h4 className="font-bold text-sm mb-2" style={{ color }}>{team.name}</h4>
                <div className="flex-grow flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">No score updates yet.</p>
                </div>
            </div>
        )
    }
    // Normalize data: ensure every point has score, timestamp, reason, change
    const normalized: any[] = raw.map((item: any, i: number) => ({
        score: typeof item.score === 'number' ? item.score : (item.score ? Number(item.score) : 0),
        timestamp: item.timestamp || item.date || new Date().toISOString(),
        reason: item.reason || (i === 0 ? 'Initial score' : 'Update'),
        change: typeof item.change === 'number' ? item.change : 0,
    }));
    // If change values are missing, compute them from score deltas
    for (let i = normalized.length - 1; i > 0; i--) {
        if (!normalized[i].change) normalized[i].change = normalized[i].score - normalized[i-1].score;
    }
    if (normalized.length === 1 && normalized[0].change === 0) normalized[0].change = 0;

    const ticks = normalized.map((_, i) => i).filter(i => i % Math.ceil((normalized.length || 1) / 5) === 0 || i === (normalized.length || 0) -1);

    return (
        <div className="h-48 cursor-pointer" onClick={handleChartClick} title="Click to view score log">
            <h4 className="font-bold text-sm mb-2" style={{ color }}>{team.name}</h4>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={normalized} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={theme === 'dark' ? 0.1 : 0.3} />
                    <XAxis 
                        tick={{fontSize: 10, fill: tickColor}} 
                        tickFormatter={(index) => `#${index+1}`}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={40}
                        ticks={ticks}
                    />
                    <YAxis tick={{fontSize: 10, fill: tickColor}} domain={[0, 'dataMax + 50']} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="stepAfter" dataKey="score" stroke={color} strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3, strokeWidth: 2 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// FIX: Define the props interface for TeamProgressLineChart.
interface TeamProgressLineChartProps {
  teams: Team[];
}

const TeamProgressLineChart: React.FC<TeamProgressLineChartProps> = ({ teams }) => {
  if (!teams || teams.length === 0) {
    return <p className="text-center text-slate-500 dark:text-slate-400 h-80 flex items-center justify-center">No score history available to display.</p>;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {teams.map((team) => {
            const style = getTeamStyles(team.id);
            return (
                <SingleTeamChart 
                    key={team.id} 
                    team={team} 
                    color={style.gradient.from} 
                />
            )
        })}
    </div>
  );
};

export default TeamProgressLineChart;