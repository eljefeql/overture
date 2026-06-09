"use client";

import { useState } from "react";
import { Modal, Button, Pill, Card } from "@/components/ui";
import {
  ConflictDatePicker,
  type ConflictDate,
} from "./ConflictDatePicker";
import {
  WarningCircle,
  HandWaving,
  Wrench,
  CheckSquare,
  Clock,
  Users,
} from "@phosphor-icons/react";
import type { ShowRole, AuditionGroup } from "@/types";

type SlotAvailability = { groupId: string; taken: number };

type Props = {
  open: boolean;
  onClose: () => void;
  roles: ShowRole[];
  groups: AuditionGroup[];
  slotAvailability: SlotAvailability[];
  showTitle: string;
  orgName: string;
  rehearsalStart?: string;
  showClose?: string;
  onSubmit: (data: SignupFormData) => void;
  isSubmitting?: boolean;
};

export type SignupFormData = {
  groupId: string;
  rolesInterested: string[];
  openToOther: boolean;
  willCrew: boolean;
  conflicts: ConflictDate[];
  isMember: boolean | null;
  mailingList: boolean;
  referralSource: string;
  mediaConsent: boolean;
  commitmentAcknowledged: boolean;
};

function formatSlotTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSlotDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function AuditionSignupModal({
  open,
  onClose,
  roles,
  groups,
  slotAvailability,
  showTitle,
  orgName,
  rehearsalStart,
  showClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [openToOther, setOpenToOther] = useState(false);
  const [willCrew, setWillCrew] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictDate[]>([]);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [mailingList, setMailingList] = useState(false);
  const [referralSource, setReferralSource] = useState("");
  const [mediaConsent, setMediaConsent] = useState(false);
  const [commitmentAck, setCommitmentAck] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const canSubmit =
    selectedGroup !== "" &&
    selectedRoles.length > 0 &&
    commitmentAck;

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSubmit = () => {
    setHasAttemptedSubmit(true);
    if (!canSubmit) return;
    onSubmit({
      groupId: selectedGroup,
      rolesInterested: selectedRoles,
      openToOther,
      willCrew,
      conflicts,
      isMember,
      mailingList,
      referralSource,
      mediaConsent,
      commitmentAcknowledged: commitmentAck,
    });
  };

  // Group slots by date for display
  const slotsByDate = groups.reduce<Record<string, AuditionGroup[]>>(
    (acc, group) => {
      const dateKey = formatSlotDate(group.startTime);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(group);
      return acc;
    },
    {}
  );

  const getAvailability = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const slot = slotAvailability.find((s) => s.groupId === groupId);
    if (!group || !slot) return { remaining: 0, total: 0, full: true };
    const remaining = group.slotCount - slot.taken;
    return { remaining, total: group.slotCount, full: remaining <= 0 };
  };

  return (
    <Modal open={open} onClose={onClose} title={`Sign Up — ${showTitle}`}>
      <div className="space-y-6">
        {/* SECTION 1: Time Slot Selection */}
        <div>
          <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-1">
            Choose your audition time
          </label>
          <p className="text-xs text-clay-400 mb-4">
            Select a time slot that works for you.
          </p>

          <div className="space-y-4">
            {Object.entries(slotsByDate).map(([dateLabel, dateGroups]) => (
              <div key={dateLabel}>
                <p className="text-xs font-semibold text-curtain-600 mb-2">
                  {dateLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {dateGroups.map((group) => {
                    const { remaining, full } = getAvailability(group.id);
                    const isSelected = selectedGroup === group.id;
                    return (
                      <button
                        key={group.id}
                        disabled={full}
                        onClick={() => setSelectedGroup(group.id)}
                        className={`relative flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 text-sm transition ${
                          full
                            ? "bg-cream-100 border-cream-200 text-clay-300 cursor-not-allowed"
                            : isSelected
                              ? "bg-curtain-700 border-curtain-700 text-white"
                              : "bg-white border-cream-300 text-curtain-900 hover:border-curtain-400"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Clock className="w-4 h-4" weight={isSelected ? "fill" : "bold"} />
                          {formatSlotTime(group.startTime)}
                        </span>
                        <span className={`flex items-center gap-1 text-[11px] ${
                          full
                            ? "text-clay-300"
                            : isSelected
                              ? "text-curtain-200"
                              : remaining <= 2
                                ? "text-ruby-500"
                                : "text-clay-400"
                        }`}>
                          <Users className="w-3 h-3" weight="bold" />
                          {full
                            ? "Full"
                            : remaining <= 2
                              ? `${remaining} left`
                              : `${remaining} spots`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasAttemptedSubmit && groups.length > 0 && !selectedGroup && (
            <p className="text-xs text-ruby-500 mt-3 flex items-center gap-1">
              <WarningCircle className="w-3.5 h-3.5" weight="bold" />
              Please select a time slot
            </p>
          )}
        </div>

        <hr className="gold-line" />

        {/* SECTION 2: Role Selection */}
        <div>
          <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
            Which roles interest you?
          </label>
          <p className="text-xs text-clay-400 mb-3">
            Select all that apply.
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Pill
                key={role.id}
                variant="role"
                active={selectedRoles.includes(role.id)}
                onClick={() => toggleRole(role.id)}
              >
                {role.name}
              </Pill>
            ))}
          </div>
          {hasAttemptedSubmit && selectedRoles.length === 0 && (
            <p className="text-xs text-ruby-500 mt-2 flex items-center gap-1">
              <WarningCircle className="w-3.5 h-3.5" weight="bold" />
              Select at least one role to continue
            </p>
          )}
        </div>

        {/* SECTION 3: Preferences */}
        <div className="space-y-3">
          <Checkbox
            checked={openToOther}
            onChange={setOpenToOther}
            icon={<HandWaving className="w-3.5 h-3.5 text-curtain-900" weight="bold" />}
            label="Open to other roles"
            description="Consider me for any role, not just the ones I selected"
          />
          <Checkbox
            checked={willCrew}
            onChange={setWillCrew}
            icon={<Wrench className="w-3.5 h-3.5 text-curtain-900" weight="bold" />}
            label="Willing to volunteer for crew"
            description="If not cast, I'd like to help behind the scenes"
          />
        </div>

        <hr className="gold-line" />

        {/* SECTION 4: Conflict dates */}
        <ConflictDatePicker
          conflicts={conflicts}
          onChange={setConflicts}
          minDate={rehearsalStart}
          maxDate={showClose}
        />

        <hr className="gold-line" />

        {/* SECTION 5: Theatre questions */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
              Are you a member of {orgName}?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsMember(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                  isMember === true
                    ? "bg-curtain-700 text-white border-curtain-700"
                    : "bg-white text-clay-600 border-cream-300 hover:border-curtain-300"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setIsMember(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                  isMember === false
                    ? "bg-curtain-700 text-white border-curtain-700"
                    : "bg-white text-clay-600 border-cream-300 hover:border-curtain-300"
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
              How did you hear about these auditions?
            </label>
            <select
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300 bg-cream-50 focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 outline-none appearance-none"
            >
              <option value="">Select one...</option>
              <option value="website">Theatre website</option>
              <option value="social_media">Social media</option>
              <option value="friend">Word of mouth / friend</option>
              <option value="overture">Found it on Overture</option>
              <option value="email">Email / newsletter</option>
              <option value="flyer">Flyer / poster</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Checkbox
            checked={mailingList}
            onChange={setMailingList}
            label={`Add me to ${orgName}'s mailing list`}
            description="Receive updates about future shows and events"
          />
        </div>

        <hr className="gold-line" />

        {/* SECTION 6: Required acknowledgments */}
        <div>
          <h4 className="text-xs font-semibold text-curtain-700 tracking-wide mb-3">
            Required Acknowledgment
          </h4>

          <Card variant="sunken" padding="compact" className="mb-3">
            <Checkbox
              checked={commitmentAck}
              onChange={setCommitmentAck}
              icon={<CheckSquare className="w-3.5 h-3.5 text-curtain-900" weight="bold" />}
              label="I understand the commitment"
              description="If cast, I commit to attending all scheduled rehearsals, tech week, and performances. I have reviewed the show dates and listed any conflicts above."
            />
          </Card>

          <h4 className="text-xs font-semibold text-curtain-700 tracking-wide mb-3 mt-4">
            Optional
          </h4>

          <Card variant="sunken" padding="compact">
            <Checkbox
              checked={mediaConsent}
              onChange={setMediaConsent}
              icon={<CheckSquare className="w-3.5 h-3.5 text-curtain-900" weight="bold" />}
              label="Media consent"
              description={`I consent to being photographed and/or recorded during auditions, rehearsals, and performances for promotional use by ${orgName}.`}
            />
          </Card>
        </div>

        {/* Submit */}
        <div className="pt-2 pb-4 md:pb-0">
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={hasAttemptedSubmit && !canSubmit}
          >
            Confirm Sign Up
          </Button>
          {hasAttemptedSubmit && !canSubmit && (
            <p className="text-xs text-ruby-500 mt-2 text-center">
              {!selectedGroup
                ? "Please select a time slot"
                : selectedRoles.length === 0
                  ? "Please select at least one role"
                  : "Please complete the required acknowledgments above"}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Reusable checkbox with our design system
   ============================================================ */

function Checkbox({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className="flex items-start gap-3 cursor-pointer group"
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition ${
          checked
            ? "bg-stage-500 border-stage-500"
            : "border-cream-300 bg-white group-hover:border-curtain-300"
        }`}
      >
        {checked && icon}
        {checked && !icon && (
          <svg className="w-3 h-3 text-curtain-900" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <span className="text-sm font-medium text-curtain-900">{label}</span>
        {description && (
          <p className="text-xs text-clay-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
