import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  UserCheck,
  ShieldAlert,
  Loader2,
  X,
  Eye,
  EyeOff,
  Lock,
  User,
  CheckCircle,
  IdCard,
  Trash2,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  AlertTriangle,
  Search,
  Filter,
  Activity,
  UserRoundCheck,
  UserRoundX
} from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import CustomDropdown from '../components/CustomDropdown';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'guard', label: 'Guard' },
];

const USER_ROLE_OPTIONS = [
  { value: 'guard', label: 'Guard' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const VERIFIED_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');

  // Advanced Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVerified, setFilterVerified] = useState('all');

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'guard',
    password: '',
    password_confirm: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Dropdown & Action State
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    // Close menu when clicking outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/');
      if (response.data.code === 200) {
        setUsers(response.data.result);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(getApiErrorMessage(err, 'Access denied: admin access required'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (!user.id) {
      toast.error('Error: User ID missing');
      return;
    }
    try {
      const response = await api.patch(`/users/${user.id}/status?is_active=${!user.is_active}`);
      if (response.data.code === 200) {
        toast.success(`User ${user.username} ${user.is_active ? 'deactivated' : 'activated'} successfully`);
        fetchUsers();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Update failed'));
    }
    setActiveMenuId(null);
  };

  const handleDeleteUser = async (user_id) => {
    try {
      const response = await api.delete(`/users/${user_id}`);
      if (response.data.code === 200) {
        toast.success('User deleted successfully');
        fetchUsers();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Deletion failed'));
    }
    setDeleteConfirmId(null);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.username) errors.username = 'Username is required';
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email format';

    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 8) errors.password = 'Minimum 8 characters required';

    if (formData.password !== formData.password_confirm) {
      errors.password_confirm = 'Confirmation password does not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setRegLoading(true);
    try {
      const response = await api.post('/auth/register', formData);
      if (response.data.code === 201) {
        toast.success('User registered successfully.');
        setIsModalOpen(false);
        setFormData({
          username: '',
          email: '',
          full_name: '',
          role: 'guard',
          password: '',
          password_confirm: ''
        });
        fetchUsers(); // Refresh list
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setRegLoading(false);
    }
  };

  // Aggregated Filter logic
  const filteredUsers = users.filter(user => {
    // 1. Search Filter
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      user.username.toLowerCase().includes(searchLow) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchLow)) ||
      user.email.toLowerCase().includes(searchLow) ||
      (user.id && user.id.toString().includes(searchLow))
    );

    // 2. Role Filter
    const matchesRole = filterRole === 'all' || user.role === filterRole;

    // 3. Status Filter
    const matchesStatus = filterStatus === 'all' || (
      filterStatus === 'active' ? user.is_active : !user.is_active
    );

    // 4. Verified Filter
    const matchesVerified = filterVerified === 'all' || (
      filterVerified === 'verified' ? user.is_verified : !user.is_verified
    );

    return matchesSearch && matchesRole && matchesStatus && matchesVerified;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">User Management</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            User Administration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search Filter */}
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:opacity-30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Role Filter */}
            <CustomDropdown
              options={ROLE_OPTIONS}
              value={filterRole}
              onChange={setFilterRole}
              icon={Shield}
              labelPrefix="Role"
              headerText="Role Filter"
              align="left"
              width="w-40"
              compact
            />

            {/* Status Filter */}
            <CustomDropdown
              options={STATUS_OPTIONS}
              value={filterStatus}
              onChange={setFilterStatus}
              icon={Activity}
              labelPrefix="Status"
              headerText="Status Filter"
              align="left"
              width="w-44"
              compact
            />

            {/* Verified Filter */}
            <CustomDropdown
              options={VERIFIED_OPTIONS}
              value={filterVerified}
              onChange={setFilterVerified}
              icon={CheckCircle}
              labelPrefix="Verified"
              headerText="Verification Filter"
              align="left"
              width="w-52"
              compact
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-background font-bold rounded-md text-[10px] hover:bg-primary/90 transition-all uppercase tracking-[0.15em] primary-glow shrink-0 ml-auto"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      {/* Container fix: overflow-visible to prevent dropdown clipping, min-height to ensure space */}
      <div className="surface-1 border border-on-surface/5 rounded-md overflow-visible tech-glow min-h-[500px]">
        {/* We use overflow-x-auto only if the screen is very small, but table itself is visible */}
        <div className="overflow-x-auto lg:overflow-visible rounded-md">
          <table className="w-full text-left min-w-[1000px] lg:min-w-full">
            <thead className="bg-surface-low text-on-surface-variant text-[10px] font-mono uppercase tracking-widest border-b border-on-surface/5">
              <tr>
                <th className="px-6 py-5 font-bold">User</th>
                <th className="px-6 py-5 font-bold">Credentials</th>
                <th className="px-6 py-5 font-bold">Role</th>
                <th className="px-6 py-5 font-bold">Verified</th>
                <th className="px-6 py-5 font-bold">Status</th>
                <th className="px-6 py-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-on-surface/5">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <Skeleton width="48px" height="48px" rounded="rounded" />
                        <div>
                          <Skeleton width="120px" height="14px" className="mb-2" />
                          <Skeleton width="60px" height="10px" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Skeleton width="100px" height="14px" className="mb-2" />
                      <Skeleton width="150px" height="10px" />
                    </td>
                    <td className="px-6 py-5"><Skeleton width="60px" height="20px" /></td>
                    <td className="px-6 py-5"><Skeleton width="80px" height="16px" /></td>
                    <td className="px-6 py-5"><Skeleton width="70px" height="16px" /></td>
                    <td className="px-6 py-5 text-right"><Skeleton width="32px" height="32px" className="inline-block" rounded="rounded-md" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <EmptyState
                      icon={Search}
                      title="No users found"
                      message="No accounts match your current search or filter parameters."
                    />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-primary/5 transition-all group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded bg-surface-low flex items-center justify-center border border-on-surface/10 text-primary font-bold text-sm tracking-tighter overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (user.full_name || user.username || 'U').slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface uppercase tracking-tight leading-none mb-1.5">{user.full_name || user.username}</p>
                          <p className="text-[10px] text-on-surface-variant font-mono">ID: {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-sm font-mono text-on-surface tracking-tighter">@{user.username}</p>
                        <p className="text-[10px] text-on-surface-variant flex items-center gap-1.5">
                          <Mail className="w-3 h-3 opacity-50" /> {user.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${user.role === 'admin'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {user.is_verified ? (
                        <div className="flex items-center gap-2 text-secondary">
                          <UserRoundCheck className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-on-surface-variant opacity-40">
                          <UserRoundX className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Unverified</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-secondary animate-pulse shadow-[0_0_8px_rgba(var(--secondary-rgb),0.5)]' : 'bg-error'}`}></div>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${user.is_active ? 'text-secondary' : 'text-error'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right relative overflow-visible">
                      <div className="inline-block" ref={activeMenuId === user.id ? menuRef : null}>
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                          className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-md transition-all border border-transparent hover:border-on-surface/10"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === user.id && (
                          <div className="absolute right-0 top-14 w-48 surface-2 border border-on-surface/10 rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-2 bg-surface-low border-b border-on-surface/5">
                              <span className="text-[8px] font-mono text-on-surface-variant uppercase tracking-widest opacity-50">Actions</span>
                            </div>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-on-surface hover:bg-primary/10 hover:text-primary transition-all text-left"
                            >
                              <span>{user.is_active ? 'Deactivate' : 'Activate'}</span>
                              {user.is_active ? <LockIcon className="w-3.5 h-3.5 text-error" /> : <UnlockIcon className="w-3.5 h-3.5 text-secondary" />}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmId(user.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-error hover:bg-error/10 transition-all text-left border-t border-on-surface/5"
                            >
                              <span>Delete</span>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setDeleteConfirmId(null)}></div>
          <div className="relative w-full max-w-sm surface-1 border border-error/20 rounded-lg p-8 tech-glow animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-error/20">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h2 className="text-xl font-bold text-on-surface uppercase font-mono tracking-widest">Delete User</h2>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">Confirm deletion</p>
            <p className="text-sm text-on-surface-variant my-8 leading-relaxed">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all"
              >
                Abort
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmId)}
                className="flex-1 py-3 bg-error text-background font-bold uppercase tracking-widest text-[10px] rounded-md primary-glow hover:bg-error/90 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

          <div className="relative w-full max-w-lg surface-1 border border-on-surface/10 rounded-lg tech-glow modal-enter">
            <div className="flex items-center justify-between p-6 border-b border-on-surface/5 bg-surface-low rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded border border-primary/20">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-on-surface uppercase tracking-tight">Register New User</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleRegister} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-50" />
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-surface border rounded-md text-sm outline-none transition-all ${formErrors.username ? 'border-error/50' : 'border-on-surface/10 focus:border-primary/50'
                        }`}
                      placeholder="username"
                    />
                  </div>
                  {formErrors.username && <p className="text-[10px] text-error font-mono px-1">{formErrors.username}</p>}
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Clearance Level</label>
                  <CustomDropdown
                    options={USER_ROLE_OPTIONS}
                    value={formData.role}
                    onChange={(role) => setFormData({ ...formData, role })}
                    icon={Shield}
                    labelPrefix="Level"
                    headerText="Clearance Level"
                    align="left"
                    width="w-full"
                    containerClassName="w-full"
                    buttonClassName="w-full justify-between px-4 py-2.5"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-50" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2.5 bg-surface border rounded-md text-sm outline-none transition-all ${formErrors.email ? 'border-error/50' : 'border-on-surface/10 focus:border-primary/50'
                      }`}
                    placeholder="user@example.com"
                  />
                </div>
                {formErrors.email && <p className="text-[10px] text-error font-mono px-1">{formErrors.email}</p>}
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Full Name (Optional)</label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-50" />
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-on-surface/10 rounded-md text-sm outline-none focus:border-primary/50 transition-all"
                    placeholder="Full Operational Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-50" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full pl-10 pr-10 py-2.5 bg-surface border rounded-md text-sm outline-none transition-all ${formErrors.password ? 'border-error/50' : 'border-on-surface/10 focus:border-primary/50'
                        }`}
                      placeholder="Min 8 chars"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-[10px] text-error font-mono px-1">{formErrors.password}</p>}
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1 tracking-widest">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant opacity-50" />
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={formData.password_confirm}
                      onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                      className={`w-full pl-10 pr-10 py-2.5 bg-surface border rounded-md text-sm outline-none transition-all ${formErrors.password_confirm ? 'border-error/50' : 'border-on-surface/10 focus:border-primary/50'
                        }`}
                      placeholder="Repeat Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {formErrors.password_confirm && <p className="text-[10px] text-error font-mono px-1">{formErrors.password_confirm}</p>}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3.5 bg-primary text-background font-bold uppercase tracking-[0.25em] rounded-md primary-glow hover:bg-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Finalize Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Basic modal animations */}
      <style>{`
        .modal-enter {
          animation: modal-enter 0.3s ease-out;
        }
        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.95); translateY(-20px); }
          to { opacity: 1; transform: scale(1); translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
