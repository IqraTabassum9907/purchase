import React from 'react';
import { Document, Page, View, Image, Text, StyleSheet } from '@react-pdf/renderer';

// ─── Amount-in-words (Indian numbering: Crore / Lakh / Thousand) ───────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const convertBelowThousand = (n: number): string => {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelowThousand(n % 100) : '');
};

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const rest = n;

  let out = '';
  if (crore) out += convertBelowThousand(crore) + ' Crore ';
  if (lakh) out += convertBelowThousand(lakh) + ' Lakh ';
  if (thousand) out += convertBelowThousand(thousand) + ' Thousand ';
  if (rest) out += convertBelowThousand(rest);
  return out.trim();
};

const amountInWords = (amount: number): string => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = `INR ${numberToWords(rupees)} Rupees`;
  if (paise > 0) words += ` and ${numberToWords(paise)} Paise`;
  return `${words} Only`;
};

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Styles ─────────────────────────────────────────────────────────────────
const BORDER = '#1e293b';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica', color: '#0f172a' },
  title: { textAlign: 'center', fontSize: 13, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },

  box: { borderWidth: 1, borderColor: BORDER },
  rowSplit: { flexDirection: 'row' },
  bTop: { borderTopWidth: 1, borderColor: BORDER },
  bBottom: { borderBottomWidth: 1, borderColor: BORDER },
  bRight: { borderRightWidth: 1, borderColor: BORDER },

  // Header
  headerLeft: { width: '58%', padding: 8, paddingRight: 10 },
  headerRight: { width: '42%' },
  companyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  logo: { width: 70, height: 26, objectFit: 'contain' },
  companyTextWrap: { flex: 1, paddingRight: 6 },
  companyName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  companyAddress: { fontSize: 7, color: '#475569', marginTop: 3, lineHeight: 1.35 },
  companyMeta: { fontSize: 7, color: '#475569', marginTop: 4 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 },
  metaLabel: { color: '#64748b', fontSize: 7 },
  metaValue: { fontWeight: 'bold', fontSize: 7.5, color: '#0f172a', textAlign: 'right', maxWidth: '60%' },

  // Party section
  partyHalf: { width: '50%', padding: 8 },
  partyLabel: { fontSize: 7, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 3 },
  partyName: { fontSize: 9, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  partyAddress: { fontSize: 7.5, color: '#334155', lineHeight: 1.35, marginBottom: 2 },
  partyLine: { flexDirection: 'row', marginTop: 1 },
  partyLineLabel: { fontSize: 7, color: '#64748b', marginRight: 3 },
  partyLineValue: { fontSize: 7.5, color: '#0f172a', fontWeight: 'bold' },

  // Items table
  th: { padding: 4, fontSize: 7, fontWeight: 'bold', color: '#334155' },
  td: { padding: 4, fontSize: 7.5 },
  colSn: { width: '5%' },
  colDesc: { width: '30%' },
  colHsn: { width: '11%' },
  colQty: { width: '11%', textAlign: 'right' },
  colRate: { width: '13%', textAlign: 'right' },
  colUom: { width: '8%', textAlign: 'center' },
  colGst: { width: '8%', textAlign: 'center' },
  colAmount: { width: '14%', textAlign: 'right' },

  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end' },
  totalsBox: { width: '42%' },
  totalsLine: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 },
  totalsLineLabel: { fontSize: 7.5, color: '#334155', fontStyle: 'italic' },
  totalsLineValue: { fontSize: 7.5, color: '#0f172a' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 5 },
  grandLabel: { fontSize: 9, fontWeight: 'bold', color: '#0f172a' },
  grandValue: { fontSize: 9, fontWeight: 'bold', color: '#0f172a' },

  wordsRow: { padding: 6 },
  wordsLabel: { fontSize: 7, color: '#64748b', marginBottom: 2 },
  wordsValue: { fontSize: 8, fontWeight: 'bold', color: '#0f172a' },

  declTitle: { fontSize: 7.5, fontWeight: 'bold', color: '#0f172a', marginBottom: 3 },
  declItem: { fontSize: 7, color: '#334155', marginBottom: 2, lineHeight: 1.3 },

  signature: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  signatureRight: { alignItems: 'flex-end' },
});

interface POPdfItem {
  srNo: number;
  itemName: string;
  indentNumber: string;
  quantity: string | number;
  uom?: string;
  rate: string | number;
  hsn: string;
  gst: string;
  deliveryDate: string;
  total: string | number;
  basicValue?: string | number;
}

export interface POPdfDocumentProps {
  logoUrl: string;
  companyAddress: string;
  companyGstin?: string;
  poNumber: string;
  poDate: string;
  supplierName: string;
  supplierAddress: string;
  supplierGstin: string;
  supplierEmail: string;
  deliveryLocation: string;
  transportType?: string;
  quotationNumber: string;
  quotationDate: string;
  paymentTerms: string;
  advanceAmount: string;
  billingName: string;
  billingAddress: string;
  destinationName: string;
  destinationAddress: string;
  remarks?: string;
  items: POPdfItem[];
  subtotal: string;
  gst: string;
  grandTotal: string;
  terms: string[];
}

const MetaRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={last ? [styles.metaRow] : [styles.metaRow, styles.bBottom]}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value || '-'}</Text>
  </View>
);

export const POPdfDocument = ({
  logoUrl,
  companyAddress,
  companyGstin,
  poNumber,
  poDate,
  supplierName,
  supplierAddress,
  supplierGstin,
  supplierEmail,
  deliveryLocation,
  transportType,
  quotationNumber,
  quotationDate,
  paymentTerms,
  advanceAmount,
  billingName,
  billingAddress,
  destinationName,
  destinationAddress,
  remarks,
  items,
  subtotal,
  gst,
  grandTotal,
  terms,
}: POPdfDocumentProps) => {
  const subtotalNum = parseFloat(subtotal) || 0;
  const gstNum = parseFloat(gst) || 0;
  const grandTotalNum = parseFloat(grandTotal) || 0;
  // Assume intra-state (CGST+SGST split) — the standard case for a single-state
  // registered supplier; the per-item GST% shown in the table is unaffected.
  const halfGst = gstNum / 2;
  const roundedTotal = Math.round(grandTotalNum);
  const roundOff = roundedTotal - grandTotalNum;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PURCHASE ORDER</Text>

        <View style={styles.box}>
          {/* Header: company block + voucher/meta block */}
          <View style={[styles.rowSplit, styles.bBottom]}>
            <View style={[styles.headerLeft, styles.bRight]}>
              <View style={styles.companyRow}>
                {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
                <View style={styles.companyTextWrap}>
                  <Text style={styles.companyName}>Nutech</Text>
                  <Text style={styles.companyAddress}>{companyAddress}</Text>
                </View>
              </View>
              {companyGstin ? <Text style={styles.companyMeta}>GSTIN/UIN: {companyGstin}</Text> : null}
            </View>
            <View style={styles.headerRight}>
              <MetaRow label="Voucher No." value={poNumber || 'DRAFT'} />
              <MetaRow label="Dated" value={poDate} />
              <MetaRow label="Buyer's Ref. / Quotation No." value={quotationNumber} />
              <MetaRow label="Quotation Date" value={quotationDate} />
              <MetaRow label="Mode / Terms of Payment" value={paymentTerms} />
              <MetaRow label="Dispatched Through" value={transportType || '-'} />
              <MetaRow label="Destination" value={deliveryLocation} last />
            </View>
          </View>

          {/* Supplier block (full width — the party this PO is addressed to) */}
          <View style={[styles.rowSplit, styles.bBottom]}>
            <View style={{ width: '100%', padding: 8 }}>
              <Text style={styles.partyLabel}>Supplier (Vendor)</Text>
              <Text style={styles.partyName}>{supplierName || '-'}</Text>
              <Text style={styles.partyAddress}>{supplierAddress || '-'}</Text>
              <View style={styles.rowSplit}>
                <View style={styles.partyLine}>
                  <Text style={styles.partyLineLabel}>GSTIN/UIN:</Text>
                  <Text style={styles.partyLineValue}>{supplierGstin || '-'}</Text>
                </View>
                <View style={[styles.partyLine, { marginLeft: 16 }]}>
                  <Text style={styles.partyLineLabel}>Email:</Text>
                  <Text style={styles.partyLineValue}>{supplierEmail || '-'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bill To / Ship To — both are us, shown side by side */}
          <View style={styles.rowSplit}>
            <View style={[styles.partyHalf, styles.bRight]}>
              <Text style={styles.partyLabel}>Buyer (Bill To)</Text>
              <Text style={styles.partyName}>{billingName || '-'}</Text>
              <Text style={styles.partyAddress}>{billingAddress || '-'}</Text>
            </View>
            <View style={styles.partyHalf}>
              <Text style={styles.partyLabel}>Consignee (Ship To)</Text>
              <Text style={styles.partyName}>{destinationName || '-'}</Text>
              <Text style={styles.partyAddress}>{destinationAddress || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={[styles.box, { marginTop: 10 }]}>
          <View style={[styles.rowSplit, styles.bBottom, { backgroundColor: '#f1f5f9' }]} fixed>
            <Text style={[styles.th, styles.colSn]}>Sl.No</Text>
            <Text style={[styles.th, styles.colDesc]}>Description of Goods</Text>
            <Text style={[styles.th, styles.colHsn]}>HSN/SAC</Text>
            <Text style={[styles.th, styles.colQty]}>Quantity</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colUom]}>per</Text>
            <Text style={[styles.th, styles.colGst]}>GST%</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {items.map((it) => (
            <View style={[styles.rowSplit, styles.bBottom]} key={it.srNo} wrap={false}>
              <Text style={[styles.td, styles.colSn]}>{it.srNo}</Text>
              <View style={[styles.td, styles.colDesc]}>
                <Text style={{ fontWeight: 'bold' }}>{it.itemName}</Text>
                <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Indent: {it.indentNumber}</Text>
              </View>
              <Text style={[styles.td, styles.colHsn]}>{it.hsn || '-'}</Text>
              <Text style={[styles.td, styles.colQty]}>{it.quantity}{it.uom ? ` ${it.uom}` : ''}</Text>
              <Text style={[styles.td, styles.colRate]}>{money(parseFloat(String(it.rate)) || 0)}</Text>
              <Text style={[styles.td, styles.colUom]}>{it.uom || '-'}</Text>
              <Text style={[styles.td, styles.colGst]}>{it.gst || '0%'}</Text>
              <Text style={[styles.td, styles.colAmount]}>{money(parseFloat(String(it.basicValue ?? it.total)) || 0)}</Text>
            </View>
          ))}

          {/* Totals — right-aligned under the Amount column, no cell borders (matches
              the reference's tax-summary rows sitting directly beneath the items grid) */}
          <View style={styles.totalsWrap}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLineLabel}>Subtotal</Text>
                <Text style={styles.totalsLineValue}>{money(subtotalNum)}</Text>
              </View>
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLineLabel}>CGST Output</Text>
                <Text style={styles.totalsLineValue}>{money(halfGst)}</Text>
              </View>
              <View style={styles.totalsLine}>
                <Text style={styles.totalsLineLabel}>SGST Output</Text>
                <Text style={styles.totalsLineValue}>{money(halfGst)}</Text>
              </View>
              {Math.abs(roundOff) > 0.001 && (
                <View style={styles.totalsLine}>
                  <Text style={styles.totalsLineLabel}>Round Off</Text>
                  <Text style={styles.totalsLineValue}>{roundOff >= 0 ? '' : '(-)'}{money(Math.abs(roundOff))}</Text>
                </View>
              )}
              <View style={[styles.grandRow, styles.bTop]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>Rs. {money(roundedTotal)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Amount in words */}
        <View style={[styles.box, styles.wordsRow, { marginTop: 8 }]}>
          <Text style={styles.wordsLabel}>Amount Chargeable (in words)</Text>
          <Text style={styles.wordsValue}>{amountInWords(roundedTotal)}</Text>
        </View>

        {advanceAmount && parseFloat(advanceAmount) > 0 ? (
          <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 4 }}>
            Advance payment agreed: Rs. {money(parseFloat(advanceAmount) || 0)}
          </Text>
        ) : null}

        {/* Remarks / Special Instructions */}
        {remarks && remarks.trim() !== '' ? (
          <View style={[styles.box, { marginTop: 6, padding: 6 }]}>
            <Text style={styles.wordsLabel}>Description / Remarks</Text>
            <Text style={{ fontSize: 7.5, color: '#0f172a', marginTop: 2, lineHeight: 1.35 }}>{remarks}</Text>
          </View>
        ) : null}

        {/* Declaration / Terms */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.declTitle}>Declaration — Terms &amp; Conditions to be accepted by both parties:</Text>
          {terms.filter((t) => t.trim() !== '').map((t, i) => (
            <Text key={i} style={styles.declItem}>{i + 1}. {t}</Text>
          ))}
          <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>E. &amp; O.E</Text>
        </View>

        <View style={styles.signature}>
          <View>
            <Text style={{ fontSize: 7.5, color: '#64748b' }}>Prepared By: Procurement Department</Text>
            <Text style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2 }}>FMS System Generated Document</Text>
          </View>
          <View style={styles.signatureRight}>
            <Text style={{ fontWeight: 'bold', color: '#334155', marginBottom: 20 }}>for Nutech</Text>
            <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Authorised Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
