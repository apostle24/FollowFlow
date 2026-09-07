import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowRight,
  CheckCircle2,
  Calendar,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Flame,
  Check,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { sendFlowChatMessage } from '../../services/ai';
import { ConfirmationModal } from './ConfirmationModal';
import type { ChatMessage, ProposedAction } from '../../types';

export const FlowAssistantChat: React.FC = () => {
  const { user, isPro } = useAuth();
  const {
    flowChatOpen,
    closeFlowChat,
    contacts,
    todayFollowUps,
    overdueFollowUps,
    activeFollowUps,
    stats,
    addContact,
    addFollowUp,
    markCompleted,
    snooze,
    openUpgradeModal,
  } = useFollowUp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm **Flow**, your Daily Revenue Follow-Up Assistant. I can tell you exactly who to contact today, find overdue revenue, or draft ready-to-send messages. How can I help you right now?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);
  const [confirmModalData, setConfirmModalData] = useState<{ msgId: string; action: ProposedAction } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (flowChatOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [flowChatOpen, messages]);

  if (!flowChatOpen) return null;

  const quickPrompts = [
    'What are my top 3 priority actions right now?',
    'Who do I need to follow up with today?',
    'What deals or proposals are overdue?',
    'Who owes me money on invoices?',
    'Draft a message for my highest priority lead',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    // Check free limit if applicable
    if (!isPro && messages.filter((m) => m.role === 'user').length >= 10) {
      openUpgradeModal('Unlock unlimited Flow AI conversations and automated revenue actions with Pro.');
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await sendFlowChatMessage({
        messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        userId: user?.uid || 'guest',
        contextData: {
          contacts,
          todayFollowUps,
          overdueFollowUps,
          activeFollowUps,
          moneyAtRisk: stats.moneyAtRisk,
          outstandingInvoices: stats.outstandingInvoices,
          totalFollowUpValue: stats.totalFollowUpValue,
        },
      });

      if (response.message) {
        setMessages((prev) => [...prev, response.message as ChatMessage]);
      }
    } catch (err: any) {
      console.error('Flow chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            "I ran into a temporary issue connecting to the AI brain. However, looking at your dashboard, you have **" +
            todayFollowUps.length +
            ' follow-ups due today** and **' +
            overdueFollowUps.length +
            ' overdue items**.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: ProposedAction) => {
    setActionProcessing(action.id);
    try {
      if (action.type === 'create_followup') {
        const p = action.payload || {};
        const contactName = p.contactName || 'New Contact';
        const matchedContact = contacts.find(
          (c) => c.name.toLowerCase() === contactName.toLowerCase()
        );

        let contactId = matchedContact?.id;
        if (!contactId) {
          try {
            contactId = await addContact({
              name: contactName,
              company: p.company || '',
              email: p.email || '',
              tags: ['AI Added'],
            });
          } catch (cErr) {
            contactId = contacts[0]?.id || 'direct';
          }
        }

        // Calculate tomorrow if dueDate says tomorrow or relative day
        let dueDate = p.dueDate;
        if (!dueDate || dueDate.toLowerCase() === 'tomorrow') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          dueDate = d.toISOString().split('T')[0];
        }

        await addFollowUp({
          contactId,
          contactName: p.contactName || matchedContact?.name || contactName,
          contactCompany: p.company || matchedContact?.company,
          title: p.title || action.title || `Follow up with ${contactName}`,
          description: p.description || '',
          amount: p.amount ? Number(p.amount) : undefined,
          currency: p.currency || '$',
          type: p.type || 'general',
          priority: p.priority || 'medium',
          status: 'pending',
          dueDate,
          channel: p.channel || 'email',
        });
      } else if (action.type === 'complete_followup') {
        const targetId =
          action.payload?.followUpId ||
          action.payload?.id ||
          (action.payload?.contactName
            ? activeFollowUps.find((f) =>
                f.contactName.toLowerCase().includes(action.payload.contactName.toLowerCase())
              )?.id
            : activeFollowUps[0]?.id);
        if (targetId) {
          await markCompleted(targetId);
        } else {
          throw new Error('No active follow-up found to complete.');
        }
      } else if (action.type === 'snooze_followup') {
        const targetId =
          action.payload?.followUpId ||
          action.payload?.id ||
          (action.payload?.contactName
            ? activeFollowUps.find((f) =>
                f.contactName.toLowerCase().includes(action.payload.contactName.toLowerCase())
              )?.id
            : activeFollowUps[0]?.id);
        const days = Number(action.payload?.days || 3);
        if (targetId) {
          await snooze(targetId, days);
        } else {
          throw new Error('No active follow-up found to snooze.');
        }
      }

      // Update message action status
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.pendingAction) {
            return {
              ...m,
              pendingAction: { ...m.pendingAction, status: 'executed' },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      console.error('Failed to execute Flow action:', err);
      alert(err.message || 'Could not execute action.');
    } finally {
      setActionProcessing(null);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.pendingAction) {
          return {
            ...m,
            pendingAction: { ...m.pendingAction, status: 'cancelled' },
          };
        }
        return m;
      })
    );
  };

  return (
    <div
      id="flow-assistant-panel"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Flow</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Revenue Assistant
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Live context: ${stats.totalFollowUpValue.toLocaleString()} active value
            </p>
          </div>
        </div>
        <button
          id="close-flow-chat-btn"
          onClick={closeFlowChat}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label="Close Assistant"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex-shrink-0 flex items-center justify-center border border-amber-500/20 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-[85%] space-y-2`}>
              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-600 text-white rounded-br-none'
                    : 'bg-stone-100 dark:bg-stone-800/90 text-stone-800 dark:text-stone-200 rounded-bl-none border border-stone-200/60 dark:border-stone-700/60'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">
                  {msg.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line.startsWith('**') && line.endsWith('**') ? (
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {line.replace(/\*\*/g, '')}
                        </span>
                      ) : (
                        line
                      )}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Proposed Action Confirmation Card */}
              {msg.pendingAction && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>Action Proposed: {msg.pendingAction.title}</span>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300">
                    {msg.pendingAction.summary}
                  </p>

                  {msg.pendingAction.status === 'pending' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setConfirmModalData({ msgId: msg.id, action: msg.pendingAction! })}
                        disabled={actionProcessing === msg.pendingAction.id}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {actionProcessing === msg.pendingAction.id ? (
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Review & Approve
                      </button>
                      <button
                        onClick={() => handleCancelAction(msg.id)}
                        disabled={actionProcessing === msg.pendingAction.id}
                        className="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : msg.pendingAction.status === 'executed' ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Action completed successfully</span>
                    </div>
                  ) : (
                    <div className="text-stone-400 dark:text-stone-500 italic pt-1">
                      Action cancelled
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 flex-shrink-0 flex items-center justify-center mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Flow is analyzing your follow-ups...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Suggestion Chips */}
      {messages.length < 5 && (
        <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/50">
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">
            Suggested Prompts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(p)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300 border border-stone-200 dark:border-stone-700 transition-colors text-left"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
      >
        <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-2 border border-stone-200/80 dark:border-stone-700/80 focus-within:border-amber-500 dark:focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
          <input
            ref={inputRef}
            type="text"
            id="flow-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Flow who to follow up with or what to say..."
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
          />
          <button
            type="submit"
            id="flow-chat-send-btn"
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:hover:bg-amber-600 transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-stone-400 dark:text-stone-500 mt-1.5">
          Flow is grounded exclusively in your real FollowFlow contacts and revenue items.
        </p>
      </form>

      {/* Explicit Database Action Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(confirmModalData)}
        onClose={() => setConfirmModalData(null)}
        action={confirmModalData?.action || null}
        processing={actionProcessing === confirmModalData?.action.id}
        onConfirm={async () => {
          if (!confirmModalData) return;
          const { msgId, action } = confirmModalData;
          await handleConfirmAction(msgId, action);
          setConfirmModalData(null);
        }}
      />
    </div>
  );
};
