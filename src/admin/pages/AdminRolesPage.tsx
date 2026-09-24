import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit2,
  Lock,
  Key,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { Role, Permission } from '../types';

interface AdminRolesPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminRolesPage: React.FC<AdminRolesPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formRoleId, setFormRoleId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissionKeys, setFormPermissionKeys] = useState<string[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const canWrite = hasPermission('admin.roles.write');

  const fetchRolesAndPermissions = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions'),
      ]);

      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();

      if (rolesRes.ok && rolesData.success) {
        setRoles(rolesData.roles || []);
        if (rolesData.roles && rolesData.roles.length > 0 && !selectedRole) {
          // Fetch full role details with permissions for first role
          fetchRoleDetails(rolesData.roles[0].id);
        }
      }
      if (permsRes.ok && permsData.success) {
        setPermissions(permsData.permissions || []);
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleDetails = async (roleId: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedRole(data.role);
      }
    } catch {}
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormRoleId('');
    setFormName('');
    setFormDescription('');
    setFormPermissionKeys(['dashboard.read']);
    setModalError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setIsEditing(true);
    setFormRoleId(role.id);
    setFormName(role.name);
    setFormDescription(role.description || '');
    setFormPermissionKeys(role.permissions?.map((p) => p.key) || []);
    setModalError(null);
    setModalOpen(true);
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      const url = isEditing ? `/api/admin/roles/${formRoleId}` : '/api/admin/roles';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          permissionKeys: formPermissionKeys,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setModalOpen(false);
        setSuccess(`Role ${data.role.name} ${isEditing ? 'updated' : 'created'} successfully.`);
        fetchRolesAndPermissions();
        fetchRoleDetails(data.role.id);
      } else {
        setModalError(data.error?.message || 'Failed to save role.');
      }
    } catch {
      setModalError('Network communication error.');
    } finally {
      setModalLoading(false);
    }
  };

  // Group permissions by category
  const groupedPermissions: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!groupedPermissions[p.category]) {
      groupedPermissions[p.category] = [];
    }
    groupedPermissions[p.category].push(p);
  }

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Roles & Permissions"
      subtitle="Role-based access control, system roles, and granular authorization policies"
      actions={
        canWrite && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Role</span>
          </button>
        )
      }
    >
      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Main 2-column layout: Left column roles list, Right column selected role details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Available Roles</h4>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Loading roles...</div>
          ) : (
            roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              const isSuper = r.name === 'SUPER_ADMIN';

              return (
                <div
                  key={r.id}
                  onClick={() => fetchRoleDetails(r.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{r.name}</span>
                      {r.isSystem ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                          System
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Custom
                        </span>
                      )}
                    </div>
                    {canWrite && !isSuper && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(r);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{r.description || 'No description provided.'}</p>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{r.userCount || 0} Admins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" />
                      <span>{isSuper ? 'Wildcard (All)' : `${r.permissionCount || 0} Perms`}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Role Permissions Details (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {selectedRole ? (
              <div>
                <div className="flex items-start justify-between border-b border-zinc-800 pb-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{selectedRole.name}</h3>
                      {selectedRole.name === 'SUPER_ADMIN' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          Root Access
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{selectedRole.description}</p>
                  </div>
                  {canWrite && selectedRole.name !== 'SUPER_ADMIN' && (
                    <button
                      onClick={() => handleOpenEdit(selectedRole)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                  )}
                </div>

                {/* Permissions Breakdown by Category */}
                <div className="space-y-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Assigned Permissions ({selectedRole.name === 'SUPER_ADMIN' ? 'All System Keys' : selectedRole.permissions?.length || 0})
                  </h4>

                  {Object.entries(groupedPermissions).map(([category, catPerms]) => {
                    return (
                      <div key={category} className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4">
                        <p className="text-xs font-bold text-white mb-2.5 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{category}</span>
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {catPerms.map((perm) => {
                            const isAssigned =
                              selectedRole.name === 'SUPER_ADMIN' ||
                              selectedRole.permissions?.some((p) => p.key === perm.key);

                            return (
                              <div
                                key={perm.id}
                                className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${
                                  isAssigned
                                    ? 'bg-blue-600/10 border-blue-500/20 text-white'
                                    : 'bg-zinc-900/30 border-zinc-800/40 text-zinc-500 opacity-60'
                                }`}
                              >
                                <span className={`mt-0.5 ${isAssigned ? 'text-blue-400' : 'text-zinc-600'}`}>
                                  {isAssigned ? <Check className="w-3.5 h-3.5" /> : '•'}
                                </span>
                                <div>
                                  <p className="font-mono text-[11px] font-semibold">{perm.key}</p>
                                  <p className="text-[10px] text-zinc-400">{perm.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-xs text-zinc-500">Select a role to inspect permissions.</div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE / EDIT ROLE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-base font-bold text-white mb-1">{isEditing ? 'Configure Role' : 'Create Role'}</h3>
            <p className="text-xs text-zinc-400 mb-4">Define role metadata and assign granular permission keys</p>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRole} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block font-medium text-zinc-300 mb-1">Role Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. AUDIT_OFFICER"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Role responsibilities and operational scope"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium text-zinc-300">Grant Granular Permissions</label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormPermissionKeys(permissions.map((p) => p.key))}
                      className="text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setFormPermissionKeys([])}
                      className="text-zinc-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                  {Object.entries(groupedPermissions).map(([category, catPerms]) => (
                    <div key={category} className="space-y-1.5">
                      <p className="font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">{category}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catPerms.map((perm) => {
                          const isChecked = formPermissionKeys.includes(perm.key);
                          return (
                            <label
                              key={perm.id}
                              className={`p-2 rounded-lg border cursor-pointer flex items-start gap-2 transition-all ${
                                isChecked
                                  ? 'bg-blue-600/15 border-blue-500/30 text-white'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setFormPermissionKeys([...formPermissionKeys, perm.key]);
                                  else setFormPermissionKeys(formPermissionKeys.filter((k) => k !== perm.key));
                                }}
                                className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
                              />
                              <div className="overflow-hidden">
                                <p className="font-mono text-[11px] font-medium leading-none">{perm.key}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{perm.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditing ? 'Save Changes' : 'Create Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
