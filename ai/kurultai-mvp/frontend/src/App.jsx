import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase.js';
import Dashboard from './components/Dashboard.jsx';
import BookingManagement from './components/BookingManagement.jsx';
import RenterCommunication from './components/RenterCommunication.jsx';
import OperationsAutomation from './components/OperationsAutomation.jsx';
import Analytics from './components/Analytics.jsx';
import Settings from './components/Settings.jsx';

// Simple auth wrapper
function PrivateRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;
  return session ? children : <Navigate to="/login" />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else window.location = '/';
  };

  return (
    <div className="p-4">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="border p-2 m-2" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border p-2 m-2" />
      <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">Login</button>
    </div>
  );
}

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for confirmation');
  };

  return (
    <div className="p-4">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="border p-2 m-2" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border p-2 m-2" />
      <button onClick={handleSignup} className="bg-green-500 text-white p-2 rounded">Signup</button>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/bookings" element={<PrivateRoute><BookingManagement /></PrivateRoute>} />
        <Route path="/messages" element={<PrivateRoute><RenterCommunication /></PrivateRoute>} />
        <Route path="/operations" element={<PrivateRoute><OperationsAutomation /></PrivateRoute>} />
        <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      </Routes>
    </div>
  );
}

export default App; 