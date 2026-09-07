import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Clock,
  Sparkles,
  Users,
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  Flame,
  Check,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { SequenceBuilderModal } from './SequenceBuilderModal';
import { EnrollContactModal } from './EnrollContactModal';
import { ExecuteSequenceStepModal } from './ExecuteSequenceStepModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getTodayString } from '../../services/db';
import type { Sequence, SequenceEnrollment, Contact } from '../../types';

interface SequencesViewProps {
  onOpenNewContact?: () => void;
}

export const SequencesView: React.FC<SequencesViewProps> = () => {
  const {
    sequences,
    sequenceEnrollments,
    activeEnrollments,
    dueSequenceEnrollments,
    addSequence,
    editSequence,
    removeSequence,
    changeEnrollmentStatus,
    removeEnrollment,
    openExecuteModal,
    contacts,
  } = useFollowUp();

  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'sequences' | 'enrollments'>('sequences');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [sequenceToEdit, setSequenceToEdit] = useState<Sequence | null>(null);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollInitialSequence, setEnrollInitialSequence] = useState<Sequence | null>(null);

  // Confirm delete dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const todayStr = getTodayString();

  // Filter Sequences
  const filteredSequences = sequences.filter((seq) => {
    const matchesSearch =
      seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (seq.description && seq.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (seq.triggerValue && seq.triggerValue.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = selectedCategory === 'all' || seq.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filter Enrollments
  const filteredEnrollments = sequenceEnrollments.filter((enroll) => {
    const matchesSearch =
      enroll.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enroll.sequenceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (enroll.contactCompany && enroll.contactCompany.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const handleCreateNew = () => {
    setSequenceToEdit(null);
    setBuilderModalOpen(true);
  };

  const handleEdit = (seq: Sequence) => {
    setSequenceToEdit(seq);
    setBuilderModalOpen(true);
  };

  const handleDelete = (seq: Sequence) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Sequence?',
      message: `Are you sure you want to delete "${seq.name}"? Active contact enrollments for this sequence will be archived.`,
      onConfirm: async () => {
        try {
          await removeSequence(seq.id);
          success('Sequence deleted.');
        } catch (err: any) {
          toastError('Failed to delete sequence.');
        }
      },
    });
  };

  const handleEnrollForSequence = (seq: Sequence) => {
    setEnrollInitialSequence(seq);
    setEnrollModalOpen(true);
  };

  const handleSaveSequence = async (data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (sequenceToEdit) {
      await editSequence(sequenceToEdit.id, data);
      success('Sequence updated successfully!');
    } else {
      await addSequence(data);
      success('Sequence created successfully!');
    }
  };

  const handleToggleEnrollmentStatus = async (enrollment: SequenceEnrollment) => {
    try {
      const nextStatus = enrollment.status === 'active' ? 'paused' : 'active';
      await changeEnrollmentStatus(enrollment.id, nextStatus);
      success(`Enrollment ${nextStatus === 'active' ? 'resumed' : 'paused'}.`);
    } catch {
      toastError('Failed to update status.');
    }
  };

  const handleDeleteEnrollment = (enrollment: SequenceEnrollment) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Contact from Sequence?',
      message: `Are you sure you want to remove ${enrollment.contactName} from "${enrollment.sequenceName}"?`,
      onConfirm: async () => {
        try {
          await removeEnrollment(enrollment.id);
          success('Contact removed from sequence.');
        } catch {
          toastError('Failed to remove enrollment.');
        }
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Modals */}
      <SequenceBuilderModal
        isOpen={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        onSave={handleSaveSequence}
        sequenceToEdit={sequenceToEdit}
      />

      <EnrollContactModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        initialSequence={enrollInitialSequence}
      />

      <ExecuteSequenceStepModal />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-600" />
            Follow-Up Sequences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Automate structured multi-step outreach across WhatsApp and Email with AI variations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEnrollInitialSequence(null);
              setEnrollModalOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Enroll Contact
          </button>

          <button
            onClick={handleCreateNew}
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Sequence
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Active Sequences
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {sequences.filter((s) => s.isActive).length}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">{sequences.length} total</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Active Enrolled Leads
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600">{activeEnrollments.length}</span>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              In Cadence
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Steps Due Today
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{dueSequenceEnrollments.length}</span>
            {dueSequenceEnrollments.length > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500 fill-amber-500" /> Action Required
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Completed Cadences
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">
              {sequenceEnrollments.filter((e) => e.status === 'completed').length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Won / Finished</span>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('sequences')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'sequences'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Sequence Templates ({sequences.length})
          </button>
          <button
            onClick={() => setActiveTab('enrollments')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'enrollments'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Execution Queue ({activeEnrollments.length})
            {dueSequenceEnrollments.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          {activeTab === 'sequences' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium bg-white outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="proposal">Proposals</option>
              <option value="lead">Leads</option>
              <option value="invoice">Invoices</option>
              <option value="appointment">Appointments</option>
              <option value="customer">Customers</option>
              <option value="nurture">Nurture</option>
            </select>
          )}

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === 'sequences' ? 'Search sequences...' : 'Search enrollments...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: SEQUENCE TEMPLATES */}
      {activeTab === 'sequences' && (
        <div>
          {filteredSequences.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No sequences found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Build your first follow-up sequence with AI assistance to nurture leads consistently.
              </p>
              <button
                onClick={handleCreateNew}
                className="py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700"
              >
                Create New Sequence
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSequences.map((seq) => {
                const enrollmentsForSeq = sequenceEnrollments.filter((e) => e.sequenceId === seq.id);
                const activeCount = enrollmentsForSeq.filter((e) => e.status === 'active').length;

                return (
                  <div
                    key={seq.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                            {seq.category}
                          </span>
                          {seq.triggerValue && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md ml-1.5">
                              Trigger: {seq.triggerValue}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(seq)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Edit Sequence"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(seq)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Sequence"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mb-1">{seq.name}</h3>
                      {seq.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{seq.description}</p>
                      )}

                      {/* Step Timeline Mini Preview */}
                      <div className="py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 mb-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>{seq.steps.length} Steps Sequence</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ~{seq.steps.reduce((acc, s) => acc + s.delayDays, 0)} days total
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          {seq.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex-1 flex items-center">
                              <div
                                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                  step.channel === 'whatsapp'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                                title={`Step ${step.stepNumber}: ${step.title} (${step.channel})`}
                              >
                                {step.stepNumber}
                              </div>
                              {sIdx < seq.steps.length - 1 && (
                                <div className="h-0.5 flex-1 bg-slate-200 mx-1" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        <strong className="text-slate-900">{activeCount}</strong> active contacts
                      </div>

                      <button
                        onClick={() => handleEnrollForSequence(seq)}
                        className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Enroll
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION QUEUE */}
      {activeTab === 'enrollments' && (
        <div>
          {filteredEnrollments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No active enrollments</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Enroll leads or prospects into sequences to start automated reminders and message dispatch.
              </p>
              <button
                onClick={() => setEnrollModalOpen(true)}
                className="py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700"
              >
                Enroll a Contact
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="divide-y divide-slate-100">
                {filteredEnrollments.map((enrollment) => {
                  const isDue = !enrollment.nextStepDueAt || enrollment.nextStepDueAt <= todayStr;
                  const isPaused = enrollment.status === 'paused';
                  const isCompleted = enrollment.status === 'completed';

                  return (
                    <div
                      key={enrollment.id}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        isDue && enrollment.status === 'active'
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Contact & Sequence Info */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-700'
                              : isDue
                              ? 'bg-amber-100 text-amber-700 font-black'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            `${enrollment.currentStepNumber}/${enrollment.totalSteps}`
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {enrollment.contactName}
                            </h4>
                            {enrollment.contactCompany && (
                              <span className="text-xs text-slate-500 font-medium truncate">
                                • {enrollment.contactCompany}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPaused
                                  ? 'bg-slate-200 text-slate-700'
                                  : isDue
                                  ? 'bg-amber-100 text-amber-800 font-black'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isCompleted ? 'Completed' : isPaused ? 'Paused' : isDue ? 'Due Today' : 'Scheduled'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-0.5">
                            Sequence: <strong className="text-slate-700">{enrollment.sequenceName}</strong>
                            {' • '}
                            Current Step:{' '}
                            <span className="text-slate-800 font-medium">
                              Step {enrollment.currentStepNumber} (
                              {enrollment.nextStepTitle || 'Follow-up message'})
                            </span>
                          </p>

                          {/* Next Step Schedule */}
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {enrollment.nextStepDueAt
                                ? `Due: ${enrollment.nextStepDueAt}`
                                : 'Ready to execute'}
                            </span>
                            {enrollment.nextStepChannel && (
                              <span className="flex items-center gap-1 uppercase font-bold text-blue-600">
                                {enrollment.nextStepChannel === 'whatsapp' ? (
                                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Mail className="w-3 h-3 text-blue-600" />
                                )}
                                {enrollment.nextStepChannel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {enrollment.status === 'active' && (
                          <button
                            onClick={() => openExecuteModal(enrollment)}
                            className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Execute Step {enrollment.currentStepNumber}
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleEnrollmentStatus(enrollment)}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200"
                          title={enrollment.status === 'active' ? 'Pause Cadence' : 'Resume Cadence'}
                        >
                          {enrollment.status === 'active' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteEnrollment(enrollment)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200"
                          title="Remove from Sequence"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
