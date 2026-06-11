import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { Colors } from '../src/theme/colors';
import { useAuthStore } from '../src/stores/authStore';
import { getDb } from '../src/db/connection';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight: number;
}

interface SetLog {
  setNumber: number;
  reps: string;
  weight: string;
  done: boolean;
}

export default function WorkoutSession() {
  const { routineId, routineName } = useLocalSearchParams<{ routineId: string; routineName: string }>();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [restTimer, setRestTimer] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const restRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (!routineId) return;
    const db = getDb();
    const rows = db.getAllSync('SELECT * FROM exercises WHERE routine_id = ? ORDER BY order_index', [parseInt(routineId)]) as Exercise[];
    setExercises(rows);
    if (rows.length > 0) initSets(rows[0]);

    sessionRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => { clearInterval(sessionRef.current); clearInterval(restRef.current); };
  }, [routineId]);

  const initSets = (exercise: Exercise) => {
    const logs: SetLog[] = Array.from({ length: exercise.sets }, (_, i) => ({
      setNumber: i + 1,
      reps: exercise.reps.toString(),
      weight: exercise.weight.toString(),
      done: false,
    }));
    setSetLogs(logs);
    setRestActive(false);
    setRestTimer(0);
    clearInterval(restRef.current);
  };

  const completeSet = (index: number) => {
    const updated = [...setLogs];
    updated[index].done = true;
    setSetLogs(updated);
    setCompletedSets(c => c + 1);

    const db = getDb();
    db.runSync(
      'INSERT INTO workout_logs (user_id, exercise_id, sets_done, reps_done, weight_used) VALUES (?, ?, ?, ?, ?)',
      [user!.id, exercises[currentIndex].id, 1, parseInt(updated[index].reps) || 0, parseFloat(updated[index].weight) || 0]
    );

    const allDone = updated.every(s => s.done);
    if (!allDone) startRest();
    else if (currentIndex < exercises.length - 1) {
      setTimeout(() => nextExercise(), 800);
    } else {
      setShowFinish(true);
    }
  };

  const startRest = () => {
    setRestActive(true);
    setRestTimer(90);
    clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t <= 1) { clearInterval(restRef.current); setRestActive(false); playBeep(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const playBeep = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/sounds/beep-07a.mp3' },
        { shouldPlay: true, volume: 0.4 }
      );
      setTimeout(() => sound.unloadAsync(), 3000);
    } catch (e) {}
  };

  const skipRest = () => {
    clearInterval(restRef.current);
    setRestActive(false);
    setRestTimer(0);
  };

  const nextExercise = () => {
    const next = currentIndex + 1;
    setCurrentIndex(next);
    initSets(exercises[next]);
  };

  const prevExercise = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      initSets(exercises[prev]);
    }
  };

  const finishSession = () => {
    clearInterval(sessionRef.current);
    clearInterval(restRef.current);
    Alert.alert(
      '🎉 Sesion completada!',
      `Tiempo: ${formatTime(sessionTime)}\nSeries completadas: ${completedSets}`,
      [{ text: 'Ver resumen', onPress: () => router.back() }]
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const current = exercises[currentIndex];
  const allSetsDone = setLogs.every(s => s.done);
  const muscleColors: Record<string, string> = {
    Pecho: Colors.muscle.pecho, Espalda: Colors.muscle.espalda,
    Piernas: Colors.muscle.piernas, Hombros: Colors.muscle.hombros,
    Brazos: Colors.muscle.brazos, Core: Colors.muscle.core, Cardio: Colors.muscle.cardio,
  };

  if (!current) return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Cargando rutina...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header sesion */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => Alert.alert('Salir', 'Seguro que quieres salir del entrenamiento?', [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => router.back() }
        ])}>
          <Text style={styles.exitBtn}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{routineName}</Text>
          <Text style={styles.headerTime}>⏱ {formatTime(sessionTime)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerProgress}>{currentIndex + 1}/{exercises.length}</Text>
          <Text style={styles.headerSets}>{completedSets} series</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentIndex) / exercises.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* Ejercicio actual */}
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseTop}>
            <View style={[styles.muscleBadge, { backgroundColor: muscleColors[current.muscle_group] || Colors.border }]}>
              <Text style={styles.muscleBadgeText}>{current.muscle_group || 'General'}</Text>
            </View>
            <Text style={styles.exerciseNum}>Ejercicio {currentIndex + 1}</Text>
          </View>
          <Text style={styles.exerciseName}>{current.name}</Text>
          <Text style={styles.exerciseMeta}>{current.sets} series · {current.reps} reps · {current.weight}kg</Text>
        </View>

        {/* Timer de descanso */}
        {restActive && (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>😮‍💨 Descanso</Text>
            <Text style={styles.restTimer}>{restTimer}s</Text>
            <TouchableOpacity style={styles.skipBtn} onPress={skipRest}>
              <Text style={styles.skipBtnText}>Saltar descanso →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sets */}
        <Text style={styles.setsTitle}>Series</Text>
        {setLogs.map((log, i) => (
          <View key={i} style={[styles.setRow, log.done && styles.setRowDone]}>
            <View style={styles.setNum}>
              <Text style={styles.setNumText}>{log.setNumber}</Text>
            </View>
            <View style={styles.setInputs}>
              <View style={styles.setInputGroup}>
                <Text style={styles.setInputLabel}>Reps</Text>
                <TextInput
                  style={[styles.setInput, log.done && styles.setInputDone]}
                  value={log.reps}
                  onChangeText={v => { const u = [...setLogs]; u[i].reps = v; setSetLogs(u); }}
                  keyboardType="numeric"
                  editable={!log.done}
                />
              </View>
              <View style={styles.setInputGroup}>
                <Text style={styles.setInputLabel}>Peso (kg)</Text>
                <TextInput
                  style={[styles.setInput, log.done && styles.setInputDone]}
                  value={log.weight}
                  onChangeText={v => { const u = [...setLogs]; u[i].weight = v; setSetLogs(u); }}
                  keyboardType="numeric"
                  editable={!log.done}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.setDoneBtn, log.done && styles.setDoneBtnActive]}
              onPress={() => !log.done && completeSet(i)}
              disabled={log.done}
            >
              <Text style={styles.setDoneBtnText}>{log.done ? '✓' : '○'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Navegacion ejercicios */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={prevExercise}
            disabled={currentIndex === 0}
          >
            <Text style={styles.navBtnText}>← Anterior</Text>
          </TouchableOpacity>
          {currentIndex < exercises.length - 1 ? (
            <TouchableOpacity style={styles.navBtnNext} onPress={nextExercise}>
              <Text style={styles.navBtnNextText}>Siguiente →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.finishBtn} onPress={() => setShowFinish(true)}>
              <Text style={styles.finishBtnText}>Terminar 🎉</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de todos los ejercicios */}
        <Text style={styles.setsTitle}>Todos los ejercicios</Text>
        {exercises.map((ex, i) => (
          <TouchableOpacity key={ex.id} style={[styles.exListRow, i === currentIndex && styles.exListRowActive]} onPress={() => { setCurrentIndex(i); initSets(ex); }}>
            <View style={[styles.exListNum, i === currentIndex && styles.exListNumActive]}>
              <Text style={styles.exListNumText}>{i + 1}</Text>
            </View>
            <Text style={[styles.exListName, i === currentIndex && styles.exListNameActive]}>{ex.name}</Text>
            <Text style={styles.exListMeta}>{ex.sets}x{ex.reps}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal finalizar */}
      <Modal visible={showFinish} transparent animationType="fade">
        <View style={styles.finishOverlay}>
          <View style={styles.finishBox}>
            <Text style={styles.finishEmoji}>🎉</Text>
            <Text style={styles.finishTitle}>Entrenamiento completado!</Text>
            <View style={styles.finishStats}>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatVal}>{formatTime(sessionTime)}</Text>
                <Text style={styles.finishStatLabel}>Tiempo total</Text>
              </View>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatVal}>{completedSets}</Text>
                <Text style={styles.finishStatLabel}>Series hechas</Text>
              </View>
              <View style={styles.finishStat}>
                <Text style={styles.finishStatVal}>{exercises.length}</Text>
                <Text style={styles.finishStatLabel}>Ejercicios</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.finishBtnModal} onPress={finishSession}>
              <Text style={styles.finishBtnModalText}>Ver mis rutinas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: Colors.surface },
  exitBtn: { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  headerTime: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  headerRight: { alignItems: 'flex-end' },
  headerProgress: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  headerSets: { fontSize: 12, color: Colors.textSecondary },
  progressBar: { height: 4, backgroundColor: Colors.border },
  progressFill: { height: 4, backgroundColor: Colors.primary },
  exerciseCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  exerciseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  muscleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  muscleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  exerciseNum: { fontSize: 12, color: Colors.textMuted },
  exerciseName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  exerciseMeta: { fontSize: 14, color: Colors.textSecondary },
  restCard: { backgroundColor: Colors.accent + '22', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.accent },
  restTitle: { fontSize: 16, fontWeight: '700', color: Colors.accent, marginBottom: 8 },
  restTimer: { fontSize: 48, fontWeight: '800', color: Colors.accent, marginBottom: 8 },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.accent, borderRadius: 20 },
  skipBtnText: { color: '#fff', fontWeight: '700' },
  setsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12, marginTop: 8 },
  setRow: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  setRowDone: { backgroundColor: Colors.secondary + '11', borderWidth: 1, borderColor: Colors.secondary },
  setNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  setNumText: { fontWeight: '800', color: Colors.textPrimary },
  setInputs: { flex: 1, flexDirection: 'row', gap: 8 },
  setInputGroup: { flex: 1 },
  setInputLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  setInput: { backgroundColor: Colors.surface, borderRadius: 8, padding: 8, color: Colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: Colors.border },
  setInputDone: { backgroundColor: Colors.secondary + '22', borderColor: Colors.secondary, color: Colors.secondary },
  setDoneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  setDoneBtnActive: { backgroundColor: Colors.secondary },
  setDoneBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 24 },
  navBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: Colors.textSecondary, fontWeight: '700' },
  navBtnNext: { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  navBtnNextText: { color: '#fff', fontWeight: '700' },
  finishBtn: { flex: 1, backgroundColor: Colors.secondary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  finishBtnText: { color: '#fff', fontWeight: '700' },
  exListRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: Colors.card, gap: 12 },
  exListRowActive: { backgroundColor: Colors.primary + '22', borderWidth: 1, borderColor: Colors.primary },
  exListNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  exListNumActive: { backgroundColor: Colors.primary },
  exListNumText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  exListName: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  exListNameActive: { color: Colors.primary, fontWeight: '700' },
  exListMeta: { fontSize: 12, color: Colors.textMuted },
  finishOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  finishBox: { backgroundColor: Colors.surface, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24, textAlign: 'center' },
  finishStats: { flexDirection: 'row', gap: 20, marginBottom: 28 },
  finishStat: { alignItems: 'center' },
  finishStatVal: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  finishStatLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  finishBtnModal: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center' },
  finishBtnModalText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});