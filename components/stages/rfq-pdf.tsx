import React from 'react';
import { Document, Page, View, Image, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  
  // Header Card
  headerCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandLeft: {
    flexDirection: 'column',
    maxWidth: '58%',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0284c7',
  },
  companyAddress: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 1.3,
  },
  logo: {
    width: 155,
    height: 46,
    objectFit: 'contain',
    marginBottom: 4,
  },
  headerMetaRight: {
    alignItems: 'flex-end',
    maxWidth: '40%',
  },
  docTitle: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  docSubTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0284c7',
    marginTop: 2,
    textAlign: 'right',
  },
  docDate: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 3,
    textAlign: 'right',
  },
  bannerDivider: {
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Field Section Titles
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  // Suppliers Box
  suppliersBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  supplierPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  supplierPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  supplierPillText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#334155',
  },

  // 3-Column Grid (Commercial Details, Billing, Destination)
  gridThree: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#ffffff',
  },
  infoCardHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoCardCompany: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  infoCardText: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.3,
  },
  commLine: {
    marginBottom: 4,
  },
  commLabel: {
    fontSize: 6.5,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  commVal: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 1,
  },

  // Note Box
  noteCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  noteText: {
    fontSize: 8.5,
    color: '#1e293b',
    lineHeight: 1.3,
  },

  // Items Table
  tableContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 8,
    color: '#1e293b',
  },

  colSr: { width: '6%', textAlign: 'center' },
  colIndent: { width: '16%' },
  colFirm: { width: '22%' },
  colProduct: { width: '38%' },
  colQty: { width: '10%', textAlign: 'right' },
  colUnit: { width: '8%', textAlign: 'center' },

  // Terms & Conditions Box
  termsContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  termItem: {
    fontSize: 7.5,
    color: '#334155',
    marginBottom: 3,
    lineHeight: 1.3,
  },

  // Footer Bar
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 10,
  },
  footerText: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  signatureBox: {
    alignItems: 'flex-end',
  },
  sigFor: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sigDept: {
    fontSize: 7.5,
    color: '#64748b',
  },
});

export interface RfqPdfItem {
  srNo: number;
  indentNumber: string;
  firmName: string;
  itemName: string;
  quantity: string | number;
  uom: string;
}

export interface RfqPdfDocumentProps {
  logoUrl?: string;
  companyAddress: string;
  dateStr: string;
  suppliers: string[];
  gstin: string;
  pan: string;
  billingCompany: string;
  billingAddress: string;
  destCompany: string;
  destAddress: string;
  descriptionNote?: string;
  items: RfqPdfItem[];
  terms: string[];
}

export const RfqPdfDocument: React.FC<RfqPdfDocumentProps> = ({
  logoUrl,
  companyAddress,
  dateStr,
  suppliers,
  gstin,
  pan,
  billingCompany,
  billingAddress,
  destCompany,
  destAddress,
  descriptionNote,
  items,
  terms,
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Block matching Modal Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.brandLeft}>
              {logoUrl ? (
                <Image src={logoUrl} style={styles.logo} />
              ) : (
                <Text style={styles.companyName}>Nutech</Text>
              )}
              <Text style={styles.companyAddress}>{companyAddress}</Text>
            </View>
            <View style={styles.headerMetaRight}>
              <Text style={styles.docTitle}>REQUEST FOR QUOTATION (RFQ)</Text>
              <Text style={styles.docSubTitle}>Quotation Dispatch & Response Tracking</Text>
              <Text style={styles.docDate}>Date: {dateStr}</Text>
            </View>
          </View>
          <View style={styles.bannerDivider}>
            <Text style={styles.bannerTitle}>GENERATE NEW MATERIAL RFQ / ENQUIRY</Text>
          </View>
        </View>

        {/* Suppliers Box */}
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>SUPPLIERS (SELECT MULTIPLE FROM MASTER VENDOR LIST) *</Text>
          <View style={styles.suppliersBox}>
            {suppliers && suppliers.length > 0 ? (
              <View style={styles.supplierPillsRow}>
                {suppliers.map((s, idx) => (
                  <View key={idx} style={styles.supplierPill}>
                    <Text style={styles.supplierPillText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 8, color: '#94a3b8' }}>All Selected Vendors</Text>
            )}
          </View>
        </View>

        {/* 3-Column Info Grid */}
        <View style={styles.gridThree}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardHeader}>OUR COMMERCIAL DETAILS</Text>
            <View style={styles.commLine}>
              <Text style={styles.commLabel}>GSTIN REGISTRATION</Text>
              <Text style={styles.commVal}>{gstin || "27ABCDE1234A1Z5"}</Text>
            </View>
            <View style={styles.commLine}>
              <Text style={styles.commLabel}>PAN CARD NO</Text>
              <Text style={styles.commVal}>{pan || "ABCDE1234A"}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardHeader}>BILLING ADDRESS</Text>
            <Text style={styles.infoCardCompany}>{billingCompany || "M/S Nutech Pvt. Ltd."}</Text>
            <Text style={styles.infoCardText}>{billingAddress || companyAddress}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardHeader}>DESTINATION ADDRESS</Text>
            <Text style={styles.infoCardCompany}>{destCompany || "M/S Nutech Pvt. Ltd."}</Text>
            <Text style={styles.infoCardText}>{destAddress || companyAddress}</Text>
          </View>
        </View>

        {/* Description / Letter Note */}
        {descriptionNote && descriptionNote.trim() !== "" ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>DESCRIPTION / LETTER NOTE</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{descriptionNote}</Text>
            </View>
          </View>
        ) : null}

        {/* Approved Indent Items Table */}
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>APPROVED INDENT ITEMS (READY FOR ENQUIRY REQUEST)</Text>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colSr]}>SR.</Text>
              <Text style={[styles.th, styles.colIndent]}>INDENT NO</Text>
              <Text style={[styles.th, styles.colFirm]}>FIRM NAME</Text>
              <Text style={[styles.th, styles.colProduct]}>PRODUCT NAME</Text>
              <Text style={[styles.th, styles.colQty]}>QTY</Text>
              <Text style={[styles.th, styles.colUnit]}>UNIT</Text>
            </View>
            {items.map((item, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.colSr]}>{item.srNo}</Text>
                <Text style={[styles.td, styles.colIndent, { fontWeight: 'bold' }]}>{item.indentNumber}</Text>
                <Text style={[styles.td, styles.colFirm]}>{item.firmName}</Text>
                <Text style={[styles.td, styles.colProduct, { fontWeight: 'bold' }]}>{item.itemName}</Text>
                <Text style={[styles.td, styles.colQty, { fontWeight: 'bold' }]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colUnit]}>{item.uom}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Terms & Conditions */}
        {terms && terms.length > 0 ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>TERMS & CONDITIONS</Text>
            <View style={styles.termsContainer}>
              {terms.map((t, i) => (
                <Text key={i} style={styles.termItem}>{t}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>
            {items.length} Item(s) Selected for RFQ · Computer generated RFQ Document — Nutech Purchase System
          </Text>
          <View style={styles.signatureBox}>
            <Text style={styles.sigFor}>For Nutech</Text>
            <Text style={styles.sigDept}>Purchase Department</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
