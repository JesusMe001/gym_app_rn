import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

interface Routine {
  id: number;
  name: string;
  exercise_count: number;
}

interface DayPlan {
  day_of_week: number;
  routine_id: number | null;
  routine_name: string | null;
  exercise_count: number;
}

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const DAY_EMOJIS = ['💪', '🏋️', '🔥', '⚡', '🎯', '🌟', '😴'];

export default function PlannerScreen() {
  const user = useAuthStore((s) => s.user);
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const loadPlan = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const days: DayPlan[] = DAYS.map((_, i) => {
      const row = db.getFirstSync(
        `SELECT wp.routine_id, r.name as routine_name,
          (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count
         FROM weekly_planner wp
         LEFT JOIN routines r ON wp.routine_id = r.id
         WHERE wp.user_id = ? AND wp.day_of_week = ?`,
        [user.id, i]
      ) as { routine_id: number; routine_name: string; exercise_count: number } | null;

      return {
        day_of_week: i,
        routine_id: row?.routine_id || null,
        routine_name: row?.routine_name || null,
        exercise_count: row?.exercise_count || 0,
      };
    });
    setPlan(days);
  }, [user]);

  const loadRoutines = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const rows = db.getAllSync(
      `SELECT r.id, r.name,
        (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count
       FROM routines r WHERE r.user_id = ? ORDER BY r.name`,
      [user.id]
    ) as Routine[];
    setRoutines(rows);
  }, [user]);

  useEffect(() => { loadPlan(); loadRoutines(); }, [loadPlan, loadRoutines]);

  const openPicker = (dayIndex: number) => {
    setSelectedDay(dayIndex);
    setShowPicker(true);
  };

  const assignRoutine = (routineId: number | null) => {
    if (!user || selectedDay === null) return;
    const db = getDb();
    const existing = db.getFirstSync(
      'SELECT id FROM weekly_planner WHERE user_id = ? AND day_of_week = ?',
      [user.id, selectedDay]
    );

    if (routineId === null) {
      db.runSync('DELETE FROM weekly_planner WHERE user_id = ? AND day_of_week = ?', [user.id, selectedDay]);
    } else if (existing) {
      db.runSync('UPDATE weekly_planner SET routine_id = ? WHERE user_id = ? AND day_of_week = ?', [routineId, user.id, selectedDay]);
    } else {
      db.runSync('INSERT INTO weekly_planner (user_id, day_of_week, routine_id) VALUES (?, ?, ?)', [user.id, selectedDay, routineId]);
    }

    setShowPicker(false);
    loadPlan();
  };

  const clearAll = () => {
    Alert.alert('Limpiar planner', 'Seguro que quieres limpiar toda la semana?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => {
        getDb().runSync('DELETE FROM weekly_planner WHERE user_id = ?', [user!.id]);
        loadPlan();
      }}
    ]);
  };

  const totalDays = plan.filter(d => d.routine_id).length;
  const restDays = 7 - totalDays;

  return (
    <View style={styles.container}>
      {/* Header stats */}
      <View style={styles.header}>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNum}>{totalDays}</Text>
            <Text style={styles.headerStatLabel}>dias entrenando</Text>
          </View>
          <View style={styles.headerDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatNum, { color: Colors.secondary }]}>{restDays}</Text>
            <Text style={styles.headerStatLabel}>dias descanso</Text>
          </View>
        </View>
        {totalDays > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearBtn}>Limpiar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.hint}>Toca un dia para asignar una rutina</Text>

        {plan.map((day, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayCard, day.routine_id ? styles.dayCardActive : styles.dayCardRest]}
            onPress={() => openPicker(i)}
          >
            <View style={styles.dayLeft}>
              <Text style={styles.dayEmoji}>{DAY_EMOJIS[i]}</Text>
              <View>
                <Text style={styles.dayName}>{DAYS[i]}</Text>
                {day.routine_name ? (
                  <Text style={styles.routineName}>{day.routine_name}</Text>
                ) : (
                  <Text style={styles.restText}>Descanso</Text>
                )}
              </View>
            </View>
            <View style={styles.dayRight}>
              {day.routine_id ? (
                <View style={styles.exerciseBadge}>
                  <Text style={styles.exerciseBadgeText}>{day.exercise_count} ejercicios</Text>
                </View>
              ) : (
                <Text style={styles.addText}>+ Asignar</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {routines.length === 0 && (
          <View style={styles.noRoutines}>
            <Text style={styles.noRoutinesEmoji}>💪</Text>
            <Text style={styles.noRoutinesText}>Crea rutinas primero para asignarlas al planner</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal seleccionar rutina */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {selectedDay !== null ? DAYS[selectedDay] : ''} — Seleccionar rutina
            </Text>

            <TouchableOpacity style={styles.restOption} onPress={() => assignRoutine(null)}>
              <Text style={styles.restOptionEmoji}>😴</Text>
              <Text style={styles.restOptionText}>Dia de descanso</Text>
            </TouchableOpacity>

            {routines.length === 0 ? (
              <Text style={styles.noRoutinesModal}>No tienes rutinas creadas aun.</Text>
            ) : (
              <FlatList
                data={routines}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.routineOption, plan[selectedDay!]?.routine_id === item.id && styles.routineOptionActive]}
                    onPress={() => assignRoutine(item.id)}
                  >
                    <View style={styles.routineOptionLeft}>
                      <Text style={styles.routineOptionName}>{item.name}</Text>
                      <Text style={styles.routineOptionMeta}>{item.exercise_count} ejercicios</Text>
                    </View>
                    {plan[selectedDay!]?.routine_id === item.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowPicker(false)}>
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
  header: { backgroundColor: Colors.surface, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerStats: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  headerStat: { alignItems: 'center' },
  headerStatNum: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  headerStatLabel: { fontSize: 12, color: Colors.textSecondary },
  headerDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  clearBtn: { color: Colors.error, fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 13, color: Colors.textMuted, marginBottom: 16, textAlign: 'center' },
  dayCard: { borderRadius: 16, padding: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 4 },
  dayCardActive: { backgroundColor: Colors.card, borderLeftColor: Colors.primary },
  dayCardRest: { backgroundColor: Colors.surface, borderLeftColor: Colors.border },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayEmoji: { fontSize: 28 },
  dayName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  routineName: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  restText: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  dayRight: { alignItems: 'flex-end' },
  exerciseBadge: { backgroundColor: Colors.primary + '22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  exerciseBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  addText: { color: Colors.textMuted, fontSize: 13 },
  noRoutines: { alignItems: 'center', padding: 32 },
  noRoutinesEmoji: { fontSize: 48, marginBottom: 12 },
  noRoutinesText: { color: Colors.textSecondary, textAlign: 'center', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  restOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  restOptionEmoji: { fontSize: 24 },
  restOptionText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  noRoutinesModal: { color: Colors.textMuted, textAlign: 'center', padding: 20 },
  routineOption: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  routineOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  routineOptionLeft: { flex: 1 },
  routineOptionName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  routineOptionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  checkmark: { fontSize: 20, color: Colors.primary, fontWeight: '800' },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});