import React, { useState, useMemo } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { FollowUpCard } from '../dashboard/FollowUpCard';
import { BulkEmailModal } from './BulkEmailModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  Plus,
  Filter,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Mail,
  Trash2,
  Check,
  X,
  Send,
  Users,
  Briefcase,
} from 'lucide-react';
import type { FollowUp, FollowUpStatus, FollowUpType, FollowUpPriority } from '../../types';

interface FollowUpsViewProps {
  onOpenNewFollowUp: () => void;
  onEditFollowUp: (followUp: FollowUp) => void;
  onDeleteFollowUp: (followUp: FollowUp) => void;
  initialSearchQuery?: string;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  onOpenNewFollowUp,
  onEditFollowUp,
  onDeleteFollowUp,
  initialSearchQuery = '',
}) => {
  const { followUps, loading, bulkDeleteFollowUps, bulkMarkAsPaid, bulkUpdateStatus } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState<string>(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | 'active' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState<FollowUpType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<FollowUpPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'priority' | 'createdAt'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  const filteredAndSortedFollowUps = useMemo(() => {
    let list = [...followUps];

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter((f) => f.status !== 'completed' && f.status !== 'cancelled');
    } else if (statusFilter !== 'all') {
      list = list.filter((f) => f.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter((f) => f.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      list = list.filter((f) => f.priority === priorityFilter);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.contactName?.toLowerCase().includes(q) ||
          f.contactCompany?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          (f.amount && f.amount.toString().includes(q))
      );
    }

    // Sort
    const priorityWeight: Record<FollowUpPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'dueDate') {
        comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
      } else if (sortBy === 'amount') {
        comparison = (a.amount || 0) - (b.amount || 0);
      } else if (sortBy === 'priority') {
        comparison = (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
      } else if (sortBy === 'createdAt') {
        comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [followUps, statusFilter, typeFilter, priorityFilter, search, sortBy, sortOrder]);

  // Selection handlers
  const handleToggleSelect = (item: FollowUp) => {
    setSelectedIds((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    );
  };

  const isAllFilteredSelected =
    filteredAndSortedFollowUps.length > 0 &&
    filteredAndSortedFollowUps.every((f) => selectedIds.includes(f.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredAndSortedFollowUps.map((f) => f.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const currentSet = new Set(selectedIds);
      filteredAndSortedFollowUps.forEach((f) => currentSet.add(f.id));
      setSelectedIds(Array.from(currentSet));
    }
  };

  const selectedItems = useMemo(() => {
    const set = new Set(selectedIds);
    return followUps.filter((f) => set.has(f.id));
  }, [selectedIds, followUps]);

  const selectedInvoicesCount = selectedItems.filter((f) => f.type === 'invoice').length;
  const selectedLeadsCount = selectedItems.filter((f) => f.type === 'lead').length;

  // Bulk Actions
  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkMarkAsPaid(selectedIds);
      success(
        'Marked as Paid',
        `Successfully marked ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} as paid & collected.`
      );
      setSelectedIds([]);
    } catch (err: any) {
      toastError('Failed to mark items as paid');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkDeleteFollowUps(selectedIds);
      success(
        'Deleted Successfully',
        `Removed ${selectedIds.length} follow-up${selectedIds.length > 1 ? 's' : ''}.`
      );
      setSelectedIds([]);
    } catch (err: any) {
      toastError('Failed to delete selected items');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkMarkContacted = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkUpdateStatus(selectedIds, 'contacted');
      success(
        'Status Updated',
        `Marked ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} as contacted.`
      );
      setSelectedIds([]);
    } catch (err: any) {
      toastError('Failed to update status');
    } finally {
      setBulkLoading(false);
    }
  };

  // Counts for quick filter pills
  const invoiceCount = followUps.filter((f) => f.type === 'invoice' && f.status !== 'completed').length;
  const leadCount = followUps.filter((f) => f.type === 'lead' && f.status !== 'completed').length;
  const proposalCount = followUps.filter((f) => f.type === 'proposal' && f.status !== 'completed').length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Management</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            All Follow-Ups
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Filter, search, select multiple leads or invoices, and perform instant bulk actions.
          </p>
        </div>

        <button
          onClick={onOpenNewFollowUp}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Create Follow-Up
        </button>
      </div>

      {/* Quick Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            typeFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>All Follow-Ups</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200">
            {followUps.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('invoice')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            typeFilter === 'invoice'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Invoices Only</span>
          {invoiceCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                typeFilter === 'invoice'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {invoiceCount} unpaid
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('lead')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            typeFilter === 'lead'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Leads Only</span>
          {leadCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                typeFilter === 'lead'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {leadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('proposal')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            typeFilter === 'proposal'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Proposals</span>
          {proposalCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                typeFilter === 'proposal' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {proposalCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, contact, company..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="active">Status: Active (Pending & Snoozed)</option>
              <option value="pending">Status: Pending</option>
              <option value="contacted">Status: Contacted</option>
              <option value="snoozed">Status: Snoozed</option>
              <option value="completed">Status: Completed</option>
              <option value="cancelled">Status: Cancelled</option>
              <option value="all">Status: All</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Type: All Types</option>
              <option value="proposal">Proposals</option>
              <option value="invoice">Invoices</option>
              <option value="lead">Leads</option>
              <option value="appointment">Appointments</option>
              <option value="customer">Customers</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Priority: All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Sort & Select All controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {/* Master Select All Toggle */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 font-semibold text-slate-700 hover:text-blue-600 transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isAllFilteredSelected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : selectedIds.length > 0
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isAllFilteredSelected ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : selectedIds.length > 0 ? (
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-xs" />
                ) : null}
              </div>
              <span>
                {isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredAndSortedFollowUps.length})`}
              </span>
            </button>

            <span className="text-slate-300">|</span>

            <span>Sort:</span>
            <button
              onClick={() => {
                if (sortBy === 'dueDate') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('dueDate');
                  setSortOrder('asc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
                sortBy === 'dueDate'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                  : 'border-slate-200 bg-white'
              }`}
            >
              Due Date {sortBy === 'dueDate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'amount') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('amount');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
                sortBy === 'amount'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                  : 'border-slate-200 bg-white'
              }`}
            >
              Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <span>Showing {filteredAndSortedFollowUps.length} follow-ups</span>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shadow-xs">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">
                {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
                {selectedInvoicesCount > 0 && (
                  <span className="text-emerald-400 font-semibold">
                    {selectedInvoicesCount} invoice{selectedInvoicesCount > 1 ? 's' : ''}
                  </span>
                )}
                {selectedInvoicesCount > 0 && selectedLeadsCount > 0 && <span>•</span>}
                {selectedLeadsCount > 0 && (
                  <span className="text-blue-400 font-semibold">
                    {selectedLeadsCount} lead{selectedLeadsCount > 1 ? 's' : ''}
                  </span>
                )}
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-400 hover:text-white underline font-medium"
                >
                  Clear selection
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mark as Paid button */}
            <button
              type="button"
              onClick={handleBulkMarkPaid}
              disabled={bulkLoading}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Mark selected items / invoices as paid and collected"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Mark as Paid</span>
            </button>

            {/* Send Follow-Up Email button */}
            <button
              type="button"
              onClick={() => setBulkEmailModalOpen(true)}
              disabled={bulkLoading}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Send personalized follow-up emails to selected leads/invoices"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Follow-Up Email</span>
            </button>

            {/* Mark as Contacted */}
            <button
              type="button"
              onClick={handleBulkMarkContacted}
              disabled={bulkLoading}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors hidden sm:flex items-center gap-1"
              title="Mark as contacted today"
            >
              <Check className="w-3.5 h-3.5 text-blue-400" />
              <span>Mark Contacted</span>
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={bulkLoading}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Delete selected items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {/* Dismiss selection */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* List Output */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">Loading follow-ups...</p>
          </div>
        ) : filteredAndSortedFollowUps.length > 0 ? (
          filteredAndSortedFollowUps.map((item) => (
            <FollowUpCard
              key={item.id}
              followUp={item}
              onEdit={onEditFollowUp}
              onDelete={onDeleteFollowUp}
              selectable={true}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))
        ) : (
          <div className="py-14 text-center rounded-2xl bg-white border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No follow-ups match your criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try adjusting your filters or search query, or create a new follow-up.
            </p>
            {followUps.length === 0 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={onOpenNewFollowUp}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create First Follow-Up
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Follow-Up Email Modal */}
      <BulkEmailModal
        isOpen={bulkEmailModalOpen}
        onClose={() => setBulkEmailModalOpen(false)}
        selectedFollowUps={selectedItems}
        onDispatched={() => {
          setSelectedIds([]);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Selected Items?"
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected follow-up${
          selectedIds.length > 1 ? 's' : ''
        }? This action cannot be undone.`}
        confirmText={`Delete ${selectedIds.length} Item${selectedIds.length > 1 ? 's' : ''}`}
        isDestructive={true}
        onConfirm={handleBulkDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
