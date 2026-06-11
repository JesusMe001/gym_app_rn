import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

const GROQ_API_KEY = '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';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hasRoutine?: boolean;
  routineData?: ParsedRoutine;
}

interface ParsedExercise {
  name: string;
  sets: number;
  reps: number;
  muscle: string;
}

interface ParsedRoutine {
  name: string;
  exercises: ParsedExercise[];
}

const QUICK_QUESTIONS = [
  'Crea una rutina de pecho para hoy',
  'Cuantas proteinas necesito al dia?',
  'Que ejercicios son mejores para perder grasa?',
  'Crea una rutina completa de 5 dias',
  'Que comer antes de entrenar?',
  'Como mejorar mi recuperacion muscular?',
];

function parseRoutineFromText(text: string): ParsedRoutine | null {
  const lines = text.split('\n');
  const exercises: ParsedExercise[] = [];
  let routineName = 'Rutina AI';

  for (const line of lines) {
    const nameMatch = line.match(/rutina[:\s]+([^\n]+)/i);
    if (nameMatch) routineName = nameMatch[1].trim();

    const exMatch = line.match(/[-*•]\s*([^:(\n]+?)[\s:]*(\d+)\s*[xX×]\s*(\d+)/);
    if (exMatch) {
      exercises.push({
        name: exMatch[1].trim(),
        sets: parseInt(exMatch[2]),
        reps: parseInt(exMatch[3]),
        muscle: '',
      });
    }
  }

  if (exercises.length === 0) return null;
  return { name: routineName, exercises };
}

export default function AICoachScreen() {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hola ${user?.name}! 💪 Soy tu AI Coach personal. Puedo ayudarte con consejos de entrenamiento, nutricion y tambien CREAR rutinas directamente en tu app. Prueba diciendome: "Crea una rutina de pecho"`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingRoutine, setPendingRoutine] = useState<ParsedRoutine | null>(null);
  const [routineName, setRoutineName] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const buildSystemPrompt = () => {
    const profile = user ? `
Usuario: ${user.name}
Sexo: ${user.gender || 'no especificado'}
Edad: ${user.age || 'no especificada'}
Altura: ${user.height ? user.height + 'cm' : 'no especificada'}
Peso actual: ${user.current_weight ? user.current_weight + 'kg' : 'no especificado'}
Peso objetivo: ${user.goal_weight ? user.goal_weight + 'kg' : 'no especificado'}
Objetivo: ${user.goal || 'no especificado'}
Nivel de actividad: ${user.activity_level || 'no especificado'}
` : '';

    return `Eres un coach personal experto en fitness y nutricion. Tu nombre es GymCoach AI.
Responde SIEMPRE en español, de forma clara, motivadora y profesional.
Usa emojis ocasionalmente. Respuestas concisas de maximo 4 parrafos.

PRINCIPIOS CIENTIFICOS PARA RUTINAS (basados en meta-analisis y Jeff Nippard):

ESTRUCTURA:
- Hipertrofia: 3-4 ejercicios, 3-4 series, 8-12 reps, descanso 60-90s
- Fuerza: 3-4 ejercicios, 4-5 series, 3-6 reps, descanso 2-5min
- Resistencia: 2-3 ejercicios, 2-3 series, 15-20 reps, descanso 30-60s
- NUNCA mas de 4 ejercicios por grupo muscular por sesion
- Siempre: 1 compuesto principal + 2-3 accesorios de estiramiento maximo

EJERCICIOS CORRECTOS POR GRUPO (OBLIGATORIO usar solo estos):
- PECHO: Press banca, Press inclinado, Press declinado, Fly con mancuernas, Aperturas en polea, Fondos en paralelas
- ESPALDA: Dominadas, Jalones al pecho, Remo con barra, Remo con mancuerna, Remo en polea, Pullover
- HOMBROS: Press militar, Press Arnold, Elevaciones laterales, Pajaros, Face pulls
- BICEPS: Curl con barra, Curl con mancuernas, Curl predicador, Curl martillo, Curl en polea
- TRICEPS: Press frances, Fondos, Extension en polea, Patada de triceps, Press cerrado
- PIERNAS: Sentadilla, Prensa, Peso muerto rumano, Extension de cuadriceps, Curl femoral, Elevacion de gemelos, Hip thrust
- CORE: Plancha, Crunchs, Rueda abdominal, Elevacion de piernas, Cable crunch

PRINCIPIO DE ESTIRAMIENTO MAXIMO (Jeff Nippard):
- Priorizar ejercicios donde el musculo se estira al maximo bajo carga
- Pecho: fly con mancuernas > press plano para hipertrofia
- Biceps: curl predicador > curl de pie
- Triceps: press frances > extension en polea

Si el usuario no especifica objetivo, preguntar primero: hipertrofia, fuerza o resistencia

PERFIL DEL USUARIO:
${profile}

IMPORTANTE - CUANDO CREES RUTINAS:
- Usa SIEMPRE este formato exacto para los ejercicios: "- Nombre del ejercicio: NxM" (ejemplo: "- Press de banca: 4x10")
- Lista cada ejercicio en una linea separada con guion (-)
- Incluye series x repeticiones en formato NxM
- Al final pregunta si quiere guardar la rutina en la app`;
  };

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Lo siento, intenta de nuevo.';
      
      const parsedRoutine = parseRoutineFromText(reply);
      const aiMsg: Message = {
        role: 'assistant',
        content: reply,
        hasRoutine: !!parsedRoutine,
        routineData: parsedRoutine || undefined,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const openSaveModal = (routine: ParsedRoutine) => {
    setPendingRoutine(routine);
    setRoutineName(routine.name);
    setShowSaveModal(true);
  };

  const saveRoutine = () => {
    if (!pendingRoutine || !user) return;
    const db = getDb();
    
    const result = db.runSync(
      'INSERT INTO routines (user_id, name, description) VALUES (?, ?, ?)',
      [user.id, routineName, 'Creada por AI Coach']
    );
    const routineId = result.lastInsertRowId;

    for (let i = 0; i < pendingRoutine.exercises.length; i++) {
      const ex = pendingRoutine.exercises[i];
      db.runSync(
        'INSERT INTO exercises (routine_id, name, muscle_group, sets, reps, weight, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [routineId, ex.name, ex.muscle || 'General', ex.sets, ex.reps, 0, i]
      );
    }

    setShowSaveModal(false);
    setPendingRoutine(null);
    Alert.alert('✅ Rutina guardada', `"${routineName}" con ${pendingRoutine.exercises.length} ejercicios fue guardada en tus Rutinas.`);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>GymCoach AI</Text>
            <Text style={styles.headerSub}>Tu entrenador personal IA</Text>
          </View>
        </View>
        <View style={styles.onlineDot} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i}>
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              {msg.role === 'assistant' && <Text style={styles.bubbleLabel}>GymCoach AI</Text>}
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                {msg.content}
              </Text>
            </View>
            {msg.hasRoutine && msg.routineData && (
              <TouchableOpacity style={styles.saveRoutineBtn} onPress={() => openSaveModal(msg.routineData!)}>
                <Text style={styles.saveRoutineBtnText}>💾 Guardar esta rutina en mi app</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.bubbleAI]}>
            <Text style={styles.bubbleLabel}>GymCoach AI</Text>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        )}
      </ScrollView>

      {messages.length <= 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {QUICK_QUESTIONS.map((q, i) => (
            <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(q)}>
              <Text style={styles.quickBtnText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Pregunta a tu coach..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSaveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Guardar Rutina</Text>
            <Text style={styles.modalSub}>{pendingRoutine?.exercises.length} ejercicios detectados</Text>

            <Text style={styles.fieldLabel}>Nombre de la rutina</Text>
            <TextInput
              style={styles.modalInput}
              value={routineName}
              onChangeText={setRoutineName}
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.exercisePreview}>
              {pendingRoutine?.exercises.map((ex, i) => (
                <View key={i} style={styles.exercisePreviewRow}>
                  <Text style={styles.exercisePreviewNum}>{i + 1}</Text>
                  <Text style={styles.exercisePreviewName}>{ex.name}</Text>
                  <Text style={styles.exercisePreviewSets}>{ex.sets}x{ex.reps}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={saveRoutine}>
              <Text style={styles.btnPrimaryText}>💾 Guardar rutina</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowSaveModal(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textSecondary },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.secondary },
  messages: { flex: 1 },
  bubble: { maxWidth: '85%', marginBottom: 8, borderRadius: 16, padding: 14 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleAI: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderBottomLeftRadius: 4 },
  bubbleLabel: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI: { color: Colors.textPrimary },
  saveRoutineBtn: { alignSelf: 'flex-start', backgroundColor: Colors.secondary + '22', borderWidth: 1, borderColor: Colors.secondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, marginLeft: 4 },
  saveRoutineBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 14 },
  quickScroll: { maxHeight: 60, marginBottom: 8 },
  quickBtn: { backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  quickBtnText: { color: Colors.textSecondary, fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, maxHeight: 100 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  modalSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  modalInput: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  exercisePreview: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, marginBottom: 16 },
  exercisePreviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exercisePreviewNum: { fontSize: 12, color: Colors.textMuted, width: 24 },
  exercisePreviewName: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  exercisePreviewSets: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});