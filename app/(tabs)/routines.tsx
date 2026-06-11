import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, FlatList } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

const API_KEY = 'QeONfKwX7gjcVT1Qz2pur6GGyzDpwGkNM4SJPfpq';

interface Routine {
  id: number;
  name: string;
  description: string;
  exercise_count: number;
}

interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight: number;
}

interface ApiExercise {
  name: string;
  type: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  instructions: string;
}

const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'upper_arms', 'lower_arms', 'upper_legs', 'lower_legs', 'waist', 'cardio'];
const MUSCLE_ES: Record<string, string> = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros',
  upper_arms: 'Brazos', lower_arms: 'Antebrazos', upper_legs: 'Piernas',
  lower_legs: 'Pantorrillas', waist: 'Core', cardio: 'Cardio',
};

export default function RoutinesScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('0');
  const [apiResults, setApiResults] = useState<ApiExercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState('chest');
  const [selectedApiEx, setSelectedApiEx] = useState<ApiExercise | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadRoutines = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const rows = db.getAllSync(
      `SELECT r.id, r.name, r.description,
        (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count
       FROM routines r WHERE r.user_id = ? ORDER BY r.created_at DESC`,
      [user.id]
    ) as Routine[];
    setRoutines(rows);
  }, [user]);

  useState(() => { loadRoutines(); });

  const createRoutine = () => {
    if (!newName.trim()) { Alert.alert('Error', 'Escribe un nombre'); return; }
    const db = getDb();
    db.runSync('INSERT INTO routines (user_id, name, description) VALUES (?, ?, ?)', [user!.id, newName.trim(), newDesc.trim()]);
    setNewName(''); setNewDesc('');
    setShowCreate(false);
    loadRoutines();
  };

  const openRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', [routine.id]) as Exercise[];
    setExercises(rows);
    setShowExercises(true);
  };

  const searchExercises = async (muscle: string) => {
    setSelectedMuscle(muscle);
    setSearching(true);
    setApiResults([]);
    try {
      const res = await fetch(
        `https://api.api-ninjas.com/v1/exercises?muscle=${muscle}&limit=10`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      const data = await res.json();
      setApiResults(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar ejercicios');
    } finally {
      setSearching(false);
    }
  };

  const addApiExercise = () => {
    if (!selectedApiEx) return;
    const db = getDb();
    db.runSync(
      'INSERT INTO exercises (routine_id, name, muscle_group, sets, reps, weight) VALUES (?, ?, ?, ?, ?, ?)',
      [selectedRoutine!.id, selectedApiEx.name, MUSCLE_ES[selectedApiEx.muscle] || selectedApiEx.muscle, parseInt(exSets), parseInt(exReps), parseFloat(exWeight)]
    );
    const rows = db.getAllSync('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', [selectedRoutine!.id]) as Exercise[];
    setExercises(rows);
    loadRoutines();
    setSelectedApiEx(null);
    setExSets('3'); setExReps('10'); setExWeight('0');
    setShowSearch(false);
  };

  const deleteRoutine = (id: number) => {
    Alert.alert('Eliminar', 'Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        const db = getDb();
        db.runSync('DELETE FROM exercises WHERE routine_id = ?', [id]);
        db.runSync('DELETE FROM routines WHERE id = ?', [id]);
        loadRoutines();
      }}
    ]);
  };

  const deleteExercise = (id: number) => {
    getDb().runSync('DELETE FROM exercises WHERE id = ?', [id]);
    const rows = getDb().getAllSync('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', [selectedRoutine!.id]) as Exercise[];
    setExercises(rows);
    loadRoutines();
  };

  const muscleColors: Record<string, string> = {
    Pecho: Colors.muscle.pecho, Espalda: Colors.muscle.espalda,
    Piernas: Colors.muscle.piernas, Hombros: Colors.muscle.hombros,
    Brazos: Colors.muscle.brazos, Core: Colors.muscle.core,
    Cardio: Colors.muscle.cardio,
  };

  const difficultyColor = (d: string) =>
    d === 'beginner' ? Colors.secondary : d === 'intermediate' ? Colors.warning : Colors.error;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Rutinas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {routines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💪</Text>
          <Text style={styles.emptyTitle}>Sin rutinas aun</Text>
          <Text style={styles.emptySub}>Crea tu primera rutina</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.emptyBtnText}>Crear rutina</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.routineCard} onPress={() => openRoutine(item)}>
              <View style={styles.routineInfo}>
                <Text style={styles.routineName}>{item.name}</Text>
                {item.description ? <Text style={styles.routineDesc}>{item.description}</Text> : null}
                <Text style={styles.routineMeta}>{item.exercise_count} ejercicios</Text>
              </View>
              <View style={styles.routineActions}>
                <TouchableOpacity style={styles.startBtn} onPress={() => router.push({ pathname: '/workout', params: { routineId: item.id.toString(), routineName: item.name } })}>
                  <Text style={styles.startBtnText}>▶ Iniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteRoutine(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal crear rutina */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva Rutina</Text>
            <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={Colors.textMuted} value={newName} onChangeText={setNewName} />
            <TextInput style={styles.input} placeholder="Descripcion (opcional)" placeholderTextColor={Colors.textMuted} value={newDesc} onChangeText={setNewDesc} />
            <TouchableOpacity style={styles.btnPrimary} onPress={createRoutine}>
              <Text style={styles.btnPrimaryText}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCreate(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ver ejercicios de rutina */}
      <Modal visible={showExercises} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>{selectedRoutine?.name}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {exercises.length === 0 ? (
                <Text style={styles.noExercises}>Sin ejercicios. Agrega el primero.</Text>
              ) : exercises.map((ex) => (
                <View key={ex.id} style={styles.exerciseRow}>
                  <View style={[styles.muscleBadge, { backgroundColor: muscleColors[ex.muscle_group] || Colors.border }]}>
                    <Text style={styles.muscleBadgeText}>{ex.muscle_group || '?'}</Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>{ex.sets}x{ex.reps} — {ex.weight}kg</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteExercise(ex.id)}>
                    <Text style={{ fontSize: 16 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => { setShowSearch(true); searchExercises('chest'); }}>
              <Text style={styles.btnPrimaryText}>+ Buscar ejercicio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowExercises(false)}>
              <Text style={styles.btnCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal buscar ejercicios API */}
      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '92%' }]}>
            <Text style={styles.modalTitle}>Buscar Ejercicio</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleScroll}>
              {MUSCLE_GROUPS.map(m => (
                <TouchableOpacity key={m} style={[styles.muscleBtn, selectedMuscle === m && styles.muscleBtnActive]} onPress={() => searchExercises(m)}>
                  <Text style={[styles.muscleBtnText, selectedMuscle === m && styles.muscleBtnTextActive]}>{MUSCLE_ES[m]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {searching ? (
              <ActivityIndicator color={Colors.primary} size="large" style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {apiResults.map((ex, i) => (
                  <TouchableOpacity key={i} style={[styles.apiExRow, selectedApiEx?.name === ex.name && styles.apiExRowSelected]} onPress={() => setSelectedApiEx(ex)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.apiExName}>{ex.name}</Text>
                      <Text style={styles.apiExMeta}>{ex.equipment} · <Text style={{ color: difficultyColor(ex.difficulty) }}>{ex.difficulty}</Text></Text>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedApiEx(ex); setShowDetail(true); }}>
                      <Text style={styles.infoBtn}>ℹ️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedApiEx && (
              <View style={styles.addExForm}>
                <Text style={styles.selectedExName}>{selectedApiEx.name}</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.inputSmall]} placeholder="Series" placeholderTextColor={Colors.textMuted} value={exSets} onChangeText={setExSets} keyboardType="numeric" />
                  <TextInput style={[styles.input, styles.inputSmall]} placeholder="Reps" placeholderTextColor={Colors.textMuted} value={exReps} onChangeText={setExReps} keyboardType="numeric" />
                  <TextInput style={[styles.input, styles.inputSmall]} placeholder="Kg" placeholderTextColor={Colors.textMuted} value={exWeight} onChangeText={setExWeight} keyboardType="numeric" />
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={addApiExercise}>
                  <Text style={styles.btnPrimaryText}>Agregar a rutina</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.btnCancel} onPress={() => { setShowSearch(false); setSelectedApiEx(null); setApiResults([]); }}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal detalle ejercicio */}
      <Modal visible={showDetail} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selectedApiEx?.name}</Text>
            <View style={styles.detailTags}>
              <View style={[styles.tag, { backgroundColor: Colors.primary + '33' }]}>
                <Text style={[styles.tagText, { color: Colors.primary }]}>{MUSCLE_ES[selectedApiEx?.muscle || ''] || selectedApiEx?.muscle}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: Colors.accent + '33' }]}>
                <Text style={[styles.tagText, { color: Colors.accent }]}>{selectedApiEx?.equipment}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: difficultyColor(selectedApiEx?.difficulty || '') + '33' }]}>
                <Text style={[styles.tagText, { color: difficultyColor(selectedApiEx?.difficulty || '') }]}>{selectedApiEx?.difficulty}</Text>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 200 }}>
              <Text style={styles.instructions}>{selectedApiEx?.instructions}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowDetail(false)}>
              <Text style={styles.btnPrimaryText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  routineCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: Colors.primary },
  routineInfo: { flex: 1 },
  routineName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  routineDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  routineMeta: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  routineActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtnText: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  noExercises: { color: Colors.textMuted, textAlign: 'center', padding: 20 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: Colors.card, borderRadius: 12, padding: 12 },
  muscleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10 },
  muscleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  exerciseMeta: { fontSize: 12, color: Colors.textSecondary },
  muscleScroll: { marginBottom: 12 },
  muscleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  muscleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  muscleBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  muscleBtnTextActive: { color: '#fff' },
  apiExRow: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  apiExRowSelected: { borderWidth: 2, borderColor: Colors.primary },
  apiExName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  apiExMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  infoBtn: { fontSize: 20, marginLeft: 8 },
  addExForm: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginVertical: 10 },
  selectedExName: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 10, textTransform: 'capitalize' },
  detailTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  instructions: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
});