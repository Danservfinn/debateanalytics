import { useEffect, useState } from 'react';
import api from '../services/api.js';

function BookingManagement() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get('/bookings').then(res => setBookings(res.data)).catch(err => console.error(err));
  }, []);

  const handleScan = () => {
    api.post('/bookings/scan').then(res => setBookings(res.data)).catch(err => console.error(err));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Booking Management</h2>
      <button onClick={handleScan} className="bg-blue-500 text-white p-2 rounded">Scan for New Bookings</button>
      <ul className="mt-4">
        {bookings.map((b, index) => (
          <li key={index}>{b.id}: {b.status} (Renter Rating: {b.rating})</li>
        ))}
      </ul>
    </div>
  );
}

export default BookingManagement; 