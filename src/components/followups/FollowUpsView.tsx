import React, { useState, useMemo } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { FollowUpCard } from '../dashboard/FollowUpCard';
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
  const { followUps, loading } = useFollowUp();

  const [search, setSearch] = useState<string>(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | 'active' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState<FollowUpType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<FollowUpPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'priority' | 'createdAt'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Management</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            All Follow-Ups
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Filter, search, and manage every stage of your follow-up pipeline.
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

        {/* Sort controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
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
                sortBy === 'dueDate' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'border-slate-200 bg-white'
              }`}
            >
              Due Date {sortBy === 'dueDate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'priority') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('priority');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
                sortBy === 'priority' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'border-slate-200 bg-white'
              }`}
            >
              Priority {sortBy === 'priority' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                sortBy === 'amount' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'border-slate-200 bg-white'
              }`}
            >
              Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <span>Showing {filteredAndSortedFollowUps.length} follow-ups</span>
        </div>
      </div>

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
    </div>
  );
};
