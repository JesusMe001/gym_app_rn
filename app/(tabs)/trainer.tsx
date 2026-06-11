import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { getDb } from '../../src/db/connection';

interface Client {
  id: number;
  name: string;
  username: string;
  gender: string;
  age: number;
  height: number;
  current_weight: number;
  goal: string;
  totalRoutines: number;
  status: string;
  relation_id: number;
}

interface ClientRoutine {
  id: number;
  name: string;
  exercise_count: number;
}

interface ClientStats {
  totalRoutines: number;
  totalExercises: number;
  totalNutritionLogs: number;
  totalBodyStats: number;
  lastWeight: number | null;
  lastBodyFat: number | null;
  todayKcal: number;
}

interface SearchUser {
  id: number;
  name: string;
  username: string;
  hasInvitation: boolean;
  isClient: boolean;
}

export default function TrainerPanel() {
  const { user } = useAuthStore();
  const [activeClients, setActiveClients] = useState<Client[]>([]);
  const [inactiveClients, setInactiveClients] = useState<Client[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientRoutines, setClientRoutines] = useState<ClientRoutine[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [showAssignRoutine, setShowAssignRoutine] = useState(false);
  const [myRoutines, setMyRoutines] = useState<ClientRoutine[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'invitations'>('active');

  const today = new Date().toISOString().split('T')[0];

  const loadClients = useCallback(() => {
    if (!user) return;
    const db = getDb();
    const active = db.getAllSync(`
      SELECT u.id, u.name, u.username, u.gender, u.age, u.height, u.current_weight, u.goal,
        tc.id as relation_id, tc.status,
        (SELECT COUNT(*) FROM routines r WHERE r.user_id = u.id) as totalRoutines
      FROM trainer_clients tc JOIN users u ON tc.client_id = u.id
      WHERE tc.trainer_id = ? AND tc.status = 'active' ORDER BY u.name
    `, [user.id]) as Client[];
    setActiveClients(active);

    const inactive = db.getAllSync(`
      SELECT u.id, u.name, u.username, u.gender, u.age, u.height, u.current_weight, u.goal,
        tc.id as relation_id, tc.status,
        (SELECT COUNT(*) FROM routines r WHERE r.user_id = u.id) as totalRoutines
      FROM trainer_clients tc JOIN users u ON tc.client_id = u.id
      WHERE tc.trainer_id = ? AND tc.status = 'inactive' ORDER BY u.name
    `, [user.id]) as Client[];
    setInactiveClients(inactive);

    const invitations = db.getAllSync(`
      SELECT i.id, i.status, u.name, u.username
      FROM invitations i JOIN users u ON i.client_id = u.id
      WHERE i.trainer_id = ? AND i.status = 'pending' ORDER BY i.created_at DESC
    `, [user.id]) as any[];
    setPendingInvitations(invitations);
  }, [user]);

  const loadMyRoutines = useCallback(() => {
    if (!user) return;
    const rows = getDb().getAllSync(`
      SELECT r.id, r.name, (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count
      FROM routines r WHERE r.user_id = ?
    `, [user.id]) as ClientRoutine[];
    setMyRoutines(rows);
  }, [user]);

  useEffect(() => { loadClients(); loadMyRoutines(); }, [loadClients, loadMyRoutines]);

  const searchUsers = (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !user) { setSearchResults([]); return; }
    const db = getDb();
    const results = db.getAllSync(`
      SELECT u.id, u.name, u.username,
        CASE WHEN EXISTS(SELECT 1 FROM invitations i WHERE i.trainer_id = ? AND i.client_id = u.id AND i.status = 'pending') THEN 1 ELSE 0 END as hasInvitation,
        CASE WHEN EXISTS(SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = ? AND tc.client_id = u.id AND tc.status = 'active') THEN 1 ELSE 0 END as isClient
      FROM users u WHERE u.role = 'user' AND u.id != ?
        AND (u.name LIKE ? OR u.username LIKE ?)
      LIMIT 10
    `, [user.id, user.id, user.id, `%${query}%`, `%${query}%`]) as SearchUser[];
    setSearchResults(results);
  };

  const sendInvitation = (clientId: number, clientName: string) => {
    const db = getDb();
    const existing = db.getFirstSync('SELECT id FROM invitations WHERE trainer_id = ? AND client_id = ? AND status = ?', [user!.id, clientId, 'pending']);
    if (existing) { Alert.alert('Ya enviada', 'Ya tienes una invitacion pendiente con este usuario'); return; }
    db.runSync('INSERT INTO invitations (trainer_id, client_id, status) VALUES (?, ?, ?)', [user!.id, clientId, 'pending']);
    loadClients();
    searchUsers(searchQuery);
    Alert.alert('Invitacion enviada', `${clientName} recibira tu invitacion para ser tu cliente.`);
  };

  const cancelInvitation = (invitationId: number) => {
    getDb().runSync('DELETE FROM invitations WHERE id = ?', [invitationId]);
    loadClients();
  };

  const createAndConnectClient = () => {
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) { Alert.alert('Error', 'Todos los campos son obligatorios'); return; }
    const db = getDb();
    const existing = db.getFirstSync('SELECT id FROM users WHERE username = ?', [newUsername.trim().toLowerCase()]);
    if (existing) { Alert.alert('Error', 'Ese usuario ya existe'); return; }
    const result = db.runSync('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [newUsername.trim().toLowerCase(), newPassword, newName.trim(), 'user']);
    db.runSync('INSERT INTO trainer_clients (trainer_id, client_id, status) VALUES (?, ?, ?)', [user!.id, result.lastInsertRowId, 'active']);
    setNewName(''); setNewUsername(''); setNewPassword('');
    setShowAddClient(false);
    loadClients();
    Alert.alert('Cliente creado', `${newName} fue agregado exitosamente.`);
  };

  const disconnectClient = (client: Client) => {
    Alert.alert('Desconectar', `Seguro que quieres desconectar a ${client.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: () => {
        getDb().runSync('UPDATE trainer_clients SET status = ? WHERE id = ?', ['inactive', client.relation_id]);
        setShowClientDetail(false);
        loadClients();
      }}
    ]);
  };

  const reconnectClient = (client: Client) => {
    getDb().runSync('UPDATE trainer_clients SET status = ? WHERE id = ?', ['active', client.relation_id]);
    loadClients();
  };

  const openClient = (client: Client) => {
    setSelectedClient(client);
    const db = getDb();
    const rows = db.getAllSync(`SELECT r.id, r.name, (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count FROM routines r WHERE r.user_id = ?`, [client.id]) as ClientRoutine[];
    setClientRoutines(rows);
    setShowClientDetail(true);
  };

  const openClientStats = (client: Client) => {
    const db = getDb();
    const routines = db.getFirstSync('SELECT COUNT(*) as c FROM routines WHERE user_id = ?', [client.id]) as { c: number };
    const exercises = db.getFirstSync('SELECT COUNT(*) as c FROM exercises e JOIN routines r ON e.routine_id = r.id WHERE r.user_id = ?', [client.id]) as { c: number };
    const nutrition = db.getFirstSync('SELECT COUNT(*) as c FROM nutrition_logs WHERE user_id = ?', [client.id]) as { c: number };
    const bodyStats = db.getFirstSync('SELECT COUNT(*) as c FROM body_stats WHERE user_id = ?', [client.id]) as { c: number };
    const lastStat = db.getFirstSync('SELECT weight, body_fat FROM body_stats WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1', [client.id]) as { weight: number; body_fat: number } | null;
    const todayKcal = db.getFirstSync(`SELECT COALESCE(SUM(calories),0) as c FROM nutrition_logs WHERE user_id = ? AND date(logged_at) = ?`, [client.id, today]) as { c: number };
    setClientStats({
      totalRoutines: routines?.c || 0,
      totalExercises: exercises?.c || 0,
      totalNutritionLogs: nutrition?.c || 0,
      totalBodyStats: bodyStats?.c || 0,
      lastWeight: lastStat?.weight || null,
      lastBodyFat: lastStat?.body_fat || null,
      todayKcal: Math.round(todayKcal?.c || 0),
    });
    setSelectedClient(client);
    setShowStats(true);
  };

  const assignRoutineToClient = (routineId: number, routineName: string) => {
    if (!selectedClient) return;
    const db = getDb();
    const exercises = db.getAllSync('SELECT * FROM exercises WHERE routine_id = ?', [routineId]) as any[];
    const newRoutine = db.runSync('INSERT INTO routines (user_id, name, description) VALUES (?, ?, ?)', [selectedClient.id, routineName + ' (entrenador)', 'Asignada por tu entrenador']);
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      db.runSync('INSERT INTO exercises (routine_id, name, muscle_group, sets, reps, weight, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)', [newRoutine.lastInsertRowId, ex.name, ex.muscle_group, ex.sets, ex.reps, ex.weight, i]);
    }
    const rows = db.getAllSync(`SELECT r.id, r.name, (SELECT COUNT(*) FROM exercises e WHERE e.routine_id = r.id) as exercise_count FROM routines r WHERE r.user_id = ?`, [selectedClient.id]) as ClientRoutine[];
    setClientRoutines(rows);
    setShowAssignRoutine(false);
    loadClients();
    Alert.alert('Rutina asignada', `"${routineName}" fue asignada a ${selectedClient.name}.`);
  };

  const currentClients = activeTab === 'active' ? activeClients : activeTab === 'inactive' ? inactiveClients : [];

  if (user?.role !== 'trainer' && user?.role !== 'admin') {
    return (
      <View style={styles.noAccess}>
        <Text style={styles.noAccessEmoji}>🔒</Text>
        <Text style={styles.noAccessTitle}>Acceso restringido</Text>
        <Text style={styles.noAccessSub}>Esta seccion es solo para entrenadores</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel Entrenador</Text>
          <Text style={styles.headerSub}>{activeClients.length} clientes activos</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.searchBtn} onPress={() => { setSearchQuery(''); setSearchResults([]); setShowSearch(true); }}>
            <Text style={styles.searchBtnText}>🔍 Buscar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddClient(true)}>
            <Text style={styles.addBtnText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{activeClients.length}</Text><Text style={styles.statLabel}>Activos</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{inactiveClients.length}</Text><Text style={styles.statLabel}>Inactivos</Text></View>
        <View style={styles.statCard}><Text style={[styles.statNum, { color: Colors.warning }]}>{pendingInvitations.length}</Text><Text style={styles.statLabel}>Invitaciones</Text></View>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'active' && styles.tabActive]} onPress={() => setActiveTab('active')}>
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Activos ({activeClients.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'inactive' && styles.tabActive]} onPress={() => setActiveTab('inactive')}>
          <Text style={[styles.tabText, activeTab === 'inactive' && styles.tabTextActive]}>Inactivos ({inactiveClients.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'invitations' && styles.tabActive]} onPress={() => setActiveTab('invitations')}>
          <Text style={[styles.tabText, activeTab === 'invitations' && styles.tabTextActive]}>Enviadas ({pendingInvitations.length})</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'invitations' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {pendingInvitations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📨</Text>
              <Text style={styles.emptyTitle}>Sin invitaciones pendientes</Text>
              <Text style={styles.emptySub}>Busca usuarios para invitarlos</Text>
            </View>
          ) : pendingInvitations.map(inv => (
            <View key={inv.id} style={styles.invitationCard}>
              <View style={styles.invAvatar}><Text style={styles.invAvatarText}>{inv.name.charAt(0)}</Text></View>
              <View style={styles.invInfo}>
                <Text style={styles.invName}>{inv.name}</Text>
                <Text style={styles.invUsername}>@{inv.username}</Text>
                <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pendiente</Text></View>
              </View>
              <TouchableOpacity style={styles.cancelInvBtn} onPress={() => cancelInvitation(inv.id)}>
                <Text style={styles.cancelInvBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : currentClients.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{activeTab === 'active' ? '👥' : '💤'}</Text>
          <Text style={styles.emptyTitle}>{activeTab === 'active' ? 'Sin clientes activos' : 'Sin clientes inactivos'}</Text>
          <Text style={styles.emptySub}>{activeTab === 'active' ? 'Busca usuarios para invitarlos' : 'Los desconectados apareceran aqui'}</Text>
          {activeTab === 'active' && <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddClient(true)}><Text style={styles.emptyBtnText}>+ Crear cliente</Text></TouchableOpacity>}
        </View>
      ) : (
        <FlatList
          data={currentClients}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.clientCard, activeTab === 'inactive' && styles.clientCardInactive]} onPress={() => activeTab === 'active' ? openClient(item) : null}>
              <View style={[styles.clientAvatar, activeTab === 'inactive' && styles.clientAvatarInactive]}>
                <Text style={styles.clientAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientUsername}>@{item.username}</Text>
                <Text style={styles.clientMeta}>{item.goal || 'Sin objetivo'} · {item.totalRoutines} rutinas</Text>
              </View>
              {activeTab === 'inactive' ? (
                <TouchableOpacity style={styles.reconnectBtn} onPress={() => reconnectClient(item)}>
                  <Text style={styles.reconnectBtnText}>Reconectar</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.clientActions}>
                  <TouchableOpacity onPress={() => openClientStats(item)} style={styles.statsIconBtn}>
                    <Text style={styles.statsIcon}>📊</Text>
                  </TouchableOpacity>
                  <Text style={styles.clientArrow}>›</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal buscar usuario */}
      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Buscar Usuario</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre o @usuario..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={searchUsers}
              autoFocus
            />
            {searchResults.length === 0 && searchQuery.length > 0 && (
              <Text style={styles.noItems}>Sin resultados para "{searchQuery}"</Text>
            )}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 350 }}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userUsername}>@{item.username}</Text>
                  </View>
                  {item.isClient ? (
                    <View style={styles.alreadyClientBadge}>
                      <Text style={styles.alreadyClientText}>Ya es cliente</Text>
                    </View>
                  ) : item.hasInvitation ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Invitado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.inviteBtn} onPress={() => sendInvitation(item.id, item.name)}>
                      <Text style={styles.inviteBtnText}>Invitar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowSearch(false)}>
              <Text style={styles.btnCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal estadisticas cliente */}
      <Modal visible={showStats} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📊 {selectedClient?.name}</Text>
            <Text style={styles.modalSub}>Estadisticas del cliente</Text>
            {clientStats && (
              <View>
                <View style={styles.statsGrid}>
                  <View style={[styles.statGridCard, { borderTopColor: Colors.primary }]}>
                    <Text style={styles.statGridNum}>{clientStats.totalRoutines}</Text>
                    <Text style={styles.statGridLabel}>Rutinas</Text>
                  </View>
                  <View style={[styles.statGridCard, { borderTopColor: Colors.accent }]}>
                    <Text style={styles.statGridNum}>{clientStats.totalExercises}</Text>
                    <Text style={styles.statGridLabel}>Ejercicios</Text>
                  </View>
                  <View style={[styles.statGridCard, { borderTopColor: Colors.secondary }]}>
                    <Text style={styles.statGridNum}>{clientStats.totalNutritionLogs}</Text>
                    <Text style={styles.statGridLabel}>Comidas</Text>
                  </View>
                  <View style={[styles.statGridCard, { borderTopColor: Colors.warning }]}>
                    <Text style={styles.statGridNum}>{clientStats.todayKcal}</Text>
                    <Text style={styles.statGridLabel}>Kcal hoy</Text>
                  </View>
                </View>
                {clientStats.lastWeight && (
                  <View style={styles.weightCard}>
                    <View style={styles.weightItem}>
                      <Text style={styles.weightVal}>{clientStats.lastWeight} kg</Text>
                      <Text style={styles.weightLabel}>Ultimo peso</Text>
                    </View>
                    {clientStats.lastBodyFat && clientStats.lastBodyFat > 0 && (
                      <View style={styles.weightItem}>
                        <Text style={[styles.weightVal, { color: Colors.warning }]}>{clientStats.lastBodyFat}%</Text>
                        <Text style={styles.weightLabel}>Grasa corporal</Text>
                      </View>
                    )}
                  </View>
                )}
                {!clientStats.lastWeight && (
                  <Text style={styles.noItems}>Sin mediciones corporales registradas</Text>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowStats(false)}>
              <Text style={styles.btnCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal crear cliente */}
      <Modal visible={showAddClient} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo Cliente</Text>
            <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={Colors.textMuted} value={newName} onChangeText={setNewName} />
            <TextInput style={styles.input} placeholder="Usuario" placeholderTextColor={Colors.textMuted} value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Contrasena temporal" placeholderTextColor={Colors.textMuted} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <TouchableOpacity style={styles.btnPrimary} onPress={createAndConnectClient}>
              <Text style={styles.btnPrimaryText}>Crear y conectar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAddClient(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal detalle cliente */}
      <Modal visible={showClientDetail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>{selectedClient?.name}</Text>
              <Text style={styles.clientDetailUser}>@{selectedClient?.username}</Text>
              <View style={styles.physicalRow}>
                {selectedClient?.age > 0 && <View style={styles.physicalItem}><Text style={styles.physicalVal}>{selectedClient.age}</Text><Text style={styles.physicalLabel}>anos</Text></View>}
                {selectedClient?.height > 0 && <View style={styles.physicalItem}><Text style={styles.physicalVal}>{selectedClient.height}</Text><Text style={styles.physicalLabel}>cm</Text></View>}
                {selectedClient?.current_weight > 0 && <View style={styles.physicalItem}><Text style={styles.physicalVal}>{selectedClient.current_weight}</Text><Text style={styles.physicalLabel}>kg</Text></View>}
              </View>
              {selectedClient?.goal && <View style={styles.goalChip}><Text style={styles.goalChipText}>🎯 {selectedClient.goal}</Text></View>}
              <Text style={styles.sectionTitle}>Rutinas ({clientRoutines.length})</Text>
              {clientRoutines.length === 0 ? <Text style={styles.noItems}>Sin rutinas asignadas</Text> : clientRoutines.map(r => (
                <View key={r.id} style={styles.routineRow}>
                  <Text style={styles.routineName}>{r.name}</Text>
                  <Text style={styles.routineMeta}>{r.exercise_count} ejercicios</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.btnAccent} onPress={() => setShowAssignRoutine(true)}>
                <Text style={styles.btnAccentText}>📋 Asignar rutina</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setShowClientDetail(false); openClientStats(selectedClient!); }}>
                <Text style={styles.btnSecondaryText}>📊 Ver estadisticas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger} onPress={() => disconnectClient(selectedClient!)}>
                <Text style={styles.btnDangerText}>🔌 Desconectar cliente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowClientDetail(false)}>
                <Text style={styles.btnCancelText}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal asignar rutina */}
      <Modal visible={showAssignRoutine} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Asignar Rutina a {selectedClient?.name}</Text>
            {myRoutines.length === 0 ? <Text style={styles.noItems}>No tienes rutinas creadas</Text> : (
              <ScrollView style={{ maxHeight: 300 }}>
                {myRoutines.map(r => (
                  <TouchableOpacity key={r.id} style={styles.routineOption} onPress={() => assignRoutineToClient(r.id, r.name)}>
                    <Text style={styles.routineOptionName}>{r.name}</Text>
                    <Text style={styles.routineOptionMeta}>{r.exercise_count} ejercicios</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAssignRoutine(false)}>
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
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.background },
  noAccessEmoji: { fontSize: 64, marginBottom: 16 },
  noAccessTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  noAccessSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  searchBtn: { backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  clientCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: Colors.accent },
  clientCardInactive: { borderLeftColor: Colors.border, opacity: 0.7 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  clientAvatarInactive: { backgroundColor: Colors.textMuted },
  clientAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  clientUsername: { fontSize: 13, color: Colors.textSecondary },
  clientMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  clientActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsIconBtn: { padding: 4 },
  statsIcon: { fontSize: 20 },
  clientArrow: { fontSize: 22, color: Colors.textMuted },
  reconnectBtn: { backgroundColor: Colors.secondary + '22', borderWidth: 1, borderColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  reconnectBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  invitationCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: Colors.warning },
  invAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  invAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  invInfo: { flex: 1 },
  invName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  invUsername: { fontSize: 13, color: Colors.textSecondary },
  cancelInvBtn: { backgroundColor: Colors.error + '22', borderWidth: 1, borderColor: Colors.error, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  cancelInvBtnText: { color: Colors.error, fontWeight: '700', fontSize: 12 },
  pendingBadge: { backgroundColor: Colors.warning + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, alignSelf: 'flex-start' },
  pendingBadgeText: { color: Colors.warning, fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  input: { backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: Colors.textPrimary, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: { backgroundColor: Colors.accent + '22', borderWidth: 1, borderColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnSecondaryText: { color: Colors.accent, fontWeight: '700', fontSize: 15 },
  btnAccent: { backgroundColor: Colors.secondary + '22', borderWidth: 1, borderColor: Colors.secondary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnAccentText: { color: Colors.secondary, fontWeight: '700', fontSize: 15 },
  btnDanger: { backgroundColor: Colors.error + '22', borderWidth: 1, borderColor: Colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnDangerText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
  btnCancel: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  clientDetailUser: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  physicalRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 12 },
  physicalItem: { alignItems: 'center' },
  physicalVal: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  physicalLabel: { fontSize: 12, color: Colors.textSecondary },
  goalChip: { backgroundColor: Colors.primary + '22', borderRadius: 12, padding: 10, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  goalChipText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  noItems: { color: Colors.textMuted, textAlign: 'center', padding: 16 },
  routineRow: { backgroundColor: Colors.card, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  routineName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  routineMeta: { fontSize: 12, color: Colors.textSecondary },
  routineOption: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  routineOptionName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  routineOptionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  userUsername: { fontSize: 13, color: Colors.textSecondary },
  inviteBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  alreadyClientBadge: { backgroundColor: Colors.secondary + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  alreadyClientText: { color: Colors.secondary, fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statGridCard: { width: '47%', backgroundColor: Colors.card, borderRadius: 12, padding: 14, alignItems: 'center', borderTopWidth: 3 },
  statGridNum: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  statGridLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  weightCard: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-around' },
  weightItem: { alignItems: 'center' },
  weightVal: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  weightLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});