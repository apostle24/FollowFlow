import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MobileNav } from './MobileNav';
import { DashboardView } from '../dashboard/DashboardView';
import { ExecutiveStatsBar } from '../dashboard/ExecutiveStatsBar';
import { FollowUpsView } from '../followups/FollowUpsView';
import { ContactsView } from '../contacts/ContactsView';
import { SequencesView } from '../sequences/SequencesView';
import { TemplatesView } from '../templates/TemplatesView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { SettingsView } from '../settings/SettingsView';
import { FollowUpModal } from '../followups/FollowUpModal';
import { ContactModal } from '../contacts/ContactModal';
import { LeadEntryModal } from '../leads/LeadEntryModal';
import { AppointmentModal } from '../appointments/AppointmentModal';
import { AiMessageGeneratorModal } from '../ai/AiMessageGeneratorModal';
import { BillingModal } from '../billing/BillingModal';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { FlowAssistantChat } from '../chat/FlowAssistantChat';
import { RapidFollowUpSessionModal } from '../session/RapidFollowUpSessionModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useToast } from '../common/Toast';
import type { AppView, FollowUp, Contact } from '../../types';

export const AppLayout: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    deleteFollowUp,
    deleteContact,
    leadModalOpen,
    initialLeadForModal,
    openLeadModal,
    closeLeadModal,
    appointmentModalOpen,
    initialAppointmentForModal,
    initialContactForAppointment,
    openAppointmentModal,
    closeAppointmentModal,
  } = useFollowUp();
  const { success, error: toastError } = useToast();

  const getInitialView = (): AppView => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = window.location.hash.replace('#', '').split('?')[0].toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const viewParam = (params.get('view') || hash).toLowerCase();
    const validViews: AppView[] = ['dashboard', 'follow-ups', 'contacts', 'sequences', 'templates', 'analytics', 'settings'];
    if (validViews.includes(viewParam as AppView)) {
      return viewParam as AppView;
    }
    if (params.get('templateId') || params.get('template') || window.location.hash.includes('template')) {
      return 'templates';
    }
    return 'dashboard';
  };

  const [currentView, setCurrentView] = useState<AppView>(getInitialView);

  // Synchronize view state with window navigation so direct links and new windows render properly
  React.useEffect(() => {
    const handleUrlChange = () => {
      const resolved = getInitialView();
      setCurrentView((prev) => (prev !== resolved ? resolved : prev));
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleSelectView = (view: AppView) => {
    setCurrentView(view);
    try {
      if (typeof window !== 'undefined') {
        window.location.hash = `#${view}`;
      }
    } catch {}
  };
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Follow-up modal state
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpToEdit, setFollowUpToEdit] = useState<FollowUp | null>(null);
  const [initialContactForFollowUp, setInitialContactForFollowUp] = useState<Contact | null>(null);

  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  // Confirm delete dialog state
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

  // Action handlers
  const handleOpenNewFollowUp = (initialContact?: Contact) => {
    setFollowUpToEdit(null);
    setInitialContactForFollowUp(initialContact || null);
    setFollowUpModalOpen(true);
  };

  const handleEditFollowUp = (followUp: FollowUp) => {
    setFollowUpToEdit(followUp);
    setInitialContactForFollowUp(null);
    setFollowUpModalOpen(true);
  };

  const handleDeleteFollowUp = (followUp: FollowUp) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Follow-Up?',
      message: `Are you sure you want to delete "${followUp.title}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteFollowUp(followUp.id);
          success('Follow-up deleted');
        } catch (err: any) {
          toastError('Failed to delete follow-up');
        }
      },
    });
  };

  const handleOpenNewContact = () => {
    setContactToEdit(null);
    setContactModalOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setContactToEdit(contact);
    setContactModalOpen(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Contact?',
      message: `Are you sure you want to delete ${contact.name}? Any active follow-ups for this contact will remain.`,
      onConfirm: async () => {
        try {
          await deleteContact(contact.id);
          success('Contact deleted');
        } catch (err: any) {
          toastError('Failed to delete contact');
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Onboarding Wizard (shown if user hasn't completed onboarding) */}
      {userProfile && !userProfile.onboardingCompleted && <OnboardingModal />}

      {/* Modals Container protected by ErrorBoundary */}
      <ErrorBoundary viewName="Application Modals">
        <FollowUpModal
          isOpen={followUpModalOpen}
          onClose={() => setFollowUpModalOpen(false)}
          followUpToEdit={followUpToEdit}
          initialContact={initialContactForFollowUp}
        />

        <ContactModal
          isOpen={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
          contactToEdit={contactToEdit}
        />

        {/* Lead Entry Form Modal */}
        <LeadEntryModal
          isOpen={leadModalOpen}
          onClose={closeLeadModal}
          initialLead={initialLeadForModal}
          onScheduleAppointment={(lead) => {
            openAppointmentModal({
              title: `Discovery Call: ${lead.name || 'New Lead'}`,
              notes: `Lead Source: ${lead.leadSource || 'Direct'}\nExpected Value: $${lead.expectedDealValue ?? 0}`,
            });
          }}
        />

        {/* Appointment Scheduling Modal */}
        <AppointmentModal
          isOpen={appointmentModalOpen}
          onClose={closeAppointmentModal}
          initialAppointment={initialAppointmentForModal}
          initialContact={initialContactForAppointment}
        />

        <AiMessageGeneratorModal />
        <BillingModal />
        <RapidFollowUpSessionModal />
        <FlowAssistantChat />

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      </ErrorBoundary>

      {/* Desktop Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={handleSelectView}
        onOpenNewFollowUp={() => handleOpenNewFollowUp()}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">
        <Navbar
          currentView={currentView}
          setCurrentView={handleSelectView}
          onOpenNewFollowUp={() => handleOpenNewFollowUp()}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Executive Stats & Action Bar (Dashboard Component) */}
          <ExecutiveStatsBar
            onOpenNewLead={() => openLeadModal()}
            onOpenNewAppointment={() => openAppointmentModal()}
            onFilterInvoices={() => {
              handleSelectView('follow-ups');
              setSearchQuery('invoice');
            }}
          />

          {currentView === 'dashboard' && (
            <ErrorBoundary viewName="Dashboard View" onReset={() => handleSelectView('dashboard')}>
              <DashboardView
                onOpenNewFollowUp={() => handleOpenNewFollowUp()}
                onEditFollowUp={handleEditFollowUp}
                onDeleteFollowUp={handleDeleteFollowUp}
                searchQuery={searchQuery}
              />
            </ErrorBoundary>
          )}

          {currentView === 'follow-ups' && (
            <ErrorBoundary viewName="Follow-Ups View" onReset={() => handleSelectView('dashboard')}>
              <FollowUpsView
                onOpenNewFollowUp={() => handleOpenNewFollowUp()}
                onEditFollowUp={handleEditFollowUp}
                onDeleteFollowUp={handleDeleteFollowUp}
                initialSearchQuery={searchQuery}
              />
            </ErrorBoundary>
          )}

          {currentView === 'contacts' && (
            <ErrorBoundary viewName="Contacts View" onReset={() => handleSelectView('dashboard')}>
              <ContactsView
                onOpenNewContact={handleOpenNewContact}
                onEditContact={handleEditContact}
                onDeleteContact={handleDeleteContact}
                onAddFollowUpForContact={(contact) => handleOpenNewFollowUp(contact)}
                initialSearchQuery={searchQuery}
              />
            </ErrorBoundary>
          )}

          {currentView === 'sequences' && (
            <ErrorBoundary viewName="Sequences View" onReset={() => handleSelectView('dashboard')}>
              <SequencesView onOpenNewContact={handleOpenNewContact} />
            </ErrorBoundary>
          )}

          {currentView === 'templates' && (
            <ErrorBoundary viewName="Templates View" onReset={() => handleSelectView('dashboard')}>
              <TemplatesView />
            </ErrorBoundary>
          )}

          {currentView === 'analytics' && (
            <ErrorBoundary viewName="Analytics View" onReset={() => handleSelectView('dashboard')}>
              <AnalyticsView />
            </ErrorBoundary>
          )}

          {currentView === 'settings' && (
            <ErrorBoundary viewName="Settings View" onReset={() => handleSelectView('dashboard')}>
              <SettingsView />
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentView={currentView}
        setCurrentView={handleSelectView}
        onOpenNewFollowUp={() => handleOpenNewFollowUp()}
      />
    </div>
  );
};
