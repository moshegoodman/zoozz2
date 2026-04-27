import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, Tooltip } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit2, Save, X, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const DEFAULT_RADIUS = 100;
const DEFAULT_COLOR = '#3b82f6';

function MapClickHandler({ onMapClick, isDrawing }) {
  useMapEvents({
    click(e) {
      if (isDrawing) onMapClick(e.latlng);
    },
  });
  return null;
}

const emptyForm = { name: '', description: '', lat: '', long: '', radius: DEFAULT_RADIUS, color: DEFAULT_COLOR, is_active: true };

export default function GeofenceManager() {
  const [geofences, setGeofences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapCenter, setMapCenter] = useState([31.7683, 35.2137]); // Jerusalem default

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const allowed = ['admin', 'chief of staff'];
      if (!allowed.includes((currentUser?.user_type || '').trim().toLowerCase()) && currentUser?.role !== 'admin') {
        setAccessDenied(true);
        return;
      }
      const data = await base44.entities.Geofence.list('-created_date', 200);
      setGeofences(data || []);
      if (data?.length > 0) {
        setMapCenter([data[0].lat, data[0].long]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = useCallback((latlng) => {
    setForm(prev => ({ ...prev, lat: latlng.lat.toFixed(6), long: latlng.lng.toFixed(6) }));
  }, []);

  const handleStartNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setIsDrawing(true);
  };

  const handleEdit = (gf) => {
    setForm({
      name: gf.name,
      description: gf.description || '',
      lat: gf.lat,
      long: gf.long,
      radius: gf.radius,
      color: gf.color || DEFAULT_COLOR,
      is_active: gf.is_active !== false,
    });
    setEditingId(gf.id);
    setShowForm(true);
    setIsDrawing(false);
    setMapCenter([gf.lat, gf.long]);
  };

  const handleCancel = () => {
    setShowForm(false);
    setIsDrawing(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name || !form.lat || !form.long || !form.radius) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        lat: parseFloat(form.lat),
        long: parseFloat(form.long),
        radius: parseFloat(form.radius),
        color: form.color,
        is_active: form.is_active,
        created_by_email: user?.email,
      };
      if (editingId) {
        await base44.entities.Geofence.update(editingId, payload);
      } else {
        await base44.entities.Geofence.create(payload);
      }
      await loadData();
      handleCancel();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this geofence?')) return;
    await base44.entities.Geofence.delete(id);
    setGeofences(prev => prev.filter(g => g.id !== id));
  };

  const handleToggleActive = async (gf) => {
    await base44.entities.Geofence.update(gf.id, { is_active: !gf.is_active });
    setGeofences(prev => prev.map(g => g.id === gf.id ? { ...g, is_active: !g.is_active } : g));
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-sm"><CardContent className="p-8 text-center text-gray-600">Access denied. Managers only.</CardContent></Card>
    </div>
  );

  // Preview circle for the form
  const previewLat = parseFloat(form.lat);
  const previewLong = parseFloat(form.long);
  const hasPreview = !isNaN(previewLat) && !isNaN(previewLong);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-500" /> Geofence Manager
            </h1>
            <p className="text-sm text-gray-500 mt-1">Draw named areas used for staff entry/exit tracking</p>
          </div>
          {!showForm && (
            <Button onClick={handleStartNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> New Geofence
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div style={{ height: 520 }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap contributors'
                  />
                  <MapClickHandler onMapClick={handleMapClick} isDrawing={isDrawing} />

                  {/* Existing geofences */}
                  {geofences.map(gf => (
                    <React.Fragment key={gf.id}>
                      <Circle
                        center={[gf.lat, gf.long]}
                        radius={gf.radius}
                        pathOptions={{
                          color: gf.color || DEFAULT_COLOR,
                          fillColor: gf.color || DEFAULT_COLOR,
                          fillOpacity: gf.is_active ? 0.15 : 0.05,
                          opacity: gf.is_active ? 0.8 : 0.3,
                          dashArray: gf.is_active ? null : '6 4',
                        }}
                        eventHandlers={{ click: () => handleEdit(gf) }}
                      >
                        <Tooltip permanent direction="center" className="geofence-label">
                          <span className="text-xs font-semibold">{gf.name}</span>
                        </Tooltip>
                      </Circle>
                      <Marker position={[gf.lat, gf.long]} />
                    </React.Fragment>
                  ))}

                  {/* Preview circle */}
                  {showForm && hasPreview && (
                    <Circle
                      center={[previewLat, previewLong]}
                      radius={parseFloat(form.radius) || DEFAULT_RADIUS}
                      pathOptions={{ color: form.color, fillColor: form.color, fillOpacity: 0.25, dashArray: '5 5' }}
                    />
                  )}
                </MapContainer>
              </div>
              {isDrawing && (
                <div className="bg-blue-50 border-t border-blue-200 px-4 py-2 text-sm text-blue-700 font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Click on the map to set the geofence center
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Form */}
            {showForm && (
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{editingId ? 'Edit Geofence' : 'New Geofence'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Household A" className="mt-1" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Latitude *</Label>
                      <Input value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))} placeholder="31.7683" className="mt-1 text-sm" />
                    </div>
                    <div>
                      <Label>Longitude *</Label>
                      <Input value={form.long} onChange={e => setForm(p => ({ ...p, long: e.target.value }))} placeholder="35.2137" className="mt-1 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label>Radius (meters) *</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={10}
                        max={5000}
                        value={form.radius}
                        onChange={e => setForm(p => ({ ...p, radius: e.target.value }))}
                        className="text-sm"
                      />
                      <span className="text-xs text-gray-400 whitespace-nowrap">{form.radius}m</span>
                    </div>
                    <input type="range" min={10} max={2000} step={10} value={form.radius}
                      onChange={e => setForm(p => ({ ...p, radius: e.target.value }))}
                      className="w-full mt-1 accent-blue-600" />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-125' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} className="flex items-center gap-2 text-sm text-gray-600">
                      {form.is_active
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      {form.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} disabled={isSaving || !form.name || !form.lat || !form.long} className="flex-1 bg-blue-600 hover:bg-blue-700">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Save
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Geofence list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Geofences ({geofences.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {geofences.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No geofences yet. Click "New Geofence" to start.</p>
                )}
                {geofences.map(gf => (
                  <div key={gf.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: gf.color || DEFAULT_COLOR }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gf.name}</p>
                      <p className="text-xs text-gray-400">{gf.radius}m radius</p>
                    </div>
                    <Badge variant={gf.is_active ? 'default' : 'secondary'} className={`text-xs ${gf.is_active ? 'bg-green-100 text-green-700' : ''}`}>
                      {gf.is_active ? 'On' : 'Off'}
                    </Badge>
                    <button onClick={() => handleToggleActive(gf)} className="p-1 text-gray-400 hover:text-gray-600">
                      {gf.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleEdit(gf)} className="p-1 text-gray-400 hover:text-blue-500">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(gf.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}