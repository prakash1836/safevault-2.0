import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  Modal, 
  Platform, 
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Trash2, 
  Lock, 
  Calendar, 
  User, 
  Bell, 
  ShieldCheck, 
  Pencil, 
  Download, 
  X, 
  Check,
  AlertCircle,
  Clock,
  FileText,
  Shield,
  Eye,
  Tag,
  StickyNote,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { PrimaryButton } from '../../src/components/UI';
import { EncryptedImagePreview } from '../../src/components/EncryptedImagePreview';
import { colors, radius, spacing, shadow } from '../../src/constants/theme';
import { fmtDate, getDocStatus, daysUntil } from '../../src/utils/date';
import { getKey, decryptToBase64 } from '../../src/services/encryption';
import { readEncryptedLocal } from '../../src/services/drive';
import { CATEGORIES } from '../../src/constants/categories';

// Status Configuration
const STATUS_CONFIG = {
  expired: {
    label: 'Expired',
    icon: XCircle,
    color: colors.expired,
    bg: '#FEE2E2',
    description: 'This document has expired',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    icon: AlertTriangle,
    color: '#D97706',
    bg: '#FEF3C7',
    description: 'Expires within 30 days',
  },
  valid: {
    label: 'Valid',
    icon: CheckCircle2,
    color: '#059669',
    bg: '#D1FAE5',
    description: 'Document is current',
  },
  none: {
    label: 'No Expiry',
    icon: Shield,
    color: colors.textSecondary,
    bg: colors.elevated,
    description: 'No expiry date set',
  },
};

// Document Status Badge Component
function DocumentStatusBadge({ status, expiryDate }: { status: string; expiryDate?: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.none;
  const StatusIcon = config.icon;
  const days = expiryDate ? daysUntil(expiryDate) : null;

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <StatusIcon color={config.color} size={16} strokeWidth={2} />
      <View style={styles.statusBadgeContent}>
        <Text style={[styles.statusBadgeLabel, { color: config.color }]}>{config.label}</Text>
        {days !== null && status !== 'none' && (
          <Text style={[styles.statusBadgeDays, { color: config.color }]}>
            {status === 'expired' ? `${Math.abs(days)} days ago` : `${days} days left`}
          </Text>
        )}
      </View>
    </View>
  );
}

// Category Badge Component
function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find(c => c.key === category) || CATEGORIES[CATEGORIES.length - 1];
  
  return (
    <View style={[styles.categoryBadge, { backgroundColor: cat.color + '15' }]}>
      <Tag color={cat.color} size={12} strokeWidth={2} />
      <Text style={[styles.categoryBadgeText, { color: cat.color }]}>{cat.label}</Text>
    </View>
  );
}

// Encryption Badge
function EncryptionBadge() {
  return (
    <View style={styles.encryptionBadge}>
      <Lock color={colors.textTertiary} size={10} strokeWidth={2.5} />
      <Text style={styles.encryptionBadgeText}>AES-256</Text>
    </View>
  );
}

// Document Hero Card
function DocumentHeroCard({ doc, owner, accentDark, accent }: any) {
  const status = getDocStatus(doc.expiryDate);
  
  return (
    <View style={[styles.heroCard, { backgroundColor: accentDark }]}>
      {/* Decorative Elements */}
      <View style={[styles.heroDecor1, { backgroundColor: accent + '20' }]} />
      <View style={[styles.heroDecor2, { backgroundColor: accent + '15' }]} />
      
      {/* Lock Icon */}
      <View style={styles.heroLockWrap}>
        <View style={styles.heroLockInner}>
          <Lock color="#fff" size={28} strokeWidth={1.8} />
        </View>
      </View>
      
      {/* Document Name */}
      <Text style={styles.heroName} numberOfLines={2}>{doc.name}</Text>
      
      {/* Badges Row */}
      <View style={styles.heroBadgesRow}>
        <CategoryBadge category={doc.category} />
        <EncryptionBadge />
      </View>
      
      {/* Status */}
      <DocumentStatusBadge status={status} expiryDate={doc.expiryDate} />
      
      {/* Owner Tag */}
      {owner && (
        <View style={styles.heroOwnerTag}>
          <User color="rgba(255,255,255,0.7)" size={12} strokeWidth={2} />
          <Text style={styles.heroOwnerText}>{owner.name}</Text>
        </View>
      )}
    </View>
  );
}

// Quick Actions Row
function QuickActionsRow({ onEdit, onDownload, downloading, accent, accentSurface }: any) {
  return (
    <View style={styles.quickActions}>
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: accentSurface }]}
        onPress={onEdit}
        activeOpacity={0.7}
        testID="doc-edit-action"
      >
        <View style={[styles.quickActionIcon, { backgroundColor: accent + '20' }]}>
          <Pencil color={accent} size={18} strokeWidth={1.8} />
        </View>
        <Text style={[styles.quickActionText, { color: accent }]}>Edit</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickAction, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
        onPress={onDownload}
        disabled={downloading}
        activeOpacity={0.7}
        testID="doc-download-action"
      >
        <View style={[styles.quickActionIcon, { backgroundColor: colors.elevated }]}>
          <Download color={colors.textPrimary} size={18} strokeWidth={1.8} />
        </View>
        <Text style={styles.quickActionText}>{downloading ? 'Exporting...' : 'Export'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// File Preview Section
function FilePreviewSection({ doc }: any) {
  return (
    <View style={styles.previewSection}>
      <View style={styles.previewHeader}>
        <View style={styles.previewTitleRow}>
          <Eye color={colors.textSecondary} size={16} strokeWidth={2} />
          <Text style={styles.previewTitle}>Preview</Text>
        </View>
        <View style={styles.previewSecureBadge}>
          <ShieldCheck color={colors.textTertiary} size={12} strokeWidth={2} />
          <Text style={styles.previewSecureText}>Decrypted locally</Text>
        </View>
      </View>
      <View style={styles.previewContainer}>
        <EncryptedImagePreview doc={{ id: doc.id, mimeType: doc.mimeType, localUri: doc.localUri, fileId: doc.fileId }} />
      </View>
    </View>
  );
}

// Metadata Field Component
function MetadataField({ icon, label, value, status, isLast, accentSurface }: any) {
  const hasStatus = status && status !== 'none';
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  
  return (
    <View style={[styles.metaField, !isLast && styles.metaFieldBorder]}>
      <View style={[styles.metaFieldIcon, { backgroundColor: accentSurface }]}>
        {icon}
      </View>
      <View style={styles.metaFieldContent}>
        <Text style={styles.metaFieldLabel}>{label}</Text>
        <View style={styles.metaFieldValueRow}>
          <Text style={[
            styles.metaFieldValue,
            hasStatus && { color: statusConfig?.color }
          ]}>{value}</Text>
          {hasStatus && (
            <View style={[styles.metaStatusDot, { backgroundColor: statusConfig?.color }]} />
          )}
        </View>
      </View>
    </View>
  );
}

// Dates Card Component
function DatesCard({ doc, accent, accentSurface }: any) {
  const status = getDocStatus(doc.expiryDate);
  const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <CalendarClock color={accent} size={18} strokeWidth={1.8} />
        <Text style={styles.cardTitle}>Important Dates</Text>
      </View>
      
      <View style={styles.datesGrid}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Issued</Text>
          <Text style={styles.dateValue}>{fmtDate(doc.issueDate)}</Text>
        </View>
        
        <View style={[styles.dateItem, styles.dateItemHighlight, { backgroundColor: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.bg || colors.elevated }]}>
          <View style={styles.dateExpiryHeader}>
            <Text style={[styles.dateLabel, { color: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color }]}>Expires</Text>
            {status !== 'none' && (
              <View style={[styles.dateDaysBadge, { backgroundColor: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color + '20' }]}>
                <Text style={[styles.dateDaysText, { color: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color }]}>
                  {status === 'expired' ? 'Overdue' : `${days}d left`}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.dateValue, { color: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color || colors.textPrimary }]}>
            {fmtDate(doc.expiryDate)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Reminders Card Component
function RemindersCard({ reminder, accent, accentSurface }: any) {
  const reminderOptions = [
    { key: 'days30', label: '30 days before', enabled: reminder.days30 },
    { key: 'days7', label: '7 days before', enabled: reminder.days7 },
    { key: 'days1', label: '1 day before', enabled: reminder.days1 },
  ];
  
  const enabledCount = reminderOptions.filter(r => r.enabled).length;
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Bell color={accent} size={18} strokeWidth={1.8} />
        <Text style={styles.cardTitle}>Reminders</Text>
        <View style={[styles.cardBadge, { backgroundColor: enabledCount > 0 ? accentSurface : colors.elevated }]}>
          <Text style={[styles.cardBadgeText, { color: enabledCount > 0 ? accent : colors.textTertiary }]}>
            {enabledCount} active
          </Text>
        </View>
      </View>
      
      <View style={styles.remindersList}>
        {reminderOptions.map((opt, index) => (
          <View key={opt.key} style={[styles.reminderItem, index < reminderOptions.length - 1 && styles.reminderItemBorder]}>
            <View style={[
              styles.reminderCheck, 
              opt.enabled 
                ? { backgroundColor: accent, borderColor: accent } 
                : { backgroundColor: 'transparent', borderColor: colors.border }
            ]}>
              {opt.enabled && <Check color="#fff" size={10} strokeWidth={3} />}
            </View>
            <Text style={[styles.reminderText, !opt.enabled && styles.reminderTextDisabled]}>
              {opt.label}
            </Text>
            {opt.enabled && (
              <View style={[styles.reminderActiveBadge, { backgroundColor: accentSurface }]}>
                <Bell color={accent} size={10} strokeWidth={2} />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// Notes Card Component
function NotesCard({ notes, accent }: any) {
  if (!notes) return null;
  
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StickyNote color={accent} size={18} strokeWidth={1.8} />
        <Text style={styles.cardTitle}>Notes</Text>
      </View>
      <View style={styles.notesContent}>
        <Text style={styles.notesText}>{notes}</Text>
      </View>
    </View>
  );
}

// Security Info Card
function SecurityInfoCard({ doc, accent, accentSurface }: any) {
  return (
    <View style={[styles.securityCard, { backgroundColor: accentSurface }]}>
      <View style={styles.securityHeader}>
        <ShieldCheck color={accent} size={18} strokeWidth={1.8} />
        <Text style={[styles.securityTitle, { color: accent }]}>Security Info</Text>
      </View>
      <View style={styles.securityGrid}>
        <View style={styles.securityItem}>
          <Text style={styles.securityLabel}>Encryption</Text>
          <Text style={[styles.securityValue, { color: accent }]}>AES-256</Text>
        </View>
        <View style={styles.securityItem}>
          <Text style={styles.securityLabel}>Storage</Text>
          <Text style={[styles.securityValue, { color: accent }]}>
            {doc.fileId ? 'Google Drive' : 'Local'}
          </Text>
        </View>
      </View>
      {doc.fileId && (
        <View style={styles.securityFileId}>
          <Text style={styles.securityFileIdLabel}>File ID</Text>
          <Text style={[styles.securityFileIdValue, { color: accent }]} numberOfLines={1}>
            {doc.fileId.slice(0, 32)}...
          </Text>
        </View>
      )}
    </View>
  );
}

export default function DocDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { docs, family, deleteDoc, updateDoc } = useVault();
  const t = useTheme();
  const router = useRouter();
  const doc = docs.find((d) => d.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(doc?.name || '');
  const [ownerId, setOwnerId] = useState(doc?.ownerId || 'me');
  const [notes, setNotes] = useState(doc?.notes || '');
  const [issueDate, setIssueDate] = useState<string | undefined>(doc?.issueDate);
  const [expiryDate, setExpiryDate] = useState<string | undefined>(doc?.expiryDate);
  const [reminder, setReminder] = useState(doc?.reminder || { days30: true, days7: true, days1: true });
  const [pickWhich, setPickWhich] = useState<null | 'issue' | 'expiry'>(null);
  const [downloading, setDownloading] = useState(false);

  if (!doc) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.notFoundContainer}>
          <View style={styles.notFoundIcon}>
            <FileText color={colors.textTertiary} size={32} strokeWidth={1.5} />
          </View>
          <Text style={styles.notFoundTitle}>Document not found</Text>
          <Text style={styles.notFoundSubtitle}>This document may have been deleted</Text>
          <TouchableOpacity 
            style={[styles.notFoundBtn, { backgroundColor: t.accentSurface }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.notFoundBtnText, { color: t.accent }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const owner = family.find((f) => f.id === doc.ownerId);

  const onDelete = () => Alert.alert('Delete document?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDoc(doc.id); router.back(); } },
  ]);

  const onSaveEdit = async () => {
    await updateDoc(doc.id, { name, ownerId, notes, issueDate, expiryDate, reminder });
    setEditOpen(false);
  };

  const onDownload = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web preview', 'File download is supported on the mobile app. On web, the encrypted file remains available in your local cache.');
      return;
    }
    if (!doc.localUri && !doc.fileId) { Alert.alert('Unavailable', 'No file is attached to this document.'); return; }
    setDownloading(true);
    try {
      const key = await getKey();
      if (!key) throw new Error('Missing encryption key');
      let cipher = '';
      if (doc.localUri) cipher = await readEncryptedLocal(doc.localUri);
      const b64 = decryptToBase64(cipher, key);
      const ext = doc.mimeType?.includes('pdf') ? 'pdf' : doc.mimeType?.includes('png') ? 'png' : doc.mimeType?.includes('jpeg') ? 'jpg' : 'bin';
      const out = (FileSystem.documentDirectory || '') + `safevault_export_${doc.id}.${ext}`;
      await FileSystem.writeAsStringAsync(out, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Share.share({ url: out, message: doc.name });
    } catch (e: any) {
      Alert.alert('Download failed', e.message || 'Could not decrypt the file.');
    } finally { setDownloading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBtn} 
          onPress={() => router.back()} 
          testID="doc-back-btn"
        >
          <ChevronLeft color={colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Document Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerBtn} 
            onPress={() => setEditOpen(true)} 
            testID="doc-edit-btn"
          >
            <Pencil color={colors.textPrimary} size={18} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerBtn, styles.headerBtnDanger]} 
            onPress={onDelete} 
            testID="doc-delete-btn"
          >
            <Trash2 color={colors.expired} size={18} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Card */}
        <DocumentHeroCard 
          doc={doc} 
          owner={owner}
          accentDark={t.accentDark} 
          accent={t.accent} 
        />

        {/* Quick Actions */}
        <QuickActionsRow 
          onEdit={() => setEditOpen(true)}
          onDownload={onDownload}
          downloading={downloading}
          accent={t.accent}
          accentSurface={t.accentSurface}
        />

        {/* File Preview */}
        <FilePreviewSection doc={doc} />

        {/* Dates */}
        <DatesCard 
          doc={doc}
          accent={t.accent}
          accentSurface={t.accentSurface}
        />

        {/* Reminders */}
        <RemindersCard 
          reminder={doc.reminder}
          accent={t.accent}
          accentSurface={t.accentSurface}
        />

        {/* Notes */}
        <NotesCard notes={doc.notes} accent={t.accent} />

        {/* Security Info */}
        <SecurityInfoCard 
          doc={doc}
          accent={t.accent}
          accentSurface={t.accentSurface}
        />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editModal}>
            <View style={styles.editModalHandle} />
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Document</Text>
              <TouchableOpacity 
                style={styles.editModalClose}
                onPress={() => setEditOpen(false)} 
                testID="edit-close-btn"
              >
                <X color={colors.textPrimary} size={20} />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.editModalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Document Name</Text>
              <TextInput 
                value={name} 
                onChangeText={setName} 
                style={styles.input} 
                placeholderTextColor={colors.textTertiary}
                testID="edit-name" 
              />
              
              <Text style={styles.inputLabel}>Owner</Text>
              <View style={styles.ownerPills}>
                {family.map((f) => (
                  <TouchableOpacity 
                    key={f.id} 
                    onPress={() => setOwnerId(f.id)} 
                    style={[
                      styles.ownerPill, 
                      ownerId === f.id && { backgroundColor: t.accentDark, borderColor: t.accentDark }
                    ]} 
                    testID={`edit-owner-${f.id}`}
                  >
                    <Text style={[
                      styles.ownerPillText, 
                      { color: ownerId === f.id ? '#fff' : colors.textSecondary }
                    ]}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.inputLabel}>Issue Date</Text>
                  <TouchableOpacity 
                    style={styles.dateInput} 
                    onPress={() => setPickWhich('issue')} 
                    testID="edit-issue-date"
                  >
                    <Calendar color={t.accent} size={16} />
                    <Text style={styles.dateInputText}>{fmtDate(issueDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.inputLabel}>Expiry Date</Text>
                  <TouchableOpacity 
                    style={styles.dateInput} 
                    onPress={() => setPickWhich('expiry')} 
                    testID="edit-expiry-date"
                  >
                    <Calendar color={t.accent} size={16} />
                    <Text style={styles.dateInputText}>{fmtDate(expiryDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput 
                value={notes} 
                onChangeText={setNotes} 
                style={[styles.input, styles.inputMultiline]} 
                multiline 
                placeholderTextColor={colors.textTertiary}
                placeholder="Add any additional notes..."
                testID="edit-notes" 
              />
              
              <Text style={styles.inputLabel}>Reminders</Text>
              <View style={styles.reminderOptions}>
                {(['days30', 'days7', 'days1'] as const).map((k) => (
                  <TouchableOpacity 
                    key={k} 
                    style={[
                      styles.reminderOption, 
                      reminder[k] && { borderColor: t.accent, backgroundColor: t.accentSurface }
                    ]} 
                    onPress={() => setReminder({ ...reminder, [k]: !reminder[k] })} 
                    testID={`edit-rem-${k}`}
                  >
                    <View style={[
                      styles.reminderOptionCheck, 
                      reminder[k] && { backgroundColor: t.accent, borderColor: t.accent }
                    ]}>
                      {reminder[k] && <Check color="#fff" size={12} strokeWidth={3} />}
                    </View>
                    <Text style={styles.reminderOptionText}>
                      {k === 'days30' ? '30 days before' : k === 'days7' ? '7 days before' : '1 day before'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <PrimaryButton 
                title="Save Changes" 
                onPress={onSaveEdit} 
                variant="dark" 
                testID="edit-save-btn" 
                style={styles.saveBtn} 
              />
            </ScrollView>
            
            {pickWhich && (
              <DateTimePicker
                value={new Date((pickWhich === 'issue' ? issueDate : expiryDate) || Date.now())}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (d) {
                    if (pickWhich === 'issue') setIssueDate(d.toISOString());
                    else setExpiryDate(d.toISOString());
                  }
                  if (Platform.OS !== 'ios') setPickWhich(null);
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.bg,
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md,
  },
  headerBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 14, 
    backgroundColor: colors.surface, 
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  headerBtnDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  headerTitle: { 
    flex: 1, 
    textAlign: 'center', 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.textPrimary, 
    marginHorizontal: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  
  // Scroll Content
  scrollContent: { 
    padding: spacing.xl, 
    paddingBottom: 80,
  },
  
  // Hero Card
  heroCard: { 
    borderRadius: 24,
    padding: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...shadow.md,
  },
  heroDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -80,
    right: -60,
  },
  heroDecor2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -40,
    left: -40,
  },
  heroLockWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroLockInner: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '800', 
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  heroOwnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  heroOwnerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  statusBadgeContent: {
    gap: 2,
  },
  statusBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadgeDays: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.85,
  },
  
  // Category Badge
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Encryption Badge
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  encryptionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: 16,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  
  // Preview Section
  previewSection: {
    marginTop: spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  previewSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewSecureText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Card Styles
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Dates Grid
  datesGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateItem: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.elevated,
    borderRadius: 14,
  },
  dateItemHighlight: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateExpiryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  dateDaysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dateDaysText: {
    fontSize: 10,
    fontWeight: '700',
  },
  
  // Reminders
  remindersList: {
    gap: 2,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  reminderItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reminderCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  reminderTextDisabled: {
    color: colors.textTertiary,
  },
  reminderActiveBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Notes
  notesContent: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    padding: spacing.md,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  
  // Security Card
  securityCard: {
    borderRadius: 18,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  securityGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  securityItem: {
    flex: 1,
  },
  securityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  securityValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  securityFileId: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  securityFileIdLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  securityFileIdValue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  
  // Metadata Fields
  metaField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: spacing.md,
  },
  metaFieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaFieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaFieldContent: {
    flex: 1,
  },
  metaFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaFieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaFieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  metaStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  // Not Found
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  notFoundIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notFoundSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  notFoundBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  notFoundBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Edit Modal
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end',
  },
  editModal: { 
    backgroundColor: colors.bg, 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    maxHeight: '92%',
  },
  editModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  editModalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  editModalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: colors.textPrimary,
  },
  editModalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalContent: { 
    padding: spacing.xl, 
    paddingTop: 0,
    paddingBottom: 40,
  },
  inputLabel: { 
    fontSize: 12, 
    fontWeight: '700',
    color: colors.textSecondary, 
    marginTop: spacing.lg, 
    marginBottom: 8, 
    letterSpacing: 0.3, 
    textTransform: 'uppercase',
  },
  input: { 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 15, 
    color: colors.textPrimary,
  },
  inputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  ownerPills: { 
    flexDirection: 'row', 
    gap: 8, 
    flexWrap: 'wrap',
  },
  ownerPill: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: radius.pill, 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border,
  },
  ownerPillText: { 
    fontSize: 13, 
    fontWeight: '700',
  },
  dateRow: { 
    flexDirection: 'row', 
    gap: spacing.md,
  },
  dateCol: { 
    flex: 1,
  },
  dateInput: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
  },
  dateInputText: { 
    fontSize: 14, 
    color: colors.textPrimary, 
    fontWeight: '600',
  },
  reminderOptions: {
    gap: 8,
  },
  reminderOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.border, 
    backgroundColor: colors.surface,
  },
  reminderOptionCheck: { 
    width: 22, 
    height: 22, 
    borderRadius: 7, 
    borderWidth: 1.5, 
    borderColor: colors.border, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  reminderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveBtn: {
    marginTop: spacing.xl,
  },
});
