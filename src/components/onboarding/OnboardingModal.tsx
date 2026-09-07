import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { Sparkles, Check, ArrowRight, UserPlus, CalendarPlus, Briefcase, Target, X } from 'lucide-react';
import type { ContactTag, FollowUpType } from '../../types';

export const OnboardingModal: React.FC = () => {
  const { userProfile, completeOnboarding } = useAuth();
  const { addContact, addFollowUp } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [step, setStep] = useState<number>(1);
  const [profession, setProfession] = useState<string>('Freelancer');
  const [focus, setFocus] = useState<string[]>(['Proposals', 'Invoices']);

  // Step 3: First Contact
  const [contactName, setContactName] = useState<string>('');
  const [contactCompany, setContactCompany] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [createdContactId, setCreatedContactId] = useState<string>('');

  // Step 4: First Follow-up
  const [followUpTitle, setFollowUpTitle] = useState<string>('');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('proposal');
  const [followUpAmount, setFollowUpAmount] = useState<string>('');
  const [followUpDueDate, setFollowUpDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState<boolean>(false);

  if (!userProfile || userProfile.onboardingCompleted) {
    return null;
  }

  const professionOptions = [
    { id: 'Freelancer', label: 'Freelancer', desc: 'Designers, Developers, Writers, Creators' },
    { id: 'Agency', label: 'Agency', desc: 'Marketing, Creative, Development agencies' },
    { id: 'Consultant', label: 'Consultant', desc: 'Business, Strategy, Financial advisors' },
    { id: 'Coach', label: 'Coach', desc: 'Executive, Fitness, Career coaches' },
    { id: 'Real Estate', label: 'Real Estate', desc: 'Agents, Brokers, Property managers' },
    { id: 'Service Business', label: 'Service Business', desc: 'Contractors, Trades, Professional services' },
    { id: 'Other', label: 'Other', desc: 'Independent professional or business owner' },
  ];

  const focusOptions = [
    { id: 'Proposals', label: 'Proposals', desc: 'Quotes & estimates waiting for approval' },
    { id: 'Invoices', label: 'Invoices', desc: 'Unpaid bills & past-due payments' },
    { id: 'Leads', label: 'Leads', desc: 'Inquiries & potential new clients' },
    { id: 'Appointments', label: 'Appointments', desc: 'Consultations & upcoming calls' },
    { id: 'Customers', label: 'Existing Customers', desc: 'Check-ins, renewals & upsells' },
  ];

  const toggleFocus = (item: string) => {
    setFocus((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSkip = async () => {
    try {
      await completeOnboarding(profession || 'Freelancer', focus);
      success('Welcome aboard!', 'You can now start managing follow-ups on your dashboard.');
    } catch (err) {
      toastError('Failed to complete onboarding');
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    setLoading(true);
    try {
      const tags: ContactTag[] = ['Client', 'Proposal'];
      const id = await addContact({
        name: contactName.trim(),
        company: contactCompany.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
        whatsapp: contactPhone.trim(),
        notes: 'Added during onboarding setup.',
        tags,
      });
      setCreatedContactId(id);
      setFollowUpTitle(`Follow up with ${contactName} on proposal`);
      setStep(4);
    } catch (err: any) {
      toastError(err.message || 'Error creating contact');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (createdContactId) {
        await addFollowUp({
          contactId: createdContactId,
          contactName: contactName || 'Client',
          contactCompany: contactCompany,
          contactEmail: contactEmail,
          contactPhone: contactPhone,
          contactWhatsapp: contactPhone,
          title: followUpTitle || 'Follow up on project',
          type: followUpType,
          amount: followUpAmount ? parseFloat(followUpAmount) : undefined,
          currency: '$',
          dueDate: followUpDueDate,
          priority: 'high',
          priorityAutoCalculated: true,
          channel: 'whatsapp',
          status: 'pending',
          notes: 'Created during onboarding.',
        });
      }

      await completeOnboarding(profession, focus);
      success('Setup completed!', 'Your first follow-up is ready on your dashboard.');
    } catch (err: any) {
      toastError(err.message || 'Error creating follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-7 sm:p-9 text-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Step {step} of 4</span>
              <h2 className="text-lg font-bold text-slate-900">Let’s set up FollowFlow</h2>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Step 1: Profession */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">What best describes your work?</h3>
              <p className="text-sm text-slate-600 mt-1">
                We'll tailor follow-up prompts and suggested message tones to your business.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {professionOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProfession(opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    profession === opt.id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-sm text-slate-900">{opt.label}</span>
                  <span className="text-xs text-slate-500 mt-1 leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all"
            >
              Continue to Step 2
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Focus */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">What do you usually need to follow up about?</h3>
              <p className="text-sm text-slate-600 mt-1">Select all that apply to your typical revenue cycles.</p>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {focusOptions.map((opt) => {
                const selected = focus.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFocus(opt.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      selected
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                        selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={focus.length === 0}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                Continue to Add First Contact
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Add First Contact */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Add your first contact</h3>
              <p className="text-sm text-slate-600 mt-1">
                Who is one client, prospect, or customer you need to reach out to?
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Company / Organization (Optional)
                </label>
                <input
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                  placeholder="Company or organization"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !contactName.trim()}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {loading ? 'Saving Contact...' : 'Save Contact & Add Follow-Up'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Create First Follow-up */}
        {step === 4 && (
          <form onSubmit={handleStep4Submit} className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Create your first follow-up</h3>
              <p className="text-sm text-slate-600 mt-1">
                What is the specific action or proposal you need to follow up with <strong>{contactName}</strong> about?
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Follow-Up Goal / Title *
                </label>
                <input
                  type="text"
                  required
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  placeholder="e.g. Check in on branding proposal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Type
                  </label>
                  <select
                    value={followUpType}
                    onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="proposal">Proposal</option>
                    <option value="invoice">Invoice</option>
                    <option value="lead">Lead / Prospect</option>
                    <option value="appointment">Appointment</option>
                    <option value="customer">Customer</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={followUpAmount}
                    onChange={(e) => setFollowUpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={followUpDueDate}
                    onChange={(e) => setFollowUpDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {loading ? 'Launching Dashboard...' : 'Finish Setup & Go to Dashboard'}
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
