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

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
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

      {/* Modals */}
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
            title: `Discovery Call: ${lead.clientName}`,
            notes: `Lead Source: ${lead.leadSource}\nExpected Value: $${lead.expectedDealValue}`,
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

      {/* Desktop Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenNewFollowUp={() => handleOpenNewFollowUp()}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">
        <Navbar
          currentView={currentView}
          setCurrentView={setCurrentView}
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
              setCurrentView('follow-ups');
              setSearchQuery('invoice');
            }}
          />

          {currentView === 'dashboard' && (
            <DashboardView
              onOpenNewFollowUp={() => handleOpenNewFollowUp()}
              onEditFollowUp={handleEditFollowUp}
              onDeleteFollowUp={handleDeleteFollowUp}
              searchQuery={searchQuery}
            />
          )}

          {currentView === 'follow-ups' && (
            <FollowUpsView
              onOpenNewFollowUp={() => handleOpenNewFollowUp()}
              onEditFollowUp={handleEditFollowUp}
              onDeleteFollowUp={handleDeleteFollowUp}
              initialSearchQuery={searchQuery}
            />
          )}

          {currentView === 'contacts' && (
            <ContactsView
              onOpenNewContact={handleOpenNewContact}
              onEditContact={handleEditContact}
              onDeleteContact={handleDeleteContact}
              onAddFollowUpForContact={(contact) => handleOpenNewFollowUp(contact)}
              initialSearchQuery={searchQuery}
            />
          )}

          {currentView === 'sequences' && (
            <SequencesView onOpenNewContact={handleOpenNewContact} />
          )}

          {currentView === 'templates' && (
            <TemplatesView />
          )}

          {currentView === 'analytics' && (
            <AnalyticsView />
          )}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenNewFollowUp={() => handleOpenNewFollowUp()}
      />
    </div>
  );
};
