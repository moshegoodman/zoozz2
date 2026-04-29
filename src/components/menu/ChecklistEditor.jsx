import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

// Generates a simple unique id
const uid = () => Math.random().toString(36).slice(2, 9);

export default function ChecklistEditor({ items = [], onChange, readOnly = false, label }) {
  const [newHebrew, setNewHebrew] = useState('');
  const [newEnglish, setNewEnglish] = useState('');

  const addRow = () => {
    if (!newHebrew.trim()) return;
    onChange([...items, { id: uid(), hebrew: newHebrew.trim(), english: newEnglish.trim(), checked: false }]);
    setNewHebrew('');
    setNewEnglish('');
  };

  const toggleChecked = (id) => {
    onChange(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const updateItem = (id, field, val) => {
    onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i));
  };

  const removeItem = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-2">
      {label && <h4 className="text-sm font-semibold text-gray-700">{label}</h4>}
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <Checkbox
              checked={!!item.checked}
              onCheckedChange={() => !readOnly && toggleChecked(item.id)}
              disabled={readOnly}
            />
            {readOnly ? (
              <div className="flex-1 flex gap-4">
                <span className="text-sm text-right flex-1" dir="rtl">{item.hebrew}</span>
                <span className="text-sm text-gray-500 flex-1">{item.english}</span>
              </div>
            ) : (
              <div className="flex-1 flex gap-2">
                <Input
                  value={item.hebrew}
                  onChange={e => updateItem(item.id, 'hebrew', e.target.value)}
                  className="h-7 text-sm text-right flex-1"
                  dir="rtl"
                  placeholder="עברית"
                />
                <Input
                  value={item.english}
                  onChange={e => updateItem(item.id, 'english', e.target.value)}
                  className="h-7 text-sm flex-1"
                  placeholder="English"
                />
                <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <Input
            value={newHebrew}
            onChange={e => setNewHebrew(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRow()}
            className="h-8 text-sm text-right flex-1"
            dir="rtl"
            placeholder="הוסף פריט..."
          />
          <Input
            value={newEnglish}
            onChange={e => setNewEnglish(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRow()}
            className="h-8 text-sm flex-1"
            placeholder="Add item..."
          />
          <Button size="sm" onClick={addRow} className="h-8 px-2">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}