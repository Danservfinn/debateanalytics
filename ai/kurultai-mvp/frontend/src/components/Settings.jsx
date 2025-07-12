import { useState } from 'react';
import api from '../services/api.js';

function Settings() {
  const [turoEmail, setTuroEmail] = useState('');
  const [turoPassword, setTuroPassword] = useState('');

  const handleSaveCredentials = () => {
    api.post('/settings/credentials', { turoEmail, turoPassword }).then(res => alert('Saved!')).catch(err => console.error(err));
  };

  const handleUpgrade = (tier) => {
    api.post('/billing/upgrade', { tier }).then(res => window.location = res.data.url).catch(err => console.error(err));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Settings</h2>
      <input type="email" placeholder="Turo Email" value={turoEmail} onChange={e => setTuroEmail(e.target.value)} className="border p-2 m-2" />
      <input type="password" placeholder="Turo Password" value={turoPassword} onChange={e => setTuroPassword(e.target.value)} className="border p-2 m-2" />
      <button onClick={handleSaveCredentials} className="bg-blue-500 text-white p-2 rounded">Save Turo Credentials</button>
      <div className="mt-4">
        <button onClick={() => handleUpgrade('basic')} className="bg-green-500 text-white p-2 rounded mr-2">Upgrade to Basic ($49/mo)</button>
        <button onClick={() => handleUpgrade('pro')} className="bg-green-500 text-white p-2 rounded">Upgrade to Pro ($99/mo)</button>
      </div>
    </div>
  );
}

export default Settings; 