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
  poTitle: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' },
  poMeta: { fontSize: 8, color: '#64748b', marginTop: 2 },
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
  colQty: { width: '10%', textAlign: 'right' },
  colRate: { width: '14%', textAlign: 'right' },
  colHsn: { width: '13%' },
  colGst: { width: '10%' },
  colTotal: { width: '17%', textAlign: 'right' },
  summaryBox: { alignSelf: 'flex-end', width: 200, marginTop: 8 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 4, marginTop: 2 },
  summaryTotalText: { fontWeight: 'bold', fontSize: 10, color: '#4338ca' },
  terms: { fontSize: 7.5, color: '#64748b', marginTop: 2 },
  signature: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingTop: 12, borderTopWidth: 1, borderColor: '#e2e8f0' },
  signatureRight: { alignItems: 'flex-end' },
});

interface POPdfItem {
  srNo: number;
  itemName: string;
  indentNumber: string;
  quantity: string | number;
  rate: string | number;
  hsn: string;
  gst: string;
  total: string | number;
}

export interface POPdfDocumentProps {
  logoUrl: string;
  companyAddress: string;
  poNumber: string;
  poDate: string;
  supplierName: string;
  supplierAddress: string;
  supplierGstin: string;
  supplierEmail: string;
  deliveryDate: string;
  quotationNumber: string;
  quotationDate: string;
  billingName: string;
  billingAddress: string;
  destinationName: string;
  destinationAddress: string;
  items: POPdfItem[];
  subtotal: string;
  gst: string;
  grandTotal: string;
  terms: string[];
}

export const POPdfDocument = ({
  logoUrl,
  companyAddress,
  poNumber,
  poDate,
  supplierName,
  supplierAddress,
  supplierGstin,
  supplierEmail,
  deliveryDate,
  quotationNumber,
  quotationDate,
  billingName,
  billingAddress,
  destinationName,
  destinationAddress,
  items,
  subtotal,
  gst,
  grandTotal,
  terms,
}: POPdfDocumentProps) => (
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
          <Text style={styles.poTitle}>PURCHASE ORDER</Text>
          <Text style={styles.poMeta}>Ref: {poNumber || 'DRAFT'}</Text>
          <Text style={styles.poMeta}>Date: {poDate}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Supplier Info</Text>
            <View style={styles.infoBox}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{supplierName || '-'}</Text>
              <Text style={{ color: '#475569', marginBottom: 2 }}>{supplierAddress || '-'}</Text>
              <View style={styles.infoLine}><Text style={styles.infoLabel}>GSTIN:</Text><Text style={styles.infoValue}>{supplierGstin || '-'}</Text></View>
              <View style={styles.infoLine}><Text style={styles.infoLabel}>Email:</Text><Text style={styles.infoValue}>{supplierEmail || '-'}</Text></View>
            </View>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Delivery & Order References</Text>
            <View style={styles.infoBox}>
              <View style={styles.infoLine}><Text style={styles.infoLabel}>Delivery Date:</Text><Text style={styles.infoValue}>{deliveryDate || '-'}</Text></View>
              <View style={styles.infoLine}><Text style={styles.infoLabel}>Quotation No:</Text><Text style={styles.infoValue}>{quotationNumber || '-'}</Text></View>
              <View style={styles.infoLine}><Text style={styles.infoLabel}>Quotation Date:</Text><Text style={styles.infoValue}>{quotationDate || '-'}</Text></View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Billing Address</Text>
            <View style={styles.infoBox}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{billingName}</Text>
              <Text style={{ color: '#475569' }}>{billingAddress}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.sectionTitle}>Destination / Ship-To Address</Text>
            <View style={styles.infoBox}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{destinationName}</Text>
              <Text style={{ color: '#475569' }}>{destinationAddress}</Text>
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
            <Text style={[styles.th, styles.colRate]}>Unit Price</Text>
            <Text style={[styles.th, styles.colHsn]}>HSN</Text>
            <Text style={[styles.th, styles.colGst]}>GST</Text>
            <Text style={[styles.th, styles.colTotal]}>Total Price</Text>
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
              <Text style={[styles.td, styles.colHsn]}>{it.hsn || '-'}</Text>
              <Text style={[styles.td, styles.colGst]}>{it.gst || '0%'}</Text>
              <Text style={[styles.td, styles.colTotal]}>Rs. {it.total}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryLine}><Text>Subtotal</Text><Text>Rs. {subtotal}</Text></View>
          <View style={styles.summaryLine}><Text>GST</Text><Text>Rs. {gst}</Text></View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalText}>GRAND TOTAL</Text>
            <Text style={styles.summaryTotalText}>Rs. {grandTotal}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Terms & Conditions</Text>
        {terms.filter((t) => t.trim() !== '').map((t, i) => (
          <Text key={i} style={styles.terms}>{i + 1}. {t}</Text>
        ))}
      </View>

      <View style={styles.signature}>
        <View>
          <Text style={{ fontSize: 7.5, color: '#64748b' }}>Prepared By: Procurement Department</Text>
          <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>FMS System Generated Document</Text>
        </View>
        <View style={styles.signatureRight}>
          <Text style={{ fontWeight: 'bold', color: '#334155' }}>For Nutech</Text>
          <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Authorized Signatory</Text>
        </View>
      </View>
    </Page>
  </Document>
);
