import { useEffect, useState } from 'react';
import api from '../services/api.js';

function RenterCommunication() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    api.get('/messages').then(res => setMessages(res.data)).catch(err => console.error(err));
  }, []);

  const handleGenerateReply = (messageId) => {
    api.post('/messages/reply', { messageId }).then(res => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reply: res.data.reply } : m));
    }).catch(err => console.error(err));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Renter Communication</h2>
      <ul className="mt-4">
        {messages.map((m) => (
          <li key={m.id}>
            {m.content}
            <button onClick={() => handleGenerateReply(m.id)} className="ml-2 bg-green-500 text-white p-1 rounded">Generate Reply</button>
            {m.reply && <p>Reply: {m.reply}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RenterCommunication; 