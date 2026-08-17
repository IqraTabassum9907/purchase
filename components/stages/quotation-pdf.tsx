import React from 'react';
import { Document, Page, View, Image, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 12, marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '60%' },
  logo: { width: 90, height: 22, objectFit: 'contain' },
  companyName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  companyAddress: { fontSize: 7.5, color: '#64748b', marginTop: 2, maxWidth: 220 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' },
  docMeta: { fontSize: 8, color: '#64748b', marginTop: 2 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  infoBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8 },
  infoGrid: { flexDirection: 'row', gap: 10 },
  infoCol: { flex: 1 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  infoLabel: { color: '#64748b' },
  infoValue: { fontWeight: 'bold', color: '#1e293b' },
  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  th: { padding: 5, fontSize: 7.5, fontWeight: 'bold', color: '#475569' },
  td: { padding: 5, fontSize: 8 },
  colSn: { width: '6%' },
  colItem: { width: '30%' },
  colQty: { width: '12%', textAlign: 'right' },
  colRate: { width: '16%', textAlign: 'right' },
  colGst: { width: '13%', textAlign: 'right' },
  colTotal: { width: '23%', textAlign: 'right' },
  summaryBox: { alignSelf: 'flex-end', width: 220, marginTop: 8 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 4, marginTop: 2 },
  summaryTotalText: { fontWeight: 'bold', fontSize: 10, color: '#4338ca' },
  remarksText: { fontSize: 8, color: '#475569', marginTop: 2 },
  signature: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingTop: 12, borderTopWidth: 1, borderColor: '#e2e8f0' },
  signatureRight: { alignItems: 'flex-end' },
});

interface QuotationPdfItem {
  srNo: number;
  itemName: string;
  indentNumber: string;
  quantity: string | number;
  rate: string | number;
  gstPercent: string | number;
  /** Total for this line, GST included. */
  amount: string | number;
}

export interface QuotationPdfDocumentProps {
  logoUrl: string;
  companyAddress: string;
  vendorName: string;
  submissionDate: string;
  paymentTerms: string;
  deliveryDate: string;
  transportType: string;
  remarks: string;
  items: QuotationPdfItem[];
  subtotal: string;
  gstAmount: string;
  grandTotal: string;
}

export const QuotationPdfDocument = ({
  logoUrl,
  companyAddress,
  vendorName,
  submissionDate,
  paymentTerms,
  deliveryDate,
  transportType,
  remarks,
  items,
  subtotal,
  gstAmount,
  grandTotal,
}: QuotationPdfDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <View>
            <Text style={styles.companyName}>Nutech</Text>
            <Text style={styles.companyAddress}>{companyAddress}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.docTitle}>VENDOR QUOTATION</Text>
          <Text style={styles.docMeta}>Date: {submissionDate}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Vendor</Text>
            <View style={styles.infoBox}>
              <Text style={{ fontWeight: 'bold' }}>{vendorName || '-'}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Commercial Terms</Text>
              <View style={{ marginBottom: 3 }}>
                <Text style={styles.infoLabel}>Payment Terms:</Text>
                <Text style={styles.infoValue}>{paymentTerms || '-'}</Text>
              </View>
              <View style={{ marginBottom: 3 }}>
                <Text style={styles.infoLabel}>Expected Delivery:</Text>
                <Text style={styles.infoValue}>{deliveryDate || '-'}</Text>
              </View>
              <View style={{ marginBottom: 3 }}>
                <Text style={styles.infoLabel}>Transport Type:</Text>
                <Text style={styles.infoValue}>{transportType || '-'}</Text>
              </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.th, styles.colSn]}>S/N</Text>
            <Text style={[styles.th, styles.colItem]}>Item Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colGst]}>GST</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {items.map((it) => (
            <View style={styles.tableRow} key={it.srNo} wrap={false}>
              <Text style={[styles.td, styles.colSn]}>{it.srNo}</Text>
              <View style={[styles.td, styles.colItem]}>
                <Text style={{ fontWeight: 'bold' }}>{it.itemName}</Text>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Indent: {it.indentNumber}</Text>
              </View>
              <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
              <Text style={[styles.td, styles.colRate]}>Rs. {it.rate}</Text>
              <Text style={[styles.td, styles.colGst]}>{it.gstPercent || '0'}%</Text>
              <Text style={[styles.td, styles.colTotal]}>Rs. {it.amount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryLine}><Text>Subtotal</Text><Text>Rs. {subtotal}</Text></View>
          <View style={styles.summaryLine}><Text>GST Total</Text><Text>Rs. {gstAmount}</Text></View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalText}>GRAND TOTAL</Text>
            <Text style={styles.summaryTotalText}>Rs. {grandTotal}</Text>
          </View>
        </View>
      </View>

      {remarks ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remarks</Text>
          <Text style={styles.remarksText}>{remarks}</Text>
        </View>
      ) : null}

      <View style={styles.signature}>
        <View>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Submitted By: {vendorName || '-'}</Text>
          <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>FMS System Generated Document</Text>
        </View>
        <View style={styles.signatureRight}>
          <Text style={{ fontWeight: 'bold', color: '#334155' }}>For Nutech</Text>
          <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Purchase Department</Text>
        </View>
      </View>
    </Page>
  </Document>
);
