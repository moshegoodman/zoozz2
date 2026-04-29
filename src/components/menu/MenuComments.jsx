import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Lock, Loader2, CheckCheck } from 'lucide-react';

const ROLE_COLORS = {
  chef: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  client: 'bg-green-100 text-green-700',
};

export default function MenuComments({ menuId, authorId, authorName, authorRole, showInternal }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadComments(); }, [menuId]);

  const loadComments = async () => {
    setLoading(true);
    const data = await base44.entities.MenuComment.filter({ menu_id: menuId }, 'created_date', 200);
    const visible = data.filter(c => showInternal || !c.is_internal);
    setComments(visible || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    await base44.entities.MenuComment.create({
      menu_id: menuId,
      author_id: authorId,
      author_name: authorName,
      author_role: authorRole,
      comment: newComment.trim(),
      is_internal: isInternal,
    });
    setNewComment('');
    await loadComments();
    setSubmitting(false);
  };

  const toggleResolved = async (comment) => {
    await base44.entities.MenuComment.update(comment.id, { resolved: !comment.resolved });
    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, resolved: !c.resolved } : c));
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
        <MessageCircle className="w-4 h-4" />
        Comments {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
      </h4>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No comments yet.</p>}
          {comments.map(c => (
            <div key={c.id} className={`rounded-lg p-3 text-sm border ${c.resolved ? 'opacity-50' : ''} ${c.is_internal ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs py-0 ${ROLE_COLORS[c.author_role] || 'bg-gray-100 text-gray-600'}`}>{c.author_role}</Badge>
                  <span className="font-medium text-xs text-gray-700">{c.author_name}</span>
                  {c.is_internal && <span className="flex items-center gap-0.5 text-xs text-yellow-700"><Lock className="w-3 h-3" /> Internal</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{new Date(c.created_date).toLocaleDateString()}</span>
                  {showInternal && (
                    <button onClick={() => toggleResolved(c)} className={`text-xs ${c.resolved ? 'text-gray-400' : 'text-green-600 hover:text-green-800'}`} title="Toggle resolved">
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-700">{c.comment}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t pt-3">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          {showInternal && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
              <Lock className="w-3 h-3" /> Internal only (hidden from client)
            </label>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()} className="ml-auto">
            {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Post
          </Button>
        </div>
      </div>
    </div>
  );
}