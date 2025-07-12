import { useState } from 'react';
import api from '../services/api.js';

function OperationsAutomation() {
  const [tripId, setTripId] = useState('');
  const [cleanerPhone, setCleanerPhone] = useState('');

  const handleSchedule = () => {
    api.post('/operations/schedule', { tripId, cleanerPhone }).then(res => alert('SMS Sent!')).catch(err => console.error(err));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Operations Automation</h2>
      <input type="text" placeholder="Trip ID" value={tripId} onChange={e => setTripId(e.target.value)} className="border p-2 m-2" />
      <input type="text" placeholder="Cleaner Phone" value={cleanerPhone} onChange={e => setCleanerPhone(e.target.value)} className="border p-2 m-2" />
      <button onClick={handleSchedule} className="bg-purple-500 text-white p-2 rounded">Schedule Cleaning</button>
    </div>
  );
}

export default OperationsAutomation; 