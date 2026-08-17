import React from 'react';
import { Document, Page, View, Image, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1.5, borderColor: '#3b82f6', paddingBottom: 10, marginBottom: 12 },
  headerLeft: { flexDirection: 'column', maxWidth: '65%' },
  logo: { width: 170, height: 48, objectFit: 'contain', marginBottom: 6 },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  companyAddress: { fontSize: 8, color: '#475569', marginTop: 2, lineHeight: 1.3 },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  docTitle: { fontSize: 14, fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase' },
  docMeta: { fontSize: 8.5, color: '#64748b', marginTop: 3 },
  
  gridTwo: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardBox: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8 },
  cardTitle: { fontSize: 8, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, borderBottomWidth: 1, borderColor: '#cbd5e1', paddingBottom: 2 },
  cardText: { fontSize: 8.5, color: '#1e293b', lineHeight: 1.3 },
  cardLabel: { fontSize: 7.5, color: '#64748b' },
  cardValue: { fontSize: 8.5, fontWeight: 'bold', color: '#0f172a' },

  noteBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 10, marginTop: 2, minHeight: 32 },
  noteText: { fontSize: 9.5, color: '#0f172a', lineHeight: 1.4 },
  
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 8.5, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  
  table: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderBottomWidth: 1, borderColor: '#cbd5e1' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  th: { padding: 6, fontSize: 8, fontWeight: 'bold', color: '#334155' },
  td: { padding: 6, fontSize: 8.5, color: '#1e293b' },
  
  colSr: { width: '8%', textAlign: 'center' },
  colIndent: { width: '18%' },
  colFirm: { width: '24%' },
  colProduct: { width: '34%' },
  colQty: { width: '16%', textAlign: 'right' },
  
  termsBox: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8, marginTop: 4 },
  termItem: { fontSize: 8, color: '#334155', marginBottom: 3, lineHeight: 1.3 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, paddingTop: 10, borderTopWidth: 1, borderColor: '#e2e8f0' },
  footerText: { fontSize: 8, color: '#94a3b8' },
  signatureBox: { alignItems: 'center' },
  signatureTitle: { fontSize: 8.5, fontWeight: 'bold', color: '#334155', marginTop: 20 },
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
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>NUTECH</Text>
            )}
            <Text style={styles.companyAddress}>{companyAddress}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>Material RFQ / Enquiry</Text>
            <Text style={styles.docMeta}>Date: {dateStr}</Text>
          </View>
        </View>

        {/* Commercial & Suppliers Grid */}
        <View style={styles.gridTwo}>
          <View style={styles.cardBox}>
            <Text style={styles.cardTitle}>Target Suppliers</Text>
            <Text style={styles.cardValue}>
              {suppliers.length > 0 ? suppliers.join(", ") : "All Selected Vendors"}
            </Text>
          </View>
          <View style={styles.cardBox}>
            <Text style={styles.cardTitle}>Our Commercial Details</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={styles.cardLabel}>GSTIN REGISTRATION:</Text>
              <Text style={styles.cardValue}>{gstin || "27ABCDE1234A1Z5"}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cardLabel}>PAN CARD NO:</Text>
              <Text style={styles.cardValue}>{pan || "ABCDE1234A"}</Text>
            </View>
          </View>
        </View>

        {/* Billing & Destination Grid */}
        <View style={styles.gridTwo}>
          <View style={styles.cardBox}>
            <Text style={styles.cardTitle}>Billing Address</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>{billingCompany}</Text>
            <Text style={styles.cardText}>{billingAddress}</Text>
          </View>
          <View style={styles.cardBox}>
            <Text style={styles.cardTitle}>Destination Address</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>{destCompany}</Text>
            <Text style={styles.cardText}>{destAddress}</Text>
          </View>
        </View>

        {/* Description / Letter Note */}
        {descriptionNote && descriptionNote.trim() !== "" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description / Letter Note</Text>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{descriptionNote}</Text>
            </View>
          </View>
        )}

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approved Indent Items (RFQ Specifications)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colSr]}>SR.</Text>
              <Text style={[styles.th, styles.colIndent]}>INDENT NO</Text>
              <Text style={[styles.th, styles.colFirm]}>FIRM / LOCATION</Text>
              <Text style={[styles.th, styles.colProduct]}>PRODUCT NAME</Text>
              <Text style={[styles.th, styles.colQty]}>QUANTITY</Text>
            </View>
            {items.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, styles.colSr]}>{item.srNo}</Text>
                <Text style={[styles.td, styles.colIndent, { fontWeight: 'bold' }]}>{item.indentNumber}</Text>
                <Text style={[styles.td, styles.colFirm]}>{item.firmName}</Text>
                <Text style={[styles.td, styles.colProduct]}>{item.itemName}</Text>
                <Text style={[styles.td, styles.colQty, { fontWeight: 'bold' }]}>{item.quantity} {item.uom}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Terms & Conditions */}
        {terms && terms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <View style={styles.termsBox}>
              {terms.map((t, i) => (
                <Text key={i} style={styles.termItem}>{t}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Footer & Signature */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Computer generated RFQ Document — Nutech Purchase System</Text>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Authorized Purchase Officer</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
