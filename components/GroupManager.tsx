import React, { useState } from 'react';
import { DomainGroup } from '../types';
import { X, Plus, Trash2, Edit2, Check, Palette, Save } from 'lucide-react';

// Predefined color palette
const COLOR_PALETTE: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
];

interface GroupManagerProps {
  groups: DomainGroup[];
  onAddGroup: (group: DomainGroup) => void;
  onUpdateGroup: (groupId: string, updates: Partial<DomainGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
  onClose: () => void;
}

export const GroupManager: React.FC<GroupManagerProps> = ({
  groups,
  onAddGroup,
  onUpdateGroup,
  onRemoveGroup,
  onClose
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(COLOR_PALETTE[9]); // Default indigo

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    
    const newGroup: DomainGroup = {
      id: Math.random().toString(36).substr(2, 9),
      name: newGroupName.trim(),
      color: newGroupColor ?? '#6366f1' // Default indigo
    };
    
    onAddGroup(newGroup);
    setNewGroupName('');
    setNewGroupColor(COLOR_PALETTE[9]);
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setNewGroupName('');
    setNewGroupColor(COLOR_PALETTE[9]);
    setIsAdding(false);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (window.confirm(`Delete group "${groupName}"? Domains in this group will be ungrouped.`)) {
      onRemoveGroup(groupId);
    }
  };

  return (
    <div data-testid="group-manager-modal" className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Groups</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Organize domains into groups</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Add New Group */}
          {isAdding ? (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Production, Personal, Client Work"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Palette size={16} className="inline mr-1" />
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewGroupColor(color)}
                      className={`w-8 h-8 rounded-lg transition-transform ${
                        newGroupColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddGroup}
                  disabled={!newGroupName.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  Save Group
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Group
            </button>
          )}

          {/* Existing Groups */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Existing Groups ({groups.length})
              </h3>
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 group"
                  >
                    {editingId === group.id ? (
                      <>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => onUpdateGroup(group.id, { name: e.target.value })}
                          className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                        >
                          <Check size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="flex-1 font-medium text-slate-900 dark:text-white">
                          {group.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {group.color}
                        </span>
                        <button
                          onClick={() => setEditingId(group.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit name"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete group"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {groups.length === 0 && !isAdding && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Palette size={48} className="mx-auto mb-3 opacity-50" />
              <p>No groups yet</p>
              <p className="text-sm">Create your first group to organize domains</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
