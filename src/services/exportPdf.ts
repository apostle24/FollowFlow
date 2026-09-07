import { jsPDF } from 'jspdf';
import type { FollowUp, Contact } from '../types';

export interface RevenueReportData {
  reportDate: string;
  dateRangeLabel: string;
  categoryFilterLabel: string;
  totalFollowUps: number;
  completedFollowUps: number;
  overallSuccessRate: number;
  moneyWaiting: number;
  moneyRecovered: number;
  moneyAtRisk: number;
  avgDaysToClose: number;
  categoryBreakdown: { name: string; value: number }[];
  channelBreakdown: { name: string; conversionRate: number }[];
  activeDeals: FollowUp[];
  userEmail?: string;
  userName?: string;
}

export function generateRevenuePdfReport(data: RevenueReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 45;

  // Header Bar
  doc.setFillColor(37, 99, 235); // Blue 600
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Brand & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('FOLLOWFLOW', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('REVENUE FOLLOW-UP & FINANCIAL AUDIT LEDGER', margin + 145, y - 2);

  y += 24;

  // Horizontal Rule
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);

  y += 20;

  // Report Meta Details (2 columns)
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Report Date: ${data.reportDate}`, margin, y);
  doc.text(`Reporting Period: ${data.dateRangeLabel}`, margin, y + 14);
  doc.text(`Category Filter: ${data.categoryFilterLabel}`, margin, y + 28);

  const col2 = pageWidth / 2 + 20;
  doc.text(`Prepared For: ${data.userName || 'FollowFlow Account'}`, col2, y);
  doc.text(`Account: ${data.userEmail || 'Primary Account'}`, col2, y + 14);
  const auditId = `AUD-${Date.now().toString(36).toUpperCase()}`;
  doc.text(`Audit Verification ID: ${auditId}`, col2, y + 28);

  y += 48;

  // Executive Summary Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(margin, y, pageWidth - margin * 2, 70, 6, 6, 'FD');

  const cardWidth = (pageWidth - margin * 2) / 4;

  // Metric 1: Total Potential Revenue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('PIPELINE REVENUE', margin + 14, y + 20);
  doc.setFontSize(15);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text(`$${data.moneyWaiting.toLocaleString()}`, margin + 14, y + 42);

  // Metric 2: Revenue Recovered
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('COLLECTED / RECOVERED', margin + cardWidth + 14, y + 20);
  doc.setFontSize(15);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`$${data.moneyRecovered.toLocaleString()}`, margin + cardWidth + 14, y + 42);

  // Metric 3: Revenue at Risk
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('AT RISK (OVERDUE)', margin + cardWidth * 2 + 14, y + 20);
  doc.setFontSize(15);
  doc.setTextColor(225, 29, 72); // Rose
  doc.text(`$${data.moneyAtRisk.toLocaleString()}`, margin + cardWidth * 2 + 14, y + 42);

  // Metric 4: Success Rate
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SUCCESS / CONVERSION', margin + cardWidth * 3 + 14, y + 20);
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.overallSuccessRate}%`, margin + cardWidth * 3 + 14, y + 42);

  y += 90;

  // Pipeline Category Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Revenue Pipeline by Category', margin, y);
  y += 14;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 20, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DEAL CATEGORY', margin + 8, y + 13);
  doc.text('POTENTIAL REVENUE', pageWidth - margin - 120, y + 13);
  doc.text('% OF TOTAL', pageWidth - margin - 40, y + 13);
  y += 20;

  const totalCatVal = data.categoryBreakdown.reduce((s, c) => s + c.value, 0) || 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  if (data.categoryBreakdown.length === 0) {
    doc.text('No active category distribution recorded', margin + 8, y + 14);
    y += 22;
  } else {
    data.categoryBreakdown.forEach((cat) => {
      const pct = Math.round((cat.value / totalCatVal) * 100);
      doc.text(cat.name, margin + 8, y + 14);
      doc.text(`$${cat.value.toLocaleString()}`, pageWidth - margin - 120, y + 14);
      doc.text(`${pct}%`, pageWidth - margin - 40, y + 14);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 19, pageWidth - margin, y + 19);
      y += 20;
    });
  }

  y += 15;

  // Itemized Active Revenue Deals Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Itemized Deal & Follow-Up Ledger', margin, y);
  y += 14;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 20, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DUE DATE', margin + 8, y + 13);
  doc.text('CONTACT / ENTITY', margin + 80, y + 13);
  doc.text('TITLE / SCOPE', margin + 200, y + 13);
  doc.text('TYPE', margin + 350, y + 13);
  doc.text('STATUS', margin + 410, y + 13);
  doc.text('AMOUNT', pageWidth - margin - 50, y + 13);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const dealsToPrint = data.activeDeals.slice(0, 12); // First 12 deals fit cleanly

  if (dealsToPrint.length === 0) {
    doc.text('No pending deals or follow-ups matching this filter', margin + 8, y + 14);
    y += 20;
  } else {
    dealsToPrint.forEach((deal, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 18, 'F');
      }

      doc.setTextColor(51, 65, 85);
      doc.text(deal.dueDate || 'N/A', margin + 8, y + 12);

      const contactName = deal.contactName.length > 18 ? deal.contactName.slice(0, 16) + '..' : deal.contactName;
      doc.text(contactName, margin + 80, y + 12);

      const dealTitle = deal.title.length > 26 ? deal.title.slice(0, 24) + '..' : deal.title;
      doc.text(dealTitle, margin + 200, y + 12);

      doc.text(deal.type.toUpperCase(), margin + 350, y + 12);

      // Status color
      if (deal.status === 'completed') {
        doc.setTextColor(16, 185, 129);
      } else if (deal.dueDate < new Date().toISOString().split('T')[0]) {
        doc.setTextColor(225, 29, 72);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(deal.status.toUpperCase(), margin + 410, y + 12);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      const amtStr = deal.amount ? `$${deal.amount.toLocaleString()}` : '$0';
      doc.text(amtStr, pageWidth - margin - 50, y + 12);
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 18, pageWidth - margin, y + 18);
      y += 18;
    });
  }

  // Footer & Audit Signature Block
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'CONFIDENTIAL & PROPRIETARY — Generated by FollowFlow Financial Engine. Certified for Internal Record-Keeping.',
    margin,
    footerY
  );
  doc.text(`Page 1 of 1`, pageWidth - margin - 45, footerY);

  // Save the PDF
  const filename = `FollowFlow_Revenue_Report_${data.reportDate.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
