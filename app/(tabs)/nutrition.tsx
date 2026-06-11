import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

const CALORIE_NINJAS_KEY = '+mtqaLlFwjaJ6PoF7EVu8g==KIEjeuZmeb0R4Qf6';

interface FoodLog {
  id: number;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
  meal_type: string;
}

interface FoodResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size_g: number;
}

const MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'];

export default function NutritionScreen() {
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mealType, setMealType] = useState('almuerzo');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [grams, setGrams] = useState('100');
  const [manualMode, setManualMode] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const loadLogs = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const rows = db.getAllSync(
      `SELECT * FROM nutrition_logs WHERE user_id = ? AND date(logged_at) = ? ORDER BY logged_at DESC`,
      [user.id, today]
    ) as FoodLog[];
    setLogs(rows);
  }, [user, today]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totals = logs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein || 0),
    carbs: acc.carbs + (log.carbs || 0),
    fat: acc.fat + (log.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const searchFood = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(searchQuery)}`,
        { headers: { 'X-Api-Key': CALORIE_NINJAS_KEY } }
      );
      const data = await res.json();
      const results: FoodResult[] = (data.items || []).map((item: any) => ({
        name: item.name,
        calories: Math.round(item.calories),
        protein: Math.round(item.protein_g * 10) / 10,
        carbs: Math.round(item.carbohydrates_total_g * 10) / 10,
        fat: Math.round(item.fat_total_g * 10) / 10,
        serving_size_g: item.serving_size_g || 100,
      }));
      setSearchResults(results);
      if (results.length === 0) Alert.alert('Sin resultados', 'Prueba con otro nombre o usa modo manual');
    } catch (e) {
      Alert.alert('Error', 'No se pudo conectar. Usa modo manual.');
    } finally {
      setSearching(false);
    }
  };

  const selectFood = (food: FoodResult) => {
    setSelectedFood(food);
    setGrams(food.serving_size_g.toString());
    setSearchResults([]);
  };

  const calcMacro = (base: number, baseG: number, targetG: number) =>
    Math.round((base / baseG) * targetG * 10) / 10;

  const addFood = () => {
    if (manualMode) {
      if (!foodName.trim() || !calories.trim()) { Alert.alert('Error', 'Nombre y calorias son obligatorios'); return; }
      getDb().runSync(
        `INSERT INTO nutrition_logs (user_id, food_name, calories, protein, carbs, fat, grams, meal_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user!.id, foodName.trim(), parseFloat(calories), parseFloat(protein||'0'), parseFloat(carbs||'0'), parseFloat(fat||'0'), parseFloat(grams||'100'), mealType]
      );
    } else {
      if (!selectedFood) { Alert.alert('Error', 'Selecciona un alimento'); return; }
      const g = parseFloat(grams) || selectedFood.serving_size_g;
      const base = selectedFood.serving_size_g;
      getDb().runSync(
        `INSERT INTO nutrition_logs (user_id, food_name, calories, protein, carbs, fat, grams, meal_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user!.id, selectedFood.name, calcMacro(selectedFood.calories, base, g), calcMacro(selectedFood.protein, base, g), calcMacro(selectedFood.carbs, base, g), calcMacro(selectedFood.fat, base, g), g, mealType]
      );
    }
    setFoodName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    setGrams('100'); setSelectedFood(null); setSearchQuery('');
    setManualMode(false); setShowAdd(false);
    loadLogs();
  };

  const deleteLog = (id: number) => {
    Alert.alert('Eliminar', 'Eliminar este alimento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { getDb().runSync('DELETE FROM nutrition_logs WHERE id = ?', [id]); loadLogs(); }}
    ]);
  };

  const mealColors: Record<string, string> = {
    desayuno: Colors.warning, almuerzo: Colors.primary, cena: Colors.accent, snack: Colors.secondary,
  };

  const byMeal = MEAL_TYPES.map(type => ({
    type, items: logs.filter(l => l.meal_type === type),
  })).filter(m => m.items.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Hoy — {today}</Text>
        <View style={styles.macrosRow}>
          <View style={styles.macroCard}>
            <Text style={styles.macroValue}>{Math.round(totals.calories)}</Text>
            <Text style={styles.macroLabel}>Kcal</Text>
          </View>
          <View style={styles.macroCard}>
            <Text style={[styles.macroValue, { color: Colors.primary }]}>{Math.round(totals.protein)}g</Text>
            <Text style={styles.macroLabel}>Proteina</Text>
          </View>
          <View style={styles.macroCard}>
            <Text style={[styles.macroValue, { color: Colors.warning }]}>{Math.round(totals.carbs)}g</Text>
            <Text style={styles.macroLabel}>Carbos</Text>
          </View>
          <View style={styles.macroCard}>
            <Text style={[styles.macroValue, { color: Colors.accent }]}>{Math.round(totals.fat)}g</Text>
            <Text style={styles.macroLabel}>Grasa</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={styles.addBtnText}>+ Agregar alimento</Text>
      </TouchableOpacity>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🥗</Text>
          <Text style={styles.emptyTitle}>Sin registros hoy</Text>
          <Text style={styles.emptySub}>Registra tu primera comida del dia</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {byMeal.map(({ type, items }) => (
            <View key={type} style={styles.mealSection}>
              <View style={[styles.mealHeader, { borderLeftColor: mealColors[type] }]}>
                <Text style={styles.mealTitle}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                <Text style={styles.mealKcal}>{Math.round(items.reduce((a, i) => a + i.calories, 0))} kcal</Text>
              </View>
              {items.map(item => (
                <TouchableOpacity key={item.id} style={styles.foodRow} onLongPress={() => deleteLog(item.id)}>
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{item.food_name}</Text>
                    <Text style={styles.foodMeta}>{item.grams}g · P:{Math.round(item.protein)}g C:{Math.round(item.carbs)}g G:{Math.round(item.fat)}g</Text>
                  </View>
                  <Text style={styles.foodKcal}>{Math.round(item.calories)} kcal</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Agregar Alimento</Text>

              <Text style={styles.fieldLabel}>Tipo de comida</Text>
              <View style={styles.mealTypeRow}>
                {MEAL_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]} onPress={() => setMealType(t)}>
                    <Text style={[styles.mealTypeBtnText, mealType === t && styles.mealTypeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modeRow}>
                <TouchableOpacity style={[styles.modeBtn, !manualMode && styles.modeBtnActive]} onPress={() => setManualMode(false)}>
                  <Text style={[styles.modeBtnText, !manualMode && styles.modeBtnTextActive]}>🔍 Buscar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, manualMode && styles.modeBtnActive]} onPress={() => setManualMode(true)}>
                  <Text style={[styles.modeBtnText, manualMode && styles.modeBtnTextActive]}>✏️ Manual</Text>
                </TouchableOpacity>
              </View>

              {!manualMode ? (
                <View>
                  <View style={styles.searchRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Ej: 100g pollo a la plancha"
                      placeholderTextColor={Colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={searchFood}
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={searchFood}>
                      {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Buscar</Text>}
                    </TouchableOpacity>
                  </View>

                  {searchResults.length > 0 && (
                    <View style={styles.resultsList}>
                      {searchResults.map((r, i) => (
                        <TouchableOpacity key={i} style={[styles.resultItem, selectedFood?.name === r.name && styles.resultItemSelected]} onPress={() => selectFood(r)}>
                          <Text style={styles.resultName}>{r.name}</Text>
                          <Text style={styles.resultMacros}>{r.calories}kcal · P:{r.protein}g C:{r.carbs}g G:{r.fat}g</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {selectedFood && (
                    <View style={styles.selectedFood}>
                      <Text style={styles.selectedName}>{selectedFood.name}</Text>
                      <Text style={styles.selectedMacros}>{selectedFood.calories}kcal · P:{selectedFood.protein}g C:{selectedFood.carbs}g G:{selectedFood.fat}g</Text>
                      <Text style={styles.fieldLabel}>Gramos</Text>
                      <TextInput style={styles.input} placeholder="100" placeholderTextColor={Colors.textMuted} value={grams} onChangeText={setGrams} keyboardType="numeric" />
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <TextInput style={styles.input} placeholder="Nombre del alimento" placeholderTextColor={Colors.textMuted} value={foodName} onChangeText={setFoodName} />
                  <TextInput style={styles.input} placeholder="Calorias (kcal) *" placeholderTextColor={Colors.textMuted} value={calories} onChangeText={setCalories} keyboardType="numeric" />
                  <TextInput style={styles.input} placeholder="Gramos" placeholderTextColor={Colors.textMuted} value={grams} onChangeText={setGrams} keyboardType="numeric" />
                  <View style={styles.row}>
                    <TextInput style={[styles.input, styles.inputSmall]} placeholder="Proteina g" placeholderTextColor={Colors.textMuted} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                    <TextInput style={[styles.input, styles.inputSmall]} placeholder="Carbos g" placeholderTextColor={Colors.textMuted} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                    <TextInput style={[styles.input, styles.inputSmall]} placeholder="Grasa g" placeholderTextColor={Colors.textMuted} value={fat} onChangeText={setFat} keyboardType="numeric" />
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.btnPrimary} onPress={addFood}>
                <Text style={styles.btnPrimaryText}>Agregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setShowAdd(false); setSelectedFood(null); setSearchQuery(''); setSearchResults([]); setManualMode(false); }}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summary: { backgroundColor: Colors.surface, padding: 20 },
  summaryTitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12, fontWeight: '600' },
  macrosRow: { flexDirection: 'row', gap: 8 },
  macroCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  macroValue: { fontSize: 20, fontWeight: '800', color: Colors.secondary },
  macroLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  mealSection: { marginBottom: 20 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, paddingLeft: 12, marginBottom: 8 },
  mealTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  mealKcal: { fontSize: 14, color: Colors.textSecondary },
  foodRow: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  foodMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  foodKcal: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  mealTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  mealTypeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  mealTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  mealTypeBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  mealTypeBtnTextActive: { color: '#fff' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modeBtnActive: { backgroundColor: Colors.accent + '33', borderColor: Colors.accent },
  modeBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  modeBtnTextActive: { color: Colors.accent },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  resultsList: { backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  resultItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultItemSelected: { backgroundColor: Colors.secondary + '22' },
  resultName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  resultMacros: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  selectedFood: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  selectedName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4, textTransform: 'capitalize' },
  selectedMacros: { fontSize: 12, color: Colors.textSecondary },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 8 },
  inputSmall: { flex: 1 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
});