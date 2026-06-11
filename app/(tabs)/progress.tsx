import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Dimensions } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

interface BodyStat {
  id: number;
  weight: number;
  body_fat: number;
  muscle_mass: number;
  logged_at: string;
}

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = 160;

export default function ProgressScreen() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<BodyStat[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');

  const loadStats = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const rows = db.getAllSync(
      'SELECT * FROM body_stats WHERE user_id = ? ORDER BY logged_at ASC LIMIT 30',
      [user.id]
    ) as BodyStat[];
    setStats(rows);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const addStat = () => {
    if (!weight.trim()) { Alert.alert('Error', 'El peso es obligatorio'); return; }
    const db = getDb();
    db.runSync(
      'INSERT INTO body_stats (user_id, weight, body_fat, muscle_mass) VALUES (?, ?, ?, ?)',
      [user!.id, parseFloat(weight), parseFloat(bodyFat||'0'), parseFloat(muscleMass||'0')]
    );
    setWeight(''); setBodyFat(''); setMuscleMass('');
    setShowAdd(false);
    loadStats();
  };

  const latest = stats[stats.length - 1];
  const first = stats[0];

  const weightDiff = latest && first && stats.length > 1
    ? (latest.weight - first.weight).toFixed(1)
    : null;

  // Mini grafica de barras simple
  const renderChart = (data: number[], color: string, label: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const barWidth = Math.min(32, (CHART_WIDTH - 16) / data.length - 4);

    return (
      <View style={styles.chartBox}>
        <Text style={styles.chartLabel}>{label}</Text>
        <View style={styles.chartArea}>
          {data.map((val, i) => {
            const h = ((val - min) / range) * (CHART_HEIGHT - 40) + 20;
            return (
              <View key={i} style={styles.barWrapper}>
                <Text style={styles.barValue}>{val}</Text>
                <View style={[styles.bar, { height: h, backgroundColor: color, width: barWidth }]} />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mi Progreso</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Registro</Text>
          </TouchableOpacity>
        </View>

        {/* Resumen actual */}
        {latest ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ultima medicion</Text>
            <Text style={styles.summaryDate}>{new Date(latest.logged_at).toLocaleDateString('es-ES')}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{latest.weight}</Text>
                <Text style={styles.summaryLabel}>kg peso</Text>
              </View>
              {latest.body_fat > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: Colors.warning }]}>{latest.body_fat}%</Text>
                  <Text style={styles.summaryLabel}>grasa</Text>
                </View>
              )}
              {latest.muscle_mass > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: Colors.secondary }]}>{latest.muscle_mass}kg</Text>
                  <Text style={styles.summaryLabel}>musculo</Text>
                </View>
              )}
            </View>
            {weightDiff !== null && (
              <View style={styles.diffRow}>
                <Text style={styles.diffLabel}>Cambio total: </Text>
                <Text style={[styles.diffValue, { color: parseFloat(weightDiff) <= 0 ? Colors.secondary : Colors.error }]}>
                  {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff} kg
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros aun</Text>
            <Text style={styles.emptySub}>Registra tu primer peso para ver tu progreso</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Agregar registro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Graficas */}
        {stats.length >= 2 && (
          <View style={styles.chartsSection}>
            <Text style={styles.sectionTitle}>Graficas</Text>
            {renderChart(stats.map(s => s.weight), Colors.primary, 'Peso (kg)')}
            {stats.some(s => s.body_fat > 0) && renderChart(stats.map(s => s.body_fat), Colors.warning, 'Grasa corporal (%)')}
            {stats.some(s => s.muscle_mass > 0) && renderChart(stats.map(s => s.muscle_mass), Colors.secondary, 'Masa muscular (kg)')}
          </View>
        )}

        {/* Historial */}
        {stats.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {[...stats].reverse().map((s) => (
              <View key={s.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{new Date(s.logged_at).toLocaleDateString('es-ES')}</Text>
                <View style={styles.historyValues}>
                  <Text style={styles.historyVal}>{s.weight}kg</Text>
                  {s.body_fat > 0 && <Text style={[styles.historyVal, { color: Colors.warning }]}>{s.body_fat}%</Text>}
                  {s.muscle_mass > 0 && <Text style={[styles.historyVal, { color: Colors.secondary }]}>{s.muscle_mass}kg 💪</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal agregar */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo Registro</Text>
            <Text style={styles.fieldLabel}>Peso (kg) *</Text>
            <TextInput style={styles.input} placeholder="Ej: 75.5" placeholderTextColor={Colors.textMuted} value={weight} onChangeText={setWeight} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Grasa corporal (%)</Text>
            <TextInput style={styles.input} placeholder="Ej: 18.5" placeholderTextColor={Colors.textMuted} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Masa muscular (kg)</Text>
            <TextInput style={styles.input} placeholder="Ej: 35.0" placeholderTextColor={Colors.textMuted} value={muscleMass} onChangeText={setMuscleMass} keyboardType="numeric" />
            <TouchableOpacity style={styles.btnPrimary} onPress={addStat}>
              <Text style={styles.btnPrimaryText}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAdd(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  summaryTitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  summaryDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  diffRow: { flexDirection: 'row', alignItems: 'center' },
  diffLabel: { fontSize: 13, color: Colors.textSecondary },
  diffValue: { fontSize: 15, fontWeight: '800' },
  empty: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chartsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  chartBox: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  chartLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: 12 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 4 },
  barWrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
  barValue: { fontSize: 9, color: Colors.textMuted, marginBottom: 2 },
  historySection: { marginBottom: 32 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  historyDate: { fontSize: 14, color: Colors.textSecondary },
  historyValues: { flexDirection: 'row', gap: 12 },
  historyVal: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});