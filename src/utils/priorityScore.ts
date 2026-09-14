import type { FollowUp, Contact, Lead, PriorityScoreResult, PriorityLevel } from '../types';

/**
 * Transparent Priority Score Engine
 *
 * Ground truth factors:
 * 1. Deal / Invoice Value
 * 2. Days Overdue (since scheduled due date)
 * 3. Days Since Last Contact (silence / stall duration)
 * 4. Pipeline Stage / Follow-Up Type (e.g. invoice, proposal, negotiation)
 * 5. Due Date Proximity (due today, due tomorrow)
 * 6. Follow-up History (number of past attempts without reply)
 *
 * Scoring:
 * >= 70: HIGH PRIORITY
 * 40 - 69: MEDIUM PRIORITY
 * < 40: LOW PRIORITY
 *
 * Transparently discloses each contributing signal and never pretends
 * to predict conversion percentages unless sufficient data exists.
 */
export function calculateTransparentPriorityScore(params: {
  dueDate?: string;
  amount?: number;
  type?: string;
  lastContactedAt?: string;
  createdAt?: string;
  stage?: string;
  attemptsCount?: number;
}): PriorityScoreResult {
  const {
    dueDate,
    amount = 0,
    type = 'general',
    lastContactedAt,
    createdAt,
    stage,
    attemptsCount = 0,
  } = params;

  let score = 20; // Base active consideration points
  const breakdown: string[] = ['Base active item (+20)'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Due date & overdue checks
  if (dueDate) {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      score += 35;
      breakdown.push(`Severely overdue by ${diffDays} days (+35)`);
    } else if (diffDays > 0) {
      score += 25;
      breakdown.push(`Overdue by ${diffDays} day${diffDays > 1 ? 's' : ''} (+25)`);
    } else if (diffDays === 0) {
      score += 25;
      breakdown.push('Due today (+25)');
    } else if (diffDays === -1) {
      score += 15;
      breakdown.push('Due tomorrow (+15)');
    } else if (diffDays >= -3) {
      score += 10;
      breakdown.push('Due this week (+10)');
    }
  }

  // 2. Monetary / Deal Value
  const numAmount = Number(amount) || 0;
  if (numAmount >= 5000) {
    score += 30;
    breakdown.push(`Substantial revenue value ($${numAmount.toLocaleString()}) (+30)`);
  } else if (numAmount >= 1500) {
    score += 20;
    breakdown.push(`High revenue value ($${numAmount.toLocaleString()}) (+20)`);
  } else if (numAmount >= 500) {
    score += 10;
    breakdown.push(`Moderate revenue value ($${numAmount.toLocaleString()}) (+10)`);
  }

  // 3. Follow-Up Type & Stage Priority
  const normType = (type || '').toLowerCase();
  const normStage = (stage || '').toLowerCase();

  if (normType === 'invoice') {
    score += 20;
    breakdown.push('Unpaid invoice recovery (+20)');
  } else if (normType === 'proposal' || normStage === 'proposal' || normStage === 'proposal_sent') {
    score += 15;
    breakdown.push('Active proposal stage (+15)');
  } else if (normStage === 'negotiation') {
    score += 15;
    breakdown.push('High-intent negotiation stage (+15)');
  } else if (normType === 'appointment' || normStage === 'qualified') {
    score += 10;
    breakdown.push('Qualified milestone scheduled (+10)');
  }

  // 4. Silence / Days Since Last Contact
  const referenceDateStr = lastContactedAt || createdAt;
  if (referenceDateStr) {
    try {
      const refDate = new Date(referenceDateStr);
      const daysSilent = Math.round((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSilent >= 14) {
        score += 15;
        breakdown.push(`No touchpoint in ${daysSilent} days (+15)`);
      } else if (daysSilent >= 7) {
        score += 10;
        breakdown.push(`No touchpoint in ${daysSilent} days (+10)`);
      }
    } catch {}
  }

  // 5. Unanswered follow-up attempts
  if (attemptsCount >= 2) {
    score += 10;
    breakdown.push(`Multiple attempts without reply (${attemptsCount}) (+10)`);
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(Math.max(score, 5), 100);

  let level: PriorityLevel = 'LOW PRIORITY';
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';

  if (finalScore >= 70) {
    level = 'HIGH PRIORITY';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
  } else if (finalScore >= 40) {
    level = 'MEDIUM PRIORITY';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
  }

  return {
    score: finalScore,
    level,
    badgeClass,
    breakdown,
  };
}
