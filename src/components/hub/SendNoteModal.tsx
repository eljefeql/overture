"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { Modal, Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { sendShowNote, NOTE_MAX_CHARS } from "@/lib/api/hub";
import type { ID } from "@/types";

/**
 * "Send a note" (QC #32) — a short note from a production member to a
 * production TEAM member. Delivers as an in-app notification + email with
 * Reply-To = the sender (migration 026). v1 is team-only; the copy says so.
 */

export type NoteRecipient = {
  userId: ID;
  name: string;
  /** Role label shown under the name, e.g. "Stage Manager". */
  detail?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  recipient: NoteRecipient | null;
  showId: ID;
  showTitle: string | null;
  senderName: string;
  /** Called after a successful send — the parent starts the 30s cooldown. */
  onSent: (recipientId: ID) => void;
};

export function SendNoteModal({
  open,
  onClose,
  recipient,
  showId,
  showTitle,
  senderName,
  onSent,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Fresh form each time — cleared on close (cancel or sent).
  const close = () => {
    setSubject("");
    setMessage("");
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () =>
      sendShowNote({
        showId,
        showTitle,
        recipientId: recipient!.userId,
        senderName,
        subject,
        message,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (!isSupabaseConfigured) {
        toast("success", "Note sent (demo)");
      } else if (result.replyTo) {
        toast("success", `Note sent to ${recipient!.name} — they can reply straight to your email.`);
      } else {
        toast("success", `Note sent to ${recipient!.name}.`);
      }
      onSent(recipient!.userId);
      close();
    },
    onError: (err: Error) => toast("error", err.message),
  });

  const remaining = NOTE_MAX_CHARS - message.length;
  const canSend = message.trim().length > 0 && remaining >= 0 && !mutation.isPending;

  return (
    <Modal
      open={open && !!recipient}
      onClose={close}
      title={recipient ? `Note to ${recipient.name}` : "Send a note"}
    >
      <div className="py-4 flex flex-col gap-4">
        {recipient?.detail && (
          <p className="text-sm text-clay-500 -mt-2">{recipient.detail}</p>
        )}
        <div>
          <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
            Subject <span className="text-clay-400 normal-case font-normal">(optional)</span>
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 120))}
            placeholder='e.g. "Thursday carpool" or "Quick costume question"'
            maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-curtain-700 uppercase tracking-wide">
            Message *
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, NOTE_MAX_CHARS + 50))}
            rows={5}
            placeholder="Keep it short — they'll get it in Overture and by email, and can reply straight to you."
            autoFocus
          />
          <p
            className={`text-[11px] mt-1 text-right ${
              remaining < 0 ? "text-ruby-500 font-medium" : "text-clay-400"
            }`}
          >
            {remaining < 0
              ? `${-remaining} over the ${NOTE_MAX_CHARS}-character limit`
              : `${remaining} characters left`}
          </p>
        </div>
        <p className="text-[11px] text-clay-400 leading-snug">
          Notes go to the production team for now — messaging castmates
          directly is on the roadmap. Your email address is shared as the
          reply-to so they can answer you directly.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSend}
            loading={mutation.isPending}
            icon={<PaperPlaneTilt className="w-4 h-4" weight="bold" />}
          >
            Send note
          </Button>
        </div>
      </div>
    </Modal>
  );
}
