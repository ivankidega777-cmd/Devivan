import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Match {
  id: string;
  users: string[];
  createdAt: any;
  otherUser?: {
    uid: string;
    displayName: string;
    photoURL: string;
  };
}

import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function Matches() {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!currentUser) return;

      try {
        const matchesRef = collection(db, 'matches');
        const q = query(matchesRef, where('users', 'array-contains', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const fetchedMatches: Match[] = [];
        
        for (const document of querySnapshot.docs) {
          const data = document.data() as Match;
          data.id = document.id;
          
          const otherUserId = data.users.find(id => id !== currentUser.uid);
          
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              data.otherUser = { 
                uid: otherUserId, 
                ...userDoc.data() 
              } as any;
            }
          }
          
          fetchedMatches.push(data);
        }
        
        setMatches(fetchedMatches);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'matches');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [currentUser]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-lime-500">Loading matches...</div></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img 
          src="https://images.unsplash.com/photo-1518599904199-0ca897819ddb?q=80&w=1920&auto=format&fit=crop" 
          alt="Background" 
          className="w-full h-full object-cover opacity-20"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90" />
      </div>

      <div className="relative z-10">
        <h1 className="text-3xl font-bold mb-6 tracking-tight">Matches</h1>
      
      {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-zinc-900/80 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 border border-zinc-800">
            <span className="text-2xl">ð</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">No matches yet</h2>
          <p className="text-zinc-500">Keep swiping to find your spark!</p>
        </div>
      ) : (
          <div className="grid grid-cols-2 gap-4">
            {matches.map((match) => (
              <Link 
                key={match.id} 
                to={`/chat/${match.id}`}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden group shadow-xl border border-zinc-800/50"
              >
                <img 
                  src={match.otherUser?.photoURL || `https://picsum.photos/seed/${match.otherUser?.uid}/400/500`} 
                  alt={match.otherUser?.displayName}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full p-4">
                  <h3 className="text-lg font-bold text-white truncate drop-shadow-md">{match.otherUser?.displayName}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
