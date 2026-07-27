"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Shield, CheckSquare, Square, Save, Mail, UserCheck, Layers, RefreshCw, Key } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface UserProject {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  project: Project;
}

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  projects: UserProject[];
}

export default function UserProjectPermissionsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Selected user for editing assignments
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [assignedProjects, setAssignedProjects] = useState<Record<string, { enabled: boolean; role: string }>>({});

  // New User Modal / Form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>("");
  const [newFirstName, setNewFirstName] = useState<string>("");
  const [newLastName, setNewLastName] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newSystemRole, setNewSystemRole] = useState<string>("USER");
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [usersRes, projRes] = await Promise.all([
        api.admin.getUsers(),
        api.projects.getAll(),
      ]);

      const userList = usersRes.data.data || [];
      const projList = (projRes.data.data || []).filter((p: any) => p.status !== "PAUSED");

      setUsers(userList);
      setAllProjects(projList);

      if (userList.length > 0 && !selectedUser) {
        selectUserForEdit(userList[0], projList);
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Error al cargar la lista de usuarios y proyectos");
    } finally {
      setLoading(false);
    }
  };

  const selectUserForEdit = (user: UserItem, projectsList: Project[] = allProjects) => {
    setSelectedUser(user);
    const map: Record<string, { enabled: boolean; role: string }> = {};

    // Initialize all projects as disabled
    projectsList.forEach((p) => {
      map[p.id] = { enabled: false, role: "MEMBER" };
    });

    // Enable projects assigned to this user
    (user.projects || []).forEach((up) => {
      if (up.projectId) {
        map[up.projectId] = {
          enabled: true,
          role: (up.role || "MEMBER").toUpperCase(),
        };
      }
    });

    setAssignedProjects(map);
  };

  const handleToggleProject = (projectId: string) => {
    setAssignedProjects((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        enabled: !prev[projectId]?.enabled,
      },
    }));
  };

  const handleRoleChange = (projectId: string, newRole: string) => {
    setAssignedProjects((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        role: newRole,
      },
    }));
  };

  const handleSaveAssignments = async () => {
    if (!selectedUser) return;

    setSavingUserId(selectedUser.id);
    try {
      const assignments = Object.entries(assignedProjects)
        .filter(([_, value]) => value.enabled)
        .map(([projId, value]) => ({
          projectId: projId,
          role: value.role,
        }));

      const res = await api.admin.setUserProjects(selectedUser.id, assignments);
      const updatedUser = res.data.data;

      toast.success(`Permisos de proyecto actualizados para ${selectedUser.email}`);

      // Update local state list
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? updatedUser : u))
      );
      setSelectedUser(updatedUser);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || "Error guardando permisos de proyecto";
      toast.error(msg);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("El correo electrónico es requerido");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await api.admin.createUser({
        email: newEmail.trim(),
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        password: newPassword.trim() || undefined,
        role: newSystemRole,
      });

      toast.success(`Usuario ${newEmail} registrado exitosamente`);
      setShowAddModal(false);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewPassword("");

      // Reload users
      await fetchInitialData();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || "Error al crear usuario";
      toast.error(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/settings")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Gestión de Usuarios y Permisos por Proyecto
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Asigna a cada usuario el acceso a uno o varios proyectos específicos según su correo electrónico.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Registrar Nuevo Usuario
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User List Panel */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" />
                Usuarios Registrados ({users.length})
              </h2>
              <button
                onClick={fetchInitialData}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const assignedCount = u.projects?.length || 0;

                return (
                  <div
                    key={u.id}
                    onClick={() => selectUserForEdit(u)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500 shadow-xs"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {u.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {u.firstName || u.lastName
                          ? `${u.firstName} ${u.lastName}`.trim()
                          : "Sin nombre asignado"}
                        {u.role === "ADMIN" && (
                          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold rounded-full text-[10px]">
                            ADMIN MASTER
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 text-xs rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {assignedCount} {assignedCount === 1 ? "proyecto" : "proyectos"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Assignment Config Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            {selectedUser ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Asignación de Proyectos para {selectedUser.email}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Selecciona los proyectos que este usuario podrá visualizar e interactuar.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveAssignments}
                    disabled={savingUserId === selectedUser.id}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {savingUserId === selectedUser.id ? "Guardando..." : "Guardar Permisos"}
                  </button>
                </div>

                {/* Projects List with Checkboxes & Role Selection */}
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {allProjects.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No hay proyectos activos registrados en FINK.
                    </p>
                  ) : (
                    allProjects.map((p) => {
                      const state = assignedProjects[p.id] || { enabled: false, role: "MEMBER" };

                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            state.enabled
                              ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-700"
                              : "border-gray-200 dark:border-gray-700 opacity-75 hover:opacity-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleProject(p.id)}
                              className="text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform"
                            >
                              {state.enabled ? (
                                <CheckSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Square className="w-6 h-6 text-gray-400" />
                              )}
                            </button>

                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full inline-block"
                                  style={{ backgroundColor: p.color || "#3b82f6" }}
                                />
                                {p.name}
                                <span className="text-xs font-mono text-gray-400">({p.code})</span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {state.enabled ? "Acceso Permitido" : "Sin Acceso"}
                              </span>
                            </div>
                          </div>

                          {/* Role Selector per Project */}
                          {state.enabled && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-500">Permiso:</label>
                              <select
                                value={state.role}
                                onChange={(e) => handleRoleChange(p.id, e.target.value)}
                                className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="VIEWER">👁️ Solo Lectura (VIEWER)</option>
                                <option value="MEMBER">✏️ Editor / Miembro (MEMBER)</option>
                                <option value="MANAGER">⚙️ Gerente (MANAGER)</option>
                                <option value="OWNER">👑 Propietario (OWNER)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecciona un usuario de la lista de la izquierda para configurar sus proyectos autorizados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Agregar Nuevo Usuario */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Registrar Nuevo Usuario
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@aludra.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    placeholder="Juan"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    placeholder="Pérez"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Contraseña Inicial
                </label>
                <input
                  type="password"
                  placeholder="Por defecto: Fink2026*"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {creatingUser ? "Registrando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
