import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Camera,
  CheckCircle,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import CustomDropdown from '../components/CustomDropdown';
import api, { getApiErrorMessage } from '../services/api';

const SOURCE_TYPES = [
  { value: 'webcam', label: 'Webcam' },
  { value: 'rtsp', label: 'RTSP' },
  { value: 'video_file', label: 'Video File' },
];

const emptyForm = {
  code: '',
  name: '',
  source_type: 'webcam',
  source_url: '',
  location: '',
  is_active: true,
};

const formatDateTime = (value) => {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const CameraManagement = () => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [deleteCamera, setDeleteCamera] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [demoVideos, setDemoVideos] = useState([]);
  const [currentSource, setCurrentSource] = useState(null);

  const filteredCameras = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return cameras;
    return cameras.filter((camera) => (
      camera.code.toLowerCase().includes(needle) ||
      camera.name.toLowerCase().includes(needle) ||
      (camera.location || '').toLowerCase().includes(needle) ||
      camera.source_type.toLowerCase().includes(needle)
    ));
  }, [cameras, searchTerm]);

  const fetchCameras = async () => {
    setLoading(true);
    try {
      const response = await api.get('/cameras/');
      if (response.data.code === 200) {
        setCameras(response.data.result || []);
      }
      const sourcesResponse = await api.get('/helmet/camera-sources');
      if (sourcesResponse.data.code === 200) {
        setCurrentSource(sourcesResponse.data.result?.current || null);
      }
    } catch (error) {
      console.error('Failed to load cameras:', error);
      toast.error(getApiErrorMessage(error, 'Failed to load cameras'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoVideos = async () => {
    try {
      const response = await api.get('/cameras/demo-videos');
      if (response.data.code === 200) {
        setDemoVideos(response.data.result || []);
      }
    } catch (error) {
      console.error('Failed to load demo videos:', error);
      setDemoVideos([]);
    }
  };

  useEffect(() => {
    fetchCameras();
    fetchDemoVideos();
  }, []);

  const openCreateModal = () => {
    setEditingCamera(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (camera) => {
    setEditingCamera(camera);
    setFormData({
      code: camera.code,
      name: camera.name,
      source_type: camera.source_type,
      source_url: camera.source_url,
      location: camera.location || '',
      is_active: camera.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.source_url.trim()) {
      toast.error('Code, name, and source URL are required');
      return;
    }
    if (formData.source_type === 'video_file' && demoVideos.length === 0) {
      toast.error('No demo videos are available');
      return;
    }

    setSaving(true);
    const payload = {
      ...formData,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      source_url: formData.source_url.trim(),
      location: formData.location.trim() || null,
    };

    try {
      if (editingCamera) {
        await api.patch(`/cameras/${editingCamera.id}`, payload);
        toast.success('Camera updated');
      } else {
        await api.post('/cameras/', payload);
        toast.success('Camera created');
      }
      setShowModal(false);
      fetchCameras();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Camera save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (camera) => {
    const isCurrentStreamingCamera = camera.code === currentSource && camera.is_active;
    if (isCurrentStreamingCamera) {
      const confirmed = window.confirm(
        `Camera ${camera.code} is currently used in Live Monitoring. Disabling it will stop the current stream. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      await api.patch(`/cameras/${camera.id}/status?is_active=${!camera.is_active}`);
      toast.success(`Camera ${camera.is_active ? 'disabled' : 'enabled'}`);
      fetchCameras();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Status update failed'));
    }
  };

  const handleTest = async (camera) => {
    setTestingId(camera.id);
    try {
      const response = await api.post(`/cameras/${camera.id}/test`);
      toast.success(response.data.message || 'Camera tested');
      fetchCameras();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Camera test failed'));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteCamera) return;
    try {
      await api.delete(`/cameras/${deleteCamera.id}`);
      toast.success('Camera deleted');
      setDeleteCamera(null);
      fetchCameras();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const demoVideoOptions = demoVideos.map((video) => ({
    value: video.source_url,
    label: video.name,
  }));

  const handleSourceTypeChange = (sourceType) => {
    const nextSourceUrl = sourceType === 'video_file'
      ? (demoVideoOptions[0]?.value || '')
      : '';
    setFormData({ ...formData, source_type: sourceType, source_url: nextSourceUrl });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Camera Management</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            Source Configuration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1 min-w-[220px] md:max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:opacity-30"
            />
          </div>

          <button
            onClick={fetchCameras}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-on-surface/10 text-on-surface-variant hover:text-on-surface hover:border-primary/30 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-background font-bold rounded-md text-[10px] hover:bg-primary/90 transition-all uppercase tracking-[0.15em] primary-glow shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Camera
          </button>
        </div>
      </div>

      <div className="surface-1 border border-on-surface/5 rounded-md overflow-hidden tech-glow min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-surface-low text-on-surface-variant text-[10px] font-mono uppercase tracking-widest border-b border-on-surface/5">
              <tr>
                <th className="px-6 py-5 font-bold">Camera</th>
                <th className="px-6 py-5 font-bold">Source</th>
                <th className="px-6 py-5 font-bold">Location</th>
                <th className="px-6 py-5 font-bold">Status</th>
                <th className="px-6 py-5 font-bold">Last Check</th>
                <th className="px-6 py-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5">
              {loading ? (
                Array(5).fill(0).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-5"><Skeleton width="160px" height="32px" /></td>
                    <td className="px-6 py-5"><Skeleton width="180px" height="32px" /></td>
                    <td className="px-6 py-5"><Skeleton width="140px" height="14px" /></td>
                    <td className="px-6 py-5"><Skeleton width="90px" height="20px" /></td>
                    <td className="px-6 py-5"><Skeleton width="120px" height="14px" /></td>
                    <td className="px-6 py-5 text-right"><Skeleton width="220px" height="36px" className="inline-block" /></td>
                  </tr>
                ))
              ) : filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <EmptyState icon={Camera} title="No cameras found" message="No camera sources match your current filters." />
                  </td>
                </tr>
              ) : (
                filteredCameras.map((camera) => (
                  <tr key={camera.id} className="hover:bg-primary/5 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface uppercase tracking-tight leading-none mb-1.5">{camera.name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] text-on-surface-variant font-mono">{camera.code}</p>
                            {camera.code === currentSource && (
                              <span className="px-2 py-0.5 rounded-sm bg-secondary/10 border border-secondary/20 text-secondary text-[8px] font-bold uppercase tracking-widest">
                                Streaming
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <span className="inline-flex px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold font-mono uppercase tracking-widest">
                          {camera.source_type}
                        </span>
                        <p className="text-[10px] text-on-surface-variant font-mono max-w-[260px] truncate" title={camera.source_url}>
                          {camera.source_url}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 opacity-50" />
                        {camera.location || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${camera.is_active ? 'bg-secondary' : 'bg-error'}`}></div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${camera.is_active ? 'text-secondary' : 'text-error'}`}>
                            {camera.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">
                          Check: {camera.last_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-mono text-on-surface-variant whitespace-nowrap">
                      {formatDateTime(camera.last_checked_at)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleTest(camera)}
                          disabled={testingId === camera.id}
                          className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-all border border-on-surface/10 disabled:opacity-50"
                          title="Test connection"
                        >
                          {testingId === camera.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleToggle(camera)}
                          className={`p-2.5 text-on-surface-variant rounded-md transition-all border border-on-surface/10 ${
                            camera.is_active
                              ? 'hover:text-error hover:bg-error/10 hover:border-error/20'
                              : 'hover:text-secondary hover:bg-secondary/10 hover:border-secondary/20'
                          }`}
                          title={camera.is_active ? 'Disable camera' : 'Enable camera'}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(camera)}
                          className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-all border border-on-surface/10"
                          title="Edit camera"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCamera(camera)}
                          className="p-2.5 text-error hover:bg-error/10 rounded-md transition-all border border-error/20"
                          title="Delete camera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-xl surface-1 border border-on-surface/10 rounded-lg tech-glow animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-on-surface/5 bg-surface-low rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded border border-primary/20">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-on-surface uppercase tracking-tight">
                  {editingCamera ? 'Edit Camera' : 'Add Camera'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold tracking-widest">Code</span>
                  <input
                    value={formData.code}
                    onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                    placeholder="CAM_1"
                    className="w-full px-3 py-2.5 bg-surface border border-on-surface/10 rounded-md text-sm outline-none focus:border-primary/50 transition-all"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold tracking-widest">Source Type</span>
                  <CustomDropdown
                    options={SOURCE_TYPES}
                    value={formData.source_type}
                    onChange={handleSourceTypeChange}
                    labelPrefix="Type"
                    headerText="Source Type"
                    align="left"
                    width="w-full"
                    containerClassName="w-full"
                    buttonClassName="w-full justify-between px-3 py-2.5"
                    compact
                  />
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold tracking-widest">Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  placeholder="Main Gate"
                  className="w-full px-3 py-2.5 bg-surface border border-on-surface/10 rounded-md text-sm outline-none focus:border-primary/50 transition-all"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold tracking-widest">
                  {formData.source_type === 'video_file' ? 'Demo Video' : 'Source URL'}
                </span>
                {formData.source_type === 'video_file' ? (
                  demoVideoOptions.length > 0 ? (
                    <CustomDropdown
                      options={demoVideoOptions}
                      value={formData.source_url}
                      onChange={(sourceUrl) => setFormData({ ...formData, source_url: sourceUrl })}
                      labelPrefix="Video"
                      headerText="Demo Video"
                      align="left"
                      width="w-full"
                      containerClassName="w-full"
                      buttonClassName="w-full justify-between px-3 py-2.5"
                      compact
                    />
                  ) : (
                    <div className="w-full px-3 py-3 bg-surface border border-error/20 rounded-md text-[10px] font-mono uppercase tracking-widest text-error">
                      No demo videos found in static/demo
                    </div>
                  )
                ) : (
                  <input
                    value={formData.source_url}
                    onChange={(event) => setFormData({ ...formData, source_url: event.target.value })}
                    placeholder={formData.source_type === 'webcam' ? '0' : 'rtsp://user:pass@host/stream'}
                    className="w-full px-3 py-2.5 bg-surface border border-on-surface/10 rounded-md text-sm outline-none focus:border-primary/50 transition-all font-mono"
                  />
                )}
              </label>

              <label className="space-y-2 block">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold tracking-widest">Location</span>
                <input
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  placeholder="Main entrance"
                  className="w-full px-3 py-2.5 bg-surface border border-on-surface/10 rounded-md text-sm outline-none focus:border-primary/50 transition-all"
                />
              </label>

              <label className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })}
                  className="w-4 h-4 rounded appearance-none border border-on-surface/30 bg-surface checked:bg-primary checked:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer transition-colors"
                />
                <span className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest cursor-pointer select-none">
                  Active camera
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-primary text-background font-bold uppercase tracking-[0.25em] rounded-md primary-glow hover:bg-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save Camera
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteCamera && (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setDeleteCamera(null)}></div>
          <div className="relative w-full max-w-sm surface-1 border border-error/20 rounded-lg p-8 tech-glow animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-error/20">
              <Trash2 className="w-8 h-8 text-error" />
            </div>
            <h2 className="text-xl font-bold text-on-surface uppercase font-mono tracking-widest">Delete Camera</h2>
            <p className="text-sm text-on-surface-variant my-8 leading-relaxed">
              {deleteCamera.code === currentSource
                ? `Camera ${deleteCamera.code} is currently used in Live Monitoring. Deleting it will stop the current stream. Historical records will keep their camera reference.`
                : `Soft delete ${deleteCamera.code}? Historical records will keep their camera reference.`}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteCamera(null)}
                className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-error text-background font-bold uppercase tracking-widest text-[10px] rounded-md hover:bg-error/90 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraManagement;
