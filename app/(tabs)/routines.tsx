import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, FlatList } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

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

export default function RoutinesScreen() {
  const user = useAuthStore((s) => s.user);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exName, setExName] = useState('');
  const [exMuscle, setExMuscle] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('0');

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

  useEffect(() => { loadRoutines(); }, [loadRoutines]);

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

  const addExercise = () => {
    if (!exName.trim()) { Alert.alert('Error', 'Escribe el nombre del ejercicio'); return; }
    const db = getDb();
    db.runSync(
      'INSERT INTO exercises (routine_id, name, muscle_group, sets, reps, weight) VALUES (?, ?, ?, ?, ?, ?)',
      [selectedRoutine!.id, exName.trim(), exMuscle.trim(), parseInt(exSets), parseInt(exReps), parseFloat(exWeight)]
    );
    setExName(''); setExMuscle(''); setExSets('3'); setExReps('10'); setExWeight('0');
    setShowAddExercise(false);
    const rows = db.getAllSync('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', [selectedRoutine!.id]) as Exercise[];
    setExercises(rows);
    loadRoutines();
  };

  const deleteRoutine = (id: number) => {
    Alert.alert('Eliminar', 'Seguro que quieres eliminar esta rutina?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        const db = getDb();
        db.runSync('DELETE FROM exercises WHERE routine_id = ?', [id]);
        db.runSync('DELETE FROM routines WHERE id = ?', [id]);
        loadRoutines();
      }}
    ]);
  };

  const muscleColors: Record<string, string> = {
    pecho: Colors.muscle.pecho, espalda: Colors.muscle.espalda,
    piernas: Colors.muscle.piernas, hombros: Colors.muscle.hombros,
    brazos: Colors.muscle.brazos, core: Colors.muscle.core, cardio: Colors.muscle.cardio,
  };

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
          <Text style={styles.emptySub}>Crea tu primera rutina de entrenamiento</Text>
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
              <TouchableOpacity onPress={() => deleteRoutine(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal crear rutina */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nueva Rutina</Text>
            <TextInput style={styles.input} placeholder="Nombre de la rutina" placeholderTextColor={Colors.textMuted} value={newName} onChangeText={setNewName} />
            <TextInput style={styles.input} placeholder="Descripcion (opcional)" placeholderTextColor={Colors.textMuted} value={newDesc} onChangeText={setNewDesc} />
            <TouchableOpacity style={styles.btnPrimary} onPress={createRoutine}>
              <Text style={styles.btnPrimaryText}>Crear Rutina</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCreate(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ver ejercicios */}
      <Modal visible={showExercises} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>{selectedRoutine?.name}</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {exercises.length === 0 ? (
                <Text style={styles.noExercises}>Sin ejercicios. Agrega el primero.</Text>
              ) : exercises.map((ex) => (
                <View key={ex.id} style={styles.exerciseRow}>
                  <View style={[styles.muscleBadge, { backgroundColor: muscleColors[ex.muscle_group?.toLowerCase()] || Colors.border }]}>
                    <Text style={styles.muscleBadgeText}>{ex.muscle_group || '?'}</Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>{ex.sets} series x {ex.reps} reps — {ex.weight}kg</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowAddExercise(true)}>
              <Text style={styles.btnPrimaryText}>+ Agregar ejercicio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowExercises(false)}>
              <Text style={styles.btnCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal agregar ejercicio */}
      <Modal visible={showAddExercise} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Agregar Ejercicio</Text>
            <TextInput style={styles.input} placeholder="Nombre del ejercicio" placeholderTextColor={Colors.textMuted} value={exName} onChangeText={setExName} />
            <TextInput style={styles.input} placeholder="Grupo muscular (pecho, espalda...)" placeholderTextColor={Colors.textMuted} value={exMuscle} onChangeText={setExMuscle} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.inputSmall]} placeholder="Series" placeholderTextColor={Colors.textMuted} value={exSets} onChangeText={setExSets} keyboardType="numeric" />
              <TextInput style={[styles.input, styles.inputSmall]} placeholder="Reps" placeholderTextColor={Colors.textMuted} value={exReps} onChangeText={setExReps} keyboardType="numeric" />
              <TextInput style={[styles.input, styles.inputSmall]} placeholder="Kg" placeholderTextColor={Colors.textMuted} value={exWeight} onChangeText={setExWeight} keyboardType="numeric" />
            </View>
            <TouchableOpacity style={styles.btnPrimary} onPress={addExercise}>
              <Text style={styles.btnPrimaryText}>Agregar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAddExercise(false)}>
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
  deleteBtnText: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  noExercises: { color: Colors.textMuted, textAlign: 'center', padding: 20 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: Colors.card, borderRadius: 12, padding: 12 },
  muscleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 12 },
  muscleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  exerciseMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});