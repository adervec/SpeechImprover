import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useToast } from '../components/ui.jsx';
import { ATTRIBUTES } from '../lib/analysis/attributes.js';

const GENDERS = ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'];

function ageFromDob(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a >= 0 && a <= 130 ? a : null;
}

export default function Profile() {
  const { profile, updateProfile, rescoreAll } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ ...profile });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function toggleTarget(key) {
    setForm((f) => {
      const has = (f.targets || []).includes(key);
      return { ...f, targets: has ? f.targets.filter((k) => k !== key) : [...(f.targets || []), key] };
    });
  }

  async function save() {
    const genderChanged = form.gender !== profile.gender;
    updateProfile(form);
    if (genderChanged) {
      await rescoreAll({ ...profile, ...form });
      toast('Profile saved — resonance scores recalibrated to your profile.');
    } else {
      toast('Profile saved.');
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="card">
        <div className="card-head"><h3>Your profile</h3></div>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Used as reference context — e.g. resonant-depth scoring is calibrated relative to your profile.
          Stored only on this device. This app analyzes <b>English</b> speech only for now.
        </p>
        <div className="grid cols-2">
          <label className="field">Name<input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Optional" /></label>
          <label className="field">Date of birth
            <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob || ''} onChange={(e) => set('dob', e.target.value)} />
            {ageFromDob(form.dob) != null && <span className="tiny muted">Age {ageFromDob(form.dob)}</span>}
          </label>
          <label className="field">Gender (for resonance reference)
            <select value={form.gender || ''} onChange={(e) => set('gender', e.target.value)}>
              {GENDERS.map((g) => <option key={g} value={g}>{g || 'Select…'}</option>)}
            </select>
          </label>
          <label className="field">Native language
            <input value={form.nativeLanguage || ''} onChange={(e) => set('nativeLanguage', e.target.value)} placeholder="e.g. English" />
          </label>
          <label className="field">Country of birth<input value={form.countryOfBirth || ''} onChange={(e) => set('countryOfBirth', e.target.value)} placeholder="e.g. Canada" /></label>
        </div>
        <label className="field" style={{ marginTop: 14 }}>Notes / goals
          <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="What do you most want to improve, and why?" />
        </label>
      </div>

      <div className="card">
        <div className="card-head"><h3>Current focus targets</h3><span className="tiny muted">the guide recommends just two</span></div>
        <div className="pill-group">
          {ATTRIBUTES.map((a) => (
            <button key={a.key} className={`pill ${(form.targets || []).includes(a.key) ? 'active' : ''}`} onClick={() => toggleTarget(a.key)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <button className="btn primary" onClick={save}>Save profile</button>
      </div>
    </div>
  );
}
