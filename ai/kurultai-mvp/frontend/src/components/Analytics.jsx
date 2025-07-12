import { useEffect, useState } from 'react';
import api from '../services/api.js';

function Analytics() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.get('/analytics').then(res => setStats(res.data)).catch(err => console.error(err));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Analytics</h2>
      <p>Occupancy Rate: {stats.occupancy}%</p>
      <p>Suggestions: {stats.suggestions}</p>
    </div>
  );
}

export default Analytics; 