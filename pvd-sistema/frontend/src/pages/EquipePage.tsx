import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, KeyRound, UserCheck, UserX, X, Shield } from 'lucide-react';
import { usersApi } from '@/services/endpoints';
import type { TeamUser, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; emoji: string }> = {
  OWNER:     { label: 'Dono',       color: '#E85D2F', emoji: '👑' },
  MANAGER:   { label: 'Gerente',    color: '#8b5cf6', emoji: '🎯' },
  CASHIER:   { label: 'Caixa',      color: '#3b82f6', emoji: '💰' },
  WAITER:    { label: 'Garçom',     color: '#10b981', emoji: '🍽️' },
  KITCHEN:   { label: 'Cozinha',    color: '#f59e0b', emoji: '👨‍🍳' },
  DELIVERER: { label: 'Entregador', color: '#06b6d4', emoji: '🛵' },
};

const ALL_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DELIVERER'];

export default function EquipePage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [pwdUser, setPwdUser] = useState<TeamUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { toast.success('Funcionário removido'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro'),
  });

  const activeUsers = users.filter(u => u.isActive);
  const inactiveUsers = users.filter(u => !u.isActive);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display-font text-3xl text-white">Equipe</h1>
          <p className="text-stone-400 text-sm mt-1">{activeUsers.length} funcionário(s) ativo(s)</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Novo Funcionário
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-stone-500 py-16">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {activeUsers.map(u => (
            <UserCard key={u.id} user={u}
              onEdit={() => setEditUser(u)}
              onChangePassword={() => setPwdUser(u)}
              onToggleActive={() => toggleActive.mutate({ id: u.id, isActive: false })}
              onRemove={() => {
                if (confirm(`Remover ${u.name}?`)) remove.mutate(u.id);
              }} />
          ))}

          {inactiveUsers.length > 0 && (
            <>
              <div className="text-xs font-bold text-stone-500 uppercase tracking-wider pt-4 pb-1">Inativos</div>
              {inactiveUsers.map(u => (
                <UserCard key={u.id} user={u}
                  onEdit={() => setEditUser(u)}
                  onChangePassword={() => setPwdUser(u)}
                  onToggleActive={() => toggleActive.mutate({ id: u.id, isActive: true })}
                  onRemove={() => {
                    if (confirm(`Remover ${u.name}?`)) remove.mutate(u.id);
                  }} />
              ))}
            </>
          )}

          {users.length === 0 && (
            <div className="text-center py-16 text-stone-500">
              <Shield size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <UserFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
      {editUser && (
        <UserFormModal user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
      {pwdUser && (
        <ChangePasswordModal user={pwdUser} onClose={() => setPwdUser(null)} />
      )}
    </div>
  );
}

function UserCard({ user, onEdit, onChangePassword, onToggleActive, onRemove }: {
  user: TeamUser;
  onEdit: () => void;
  onChangePassword: () => void;
  onToggleActive: () => void;
  onRemove: () => void;
}) {
  const role = ROLE_CONFIG[user.role] || { label: user.role, color: '#9ca3af', emoji: '👤' };

  return (
    <div className={cn('p-4 rounded-xl flex items-center gap-4 transition-all',
      user.isActive ? 'bg-white/5 border border-white/8' : 'bg-white/2 border border-white/4 opacity-60'
    )}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: `${role.color}22`, border: `1.5px solid ${role.color}55` }}>
        {role.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white">{user.name}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${role.color}20`, color: role.color }}>
            {role.label}
          </span>
          {!user.isActive && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-700 text-stone-400">Inativo</span>
          )}
        </div>
        <div className="text-xs text-stone-400 mt-0.5">{user.email}</div>
        {user.lastLoginAt && (
          <div className="text-[11px] text-stone-600 mt-0.5">
            Último acesso: {new Date(user.lastLoginAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} title="Editar"
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-stone-400 hover:text-white hover:bg-white/10 transition-all">
          <Pencil size={14} />
        </button>
        <button onClick={onChangePassword} title="Trocar senha"
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-stone-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
          <KeyRound size={14} />
        </button>
        <button onClick={onToggleActive} title={user.isActive ? 'Desativar' : 'Ativar'}
          className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-all',
            user.isActive
              ? 'bg-white/5 text-stone-400 hover:text-amber-400 hover:bg-amber-500/10'
              : 'bg-white/5 text-stone-400 hover:text-green-400 hover:bg-green-500/10'
          )}>
          {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
        </button>
        <button onClick={onRemove} title="Excluir"
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function UserFormModal({ user, onClose, onSaved }: {
  user?: TeamUser; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role || 'CASHIER');
  const [pin, setPin] = useState('');
  const isEdit = !!user;

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return usersApi.update(user!.id, { name, email, role, ...(pin ? { pin } : {}) });
      }
      return usersApi.create({ name, email, password, role, ...(pin ? { pin } : {}) });
    },
    onSuccess: () => { toast.success(isEdit ? 'Funcionário atualizado' : 'Funcionário cadastrado'); onSaved(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao salvar'),
  });

  return (
    <Modal title={isEdit ? 'Editar Funcionário' : 'Novo Funcionário'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nome Completo</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input mt-1" placeholder="Ex: Maria Silva" autoFocus />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input mt-1" placeholder="funcionario@email.com" />
        </div>
        {!isEdit && (
          <div>
            <label className="label">Senha (mín. 6 caracteres)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input mt-1" placeholder="••••••••" />
          </div>
        )}
        <div>
          <label className="label">Cargo</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {ALL_ROLES.map(r => {
              const cfg = ROLE_CONFIG[r];
              return (
                <button key={r} onClick={() => setRole(r)}
                  className={cn('py-2.5 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all border',
                    role === r ? 'text-white' : 'bg-white/5 text-stone-400 border-white/5 hover:bg-white/10'
                  )}
                  style={role === r ? { background: `${cfg.color}33`, borderColor: `${cfg.color}66`, color: cfg.color } : {}}>
                  <span className="text-lg">{cfg.emoji}</span>{cfg.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="label">PIN de Acesso Rápido (4-6 dígitos, opcional)</label>
          <input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="input mt-1 text-center tracking-widest text-lg" placeholder="••••" />
          <p className="text-[11px] text-stone-500 mt-1">Permite login rápido pelo PIN na tela de acesso</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn flex-1 bg-white/5 text-stone-400 border border-white/10">Cancelar</button>
          <button onClick={() => save.mutate()}
            disabled={save.isPending || !name || !email || (!isEdit && password.length < 6)}
            className="btn-primary flex-1">
            {save.isPending ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ user, onClose }: { user: TeamUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: () => usersApi.changePassword(user.id, password),
    onSuccess: () => { toast.success('Senha alterada com sucesso'); onClose(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao alterar senha'),
  });

  const valid = password.length >= 6 && password === confirm;

  return (
    <Modal title="Trocar Senha" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-stone-400">Alterando senha de <strong className="text-white">{user.name}</strong></p>
        <div>
          <label className="label">Nova Senha (mín. 6 caracteres)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input mt-1" autoFocus placeholder="••••••••" />
        </div>
        <div>
          <label className="label">Confirmar Senha</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input mt-1" placeholder="••••••••" />
          {confirm && !valid && (
            <p className="text-xs text-red-400 mt-1">As senhas não coincidem ou são muito curtas</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn flex-1 bg-white/5 text-stone-400 border border-white/10">Cancelar</button>
          <button onClick={() => change.mutate()} disabled={!valid || change.isPending} className="btn-primary flex-1">
            {change.isPending ? 'Alterando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="slide-in w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 100%)', border: '1px solid rgba(232,93,47,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="display-font text-2xl text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
