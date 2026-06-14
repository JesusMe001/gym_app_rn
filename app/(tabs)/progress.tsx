import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
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

function SimpleLineChart({ data, color }: { data: {x:number,y:number}[], color: string }) {
  if (data.length < 2) return null;
  const W = width - 80;
  const H = 180;
  const padL = 44, padR = 16, padT = 16, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));
  const rangeY = maxY - minY || 1;
  const toX = (i: number) => padL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => padT + cH - ((v - minY) / rangeY) * cH;
  const points = data.map((d, i) => `${toX(i)},${toY(d.y)}`).join(' ');
  const ticks = [minY, minY + rangeY * 0.5, maxY];
  return (
    <Svg width={W} height={H}>
      {ticks.map((val, i) => (
        <SvgText key={i} x={padL - 4} y={toY(val) + 4} fontSize={9} fill={Colors.textMuted} textAnchor="end">
          {val.toFixed(1)}
        </SvgText>
      ))}
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (<Circle key={i} cx={toX(i)} cy={toY(d.y)} r={4} fill={color} />))}
      {data.map((d, i) => (
        <SvgText key={`l${i}`} x={toX(i)} y={H - 4} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
          {i + 1}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function ProgressScreen() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<BodyStat[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [activeChart, setActiveChart] = useState<'weight' | 'fat' | 'muscle'>('weight');

  const loadStats = useCallback(() => {
    if (!user) return;
    const rows = getDb().getAllSync('SELECT * FROM body_stats WHERE user_id = ? ORDER BY logged_at ASC LIMIT 30', [user.id]) as BodyStat[];
    setStats(rows);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const addStat = () => {
    if (!weight.trim()) { Alert.alert('Error', 'El peso es obligatorio'); return; }
    getDb().runSync('INSERT INTO body_stats (user_id, weight, body_fat, muscle_mass) VALUES (?, ?, ?, ?)', [user!.id, parseFloat(weight), parseFloat(bodyFat||'0'), parseFloat(muscleMass||'0')]);
    setWeight(''); setBodyFat(''); setMuscleMass('');
    setShowAdd(false);
    loadStats();
  };

  const latest = stats[stats.length - 1];
  const first = stats[0];
  const weightDiff = latest && first && stats.length > 1 ? (latest.weight - first.weight).toFixed(1) : null;
  const weightData = stats.map((s, i) => ({ x: i + 1, y: s.weight }));
  const fatData = stats.filter(s => s.body_fat > 0).map((s, i) => ({ x: i + 1, y: s.body_fat }));
  const muscleData = stats.filter(s => s.muscle_mass > 0).map((s, i) => ({ x: i + 1, y: s.muscle_mass }));
  const chartColor = activeChart === 'weight' ? Colors.primary : activeChart === 'fat' ? Colors.warning : Colors.secondary;
  const chartData = activeChart === 'weight' ? weightData : activeChart === 'fat' ? fatData : muscleData;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mi Progreso</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Registro</Text>
          </TouchableOpacity>
        </View>

        {latest ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ultima medicion</Text>
            <Text style={styles.summaryDate}>{new Date(latest.logged_at).toLocaleDateString('es-ES')}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{latest.weight}</Text>
                <Text style={styles.summaryLabel}>kg peso</Text>
              </View>
              {latest.body_fat > 0 && <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: Colors.warning }]}>{latest.body_fat}%</Text><Text style={styles.summaryLabel}>grasa</Text></View>}
              {latest.muscle_mass > 0 && <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: Colors.secondary }]}>{latest.muscle_mass}kg</Text><Text style={styles.summaryLabel}>musculo</Text></View>}
            </View>
            {weightDiff !== null && (
              <View style={styles.diffRow}>
                <Text style={styles.diffLabel}>Cambio total: </Text>
                <Text style={[styles.diffValue, { color: parseFloat(weightDiff) <= 0 ? Colors.secondary : Colors.error }]}>{parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff} kg</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros aun</Text>
            <Text style={styles.emptySub}>Registra tu primer peso para ver tu progreso</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}><Text style={styles.emptyBtnText}>Agregar registro</Text></TouchableOpacity>
          </View>
        )}

        {stats.length >= 2 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Graficas de progreso</Text>
            <View style={styles.chartTabs}>
              <TouchableOpacity style={[styles.chartTab, activeChart === 'weight' && { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={() => setActiveChart('weight')}>
                <Text style={[styles.chartTabText, activeChart === 'weight' && styles.chartTabTextActive]}>Peso</Text>
              </TouchableOpacity>
              {fatData.length >= 2 && <TouchableOpacity style={[styles.chartTab, activeChart === 'fat' && { backgroundColor: Colors.warning, borderColor: Colors.warning }]} onPress={() => setActiveChart('fat')}><Text style={[styles.chartTabText, activeChart === 'fat' && styles.chartTabTextActive]}>Grasa</Text></TouchableOpacity>}
              {muscleData.length >= 2 && <TouchableOpacity style={[styles.chartTab, activeChart === 'muscle' && { backgroundColor: Colors.secondary, borderColor: Colors.secondary }]} onPress={() => setActiveChart('muscle')}><Text style={[styles.chartTabText, activeChart === 'muscle' && styles.chartTabTextActive]}>Musculo</Text></TouchableOpacity>}
            </View>
            <View style={styles.chartBox}>
              <SimpleLineChart data={chartData} color={chartColor} />
            </View>
            <View style={styles.quickStats}>
              <View style={styles.quickStat}><Text style={styles.quickStatLabel}>Minimo</Text><Text style={[styles.quickStatVal, { color: chartColor }]}>{Math.min(...chartData.map(d => d.y)).toFixed(1)}</Text></View>
              <View style={styles.quickStat}><Text style={styles.quickStatLabel}>Maximo</Text><Text style={[styles.quickStatVal, { color: chartColor }]}>{Math.max(...chartData.map(d => d.y)).toFixed(1)}</Text></View>
              <View style={styles.quickStat}><Text style={styles.quickStatLabel}>Promedio</Text><Text style={[styles.quickStatVal, { color: chartColor }]}>{(chartData.reduce((a, d) => a + d.y, 0) / chartData.length).toFixed(1)}</Text></View>
              <View style={styles.quickStat}><Text style={styles.quickStatLabel}>Registros</Text><Text style={[styles.quickStatVal, { color: chartColor }]}>{chartData.length}</Text></View>
            </View>
          </View>
        )}

        {stats.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {[...stats].reverse().map((s) => (
              <View key={s.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{new Date(s.logged_at).toLocaleDateString('es-ES')}</Text>
                <View style={styles.historyValues}>
                  <Text style={styles.historyVal}>{s.weight}kg</Text>
                  {s.body_fat > 0 && <Text style={[styles.historyVal, { color: Colors.warning }]}>{s.body_fat}%</Text>}
                  {s.muscle_mass > 0 && <Text style={[styles.historyVal, { color: Colors.secondary }]}>{s.muscle_mass}kg</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo Registro</Text>
            <Text style={styles.fieldLabel}>Peso (kg)</Text>
            <TextInput style={styles.input} placeholder="Ej: 75.5" placeholderTextColor={Colors.textMuted} value={weight} onChangeText={setWeight} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Grasa corporal (%)</Text>
            <TextInput style={styles.input} placeholder="Ej: 18.5" placeholderTextColor={Colors.textMuted} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Masa muscular (kg)</Text>
            <TextInput style={styles.input} placeholder="Ej: 35.0" placeholderTextColor={Colors.textMuted} value={muscleMass} onChangeText={setMuscleMass} keyboardType="numeric" />
            <TouchableOpacity style={styles.btnPrimary} onPress={addStat}><Text style={styles.btnPrimaryText}>Guardar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAdd(false)}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
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
  chartSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  chartTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chartTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chartTabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chartTabTextActive: { color: '#fff' },
  chartBox: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  quickStats: { flexDirection: 'row', gap: 8 },
  quickStat: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  quickStatLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  quickStatVal: { fontSize: 16, fontWeight: '800' },
  historySection: { marginBottom: 32 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  historyDate: { fontSize: 14, color: Colors.textSecondary },
  historyValues: { flexDirection: 'row', gap: 12 },
  historyVal: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});