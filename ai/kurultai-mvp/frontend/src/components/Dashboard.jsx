import { Link } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Kurultai Dashboard</h1>
      <p>Connected Vehicles: 1 (Free Tier)</p>
      <nav className="mt-4">
        <Link to="/bookings" className="block">Bookings</Link>
        <Link to="/messages" className="block">Messages</Link>
        <Link to="/operations" className="block">Operations</Link>
        <Link to="/analytics" className="block">Analytics</Link>
        <Link to="/settings" className="block">Settings</Link>
      </nav>
      <p>Recent Activity: No new bookings.</p>
    </div>
  );
}

export default Dashboard; 