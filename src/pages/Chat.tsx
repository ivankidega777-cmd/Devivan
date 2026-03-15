import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Send } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const fetchMatchDetails = async () => {
      if (!matchId || !currentUser) return;
      
      try {
        const matchDoc = await getDoc(doc(db, 'matches', matchId));
        if (matchDoc.exists()) {
          const data = matchDoc.data();
          const otherId = data.users.find((id: string) => id !== currentUser.uid);
          if (otherId) {
            const userDoc = await getDoc(doc(db, 'users', otherId));
            if (userDoc.exists()) {
              setOtherUser(userDoc.data());
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `matches/${matchId}`);
      }
    };

    fetchMatchDetails();
  }, [matchId, currentUser]);

  useEffect(() => {
    if (!matchId || !currentUser) return;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('matchId', '==', matchId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as Message;
          
          // Trigger notification for new messages from the other user
          if (!initialLoadRef.current && data.senderId !== currentUser.uid && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('New Message', {
              body: data.text,
              icon: '/favicon.ico' // fallback icon
            });
          }
        }
      });

      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      
      setMessages(fetchedMessages);
      
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
      
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return unsubscribe;
  }, [matchId, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !matchId) return;

    try {
      await addDoc(collection(db, 'messages'), {
        matchId,
        senderId: currentUser.uid,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        {otherUser ? (
          <div className="flex items-center space-x-3">
            <img 
              src={otherUser.photoURL || `https://picsum.photos/seed/${otherUser.uid}/100/100`} 
              alt={otherUser.displayName}
              className="w-10 h-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
            <h2 className="font-semibold text-lg">{otherUser.displayName}</h2>
          </div>
        ) : (
          <div className="animate-pulse h-6 w-32 bg-zinc-800 rounded" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  isMe 
                    ? 'bg-lime-500 text-white rounded-tr-sm' 
                    : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
                }`}
              >
                <p className="break-words">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800 pb-safe">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-800 border-none rounded-full px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 transition-all"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-lime-500 text-white rounded-full disabled:opacity-50 disabled:bg-zinc-800 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
