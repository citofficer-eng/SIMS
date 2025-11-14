import React, { useState } from 'react';
import Card from '../components/Card.tsx';
import Button from '../components/Button.tsx';
import { usePageViewLogger } from '../hooks/usePageViewLogger.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { useSyncedData } from '../hooks/useSyncedData.ts';
import { getRules, updateRules, STORAGE_KEYS, UserRole } from '../services/api.ts';
import { enqueue, processQueue } from '../utils/syncQueue';
import { RulesData, RuleSection, RuleItem } from '../types.ts';
import Skeleton from '../components/Skeleton.tsx';
import { motion, AnimatePresence } from 'framer-motion';

const Rules: React.FC = () => {
    usePageViewLogger('rules');
    const { user } = useAuth();
    const { addToast } = useToast();
    const isAdmin = user?.role === UserRole.ADMIN;
    
    const { data: rulesData, loading: rulesLoading } = useSyncedData<RulesData>(getRules, [STORAGE_KEYS.RULES]);

    const handleSaveRules = async (updatedRules: RulesData) => {
        try {
            await updateRules(updatedRules);
            addToast('Rules updated successfully!', 'success');
        } catch (error) {
            // If saving failed (offline or server issue), enqueue for later sync
            try {
                enqueue('rules:update', updatedRules);
                processQueue();
                addToast('Rules update queued — will sync when online.', 'info');
            } catch (e) {
                addToast('Failed to update rules', 'error');
            }
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!rulesData) return;
        const updated = {
            ...rulesData,
            sections: rulesData.sections.filter(s => s.id !== sectionId)
        };
        await handleSaveRules(updated);
        addToast('Section deleted', 'success');
    };

    const handleAddItemToSection = (sectionId: string, itemType: string, content: string) => {
        if (!rulesData) return;
        const newItem: RuleItem = itemType === 'heading' 
            ? { type: 'heading', level: 3, content }
            : itemType === 'paragraph' 
            ? { type: 'paragraph', content }
            : { type: 'list', items: content.split('\n').filter(x => x.trim()) };
        const updated = {
            ...rulesData,
            sections: rulesData.sections.map(s => 
                s.id === sectionId 
                    ? { ...s, items: [...s.items, newItem] }
                    : s
            )
        };
        handleSaveRules(updated);
    };

    const handleDeleteItem = (sectionId: string, itemIndex: number) => {
        if (!rulesData) return;
        const updated = {
            ...rulesData,
            sections: rulesData.sections.map(s =>
                s.id === sectionId
                    ? { ...s, items: s.items.filter((_, i) => i !== itemIndex) }
                    : s
            )
        };
        handleSaveRules(updated);
    };

    const renderItem = (item: RuleItem, sectionId: string, itemIndex: number) => {
        switch (item.type) {
            case 'heading':
                return (
                    <div key={itemIndex} className="relative group">
                        <h3 className="text-lg font-semibold mt-4 mb-2">{item.content}</h3>
                        {isAdmin && (
                            <button
                                onClick={() => handleDeleteItem(sectionId, itemIndex)}
                                className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                        )}
                    </div>
                );
            case 'paragraph':
                return (
                    <div key={itemIndex} className="relative group mb-3">
                        <p className="text-slate-600 dark:text-slate-300">{item.content}</p>
                        {isAdmin && (
                            <button
                                onClick={() => handleDeleteItem(sectionId, itemIndex)}
                                className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                        )}
                    </div>
                );
            case 'list':
                return (
                    <div key={itemIndex} className="relative group mb-3">
                        <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300">
                            {item.items?.map((listItem, i) => (
                                <li key={i}>{listItem}</li>
                            ))}
                        </ul>
                        {isAdmin && (
                            <button
                                onClick={() => handleDeleteItem(sectionId, itemIndex)}
                                className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    if (rulesLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (!rulesData) {
        return <div className="text-center text-slate-500">No rules data available</div>;
    }

    return (
        <div className="space-y-8 pb-8">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">{rulesData.mainTitle}</h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 mt-1">{rulesData.subTitle}</p>
                <p className="text-sm text-indigo-500 dark:text-indigo-400 mt-2">{rulesData.hashTags}</p>
                {isAdmin && (
                    <div className="mt-4">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                const title = prompt('Enter section title:');
                                if (title) {
                                    const newSection: RuleSection = {
                                        id: Date.now().toString(),
                                        title,
                                        items: []
                                    };
                                    handleSaveRules({
                                        ...rulesData,
                                        sections: [...rulesData.sections, newSection]
                                    });
                                }
                            }}
                        >
                            <i className="bi bi-plus mr-1"></i> Add Section
                        </Button>
                    </div>
                )}
            </div>

            {/* Sections */}
            <AnimatePresence>
                {rulesData.sections.map((section) => (
                    <motion.div
                        key={section.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="p-6 relative group">
                            {isAdmin && (
                                <button
                                    onClick={() => handleDeleteSection(section.id)}
                                    className="absolute top-4 right-4 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                    title="Delete section"
                                >
                                    <i className="bi bi-trash"></i>
                                </button>
                            )}
                            
                            <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">
                                {section.title}
                            </h2>

                            <div className="space-y-3">
                                {section.items.map((item, itemIdx) => renderItem(item, section.id, itemIdx))}
                            </div>

                            {isAdmin && (
                                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                    <h4 className="font-semibold text-sm">Add Content:</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Button
                                            variant="secondary"
                                            className="text-xs py-2"
                                            onClick={() => {
                                                const content = prompt('Enter heading text:');
                                                if (content) handleAddItemToSection(section.id, 'heading', content);
                                            }}
                                        >
                                            <i className="bi bi-type-h3 mr-1"></i> Add Heading
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="text-xs py-2"
                                            onClick={() => {
                                                const content = prompt('Enter paragraph text:');
                                                if (content) handleAddItemToSection(section.id, 'paragraph', content);
                                            }}
                                        >
                                            <i className="bi bi-card-text mr-1"></i> Add Paragraph
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="text-xs py-2"
                                            onClick={() => {
                                                const content = prompt('Enter list items (one per line):');
                                                if (content) handleAddItemToSection(section.id, 'list', content);
                                            }}
                                        >
                                            <i className="bi bi-list-ul mr-1"></i> Add List
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default Rules;
