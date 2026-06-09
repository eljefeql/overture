"use client";

import { useState } from "react";
import { Avatar, Button, Textarea } from "@/components/ui";
import { formatTeamRole, timeAgo } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { PencilSimple, Trash, Check, X } from "@phosphor-icons/react";
import type { TeamNote } from "@/types";

type Props = {
  notes: TeamNote[];
  showId: string;
  actorId: string;
  onPostNote?: (body: string) => Promise<void>;
  onEditNote?: (noteId: string, body: string) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
};

export function TeamNotesFeed({ notes, showId, actorId, onPostNote, onEditNote, onDeleteNote }: Props) {
  const { user, activeRole } = useAuth();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const canPost = activeRole.type === "team";
  const isAuthor = (note: TeamNote) => user?.id === note.authorId;

  const handlePost = async () => {
    if (!draft.trim() || !onPostNote) return;
    setPosting(true);
    await onPostNote(draft.trim());
    setDraft("");
    setPosting(false);
  };

  const startEdit = (note: TeamNote) => {
    setEditingId(note.id);
    setEditDraft(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const submitEdit = async () => {
    if (!editingId || !editDraft.trim() || !onEditNote) return;
    await onEditNote(editingId, editDraft.trim());
    setEditingId(null);
    setEditDraft("");
  };

  const handleDelete = async (noteId: string) => {
    if (!onDeleteNote) return;
    await onDeleteNote(noteId);
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-curtain-700 tracking-wide uppercase mb-3">
        Team Notes
      </h4>

      {notes.length === 0 && (
        <p className="text-sm text-clay-400 italic mb-4">
          No notes yet. Be the first to leave a note.
        </p>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {notes.map((note) => (
          <div key={note.id} className="bg-white rounded-xl border border-cream-200 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Avatar name={note.authorName} size="xs" />
                <span className="text-xs font-semibold text-curtain-900">
                  {note.authorName}
                </span>
                <span className="text-[10px] text-clay-400">
                  {formatTeamRole(note.authorRole)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {note.updatedAt && (
                  <span className="text-[10px] text-clay-300 italic mr-1">edited</span>
                )}
                <span className="text-[10px] text-clay-400">
                  {timeAgo(note.createdAt)}
                </span>
                {isAuthor(note) && canPost && editingId !== note.id && (
                  <>
                    <button
                      onClick={() => startEdit(note)}
                      className="ml-1 p-0.5 text-clay-300 hover:text-stage-500 transition"
                      title="Edit note"
                    >
                      <PencilSimple className="w-3 h-3" weight="bold" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-0.5 text-clay-300 hover:text-ruby-500 transition"
                      title="Delete note"
                    >
                      <Trash className="w-3 h-3" weight="bold" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === note.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cream-200 bg-white focus:outline-none focus:ring-2 focus:ring-stage-300 text-curtain-900 resize-none"
                />
                <div className="flex justify-end gap-1">
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 text-xs text-clay-500 hover:text-curtain-800 transition px-2 py-1 rounded-lg hover:bg-cream-100"
                  >
                    <X className="w-3 h-3" weight="bold" />
                    Cancel
                  </button>
                  <button
                    onClick={submitEdit}
                    disabled={!editDraft.trim()}
                    className="flex items-center gap-1 text-xs text-stage-600 hover:text-stage-700 transition px-2 py-1 rounded-lg hover:bg-stage-50 disabled:opacity-40"
                  >
                    <Check className="w-3 h-3" weight="bold" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-curtain-800 leading-relaxed">
                {note.body}
              </p>
            )}
          </div>
        ))}
      </div>

      {canPost && (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Add a note..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-clay-400">
              Posting as {user?.displayName ?? "Unknown"} (
              {activeRole.type === "team"
                ? formatTeamRole(activeRole.teamRole)
                : ""}
              ) &middot; Visible to production team only
            </span>
            <Button
              size="sm"
              disabled={!draft.trim()}
              loading={posting}
              onClick={handlePost}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
