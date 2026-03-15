import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { motion, useMotionValue, useTransform, useAnimation } from 'motion/react';
import { Heart, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface Profile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  age: number;
  gender: string;
  interestedIn: string;
}

export default function Discover() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [matchesCount, setMatchesCount] = useState<number>(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const checkPayment = async () => {
      const sessionId = searchParams.get('session_id');
      const paymentSuccess = searchParams.get('payment_success');
      if (paymentSuccess === 'true' && sessionId && currentUser) {
        try {
          const res = await fetch('/api/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          const data = await res.json();
          if (data.paid) {
            await updateDoc(doc(db, 'users', currentUser.uid), { isPremium: true });
            await refreshProfile();
            setSearchParams({});
            alert('Payment successful! You now have premium access.');
          }
        } catch (err) {
          console.error('Payment verification failed', err);
        }
      }
    };
    checkPayment();
  }, [searchParams, currentUser]);

  useEffect(() => {
    const fetchMatchesCount = async () => {
      if (!currentUser) return;
      try {
        const matchesRef = collection(db, 'matches');
        const q = query(matchesRef, where('users', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        setMatchesCount(snapshot.size);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMatchesCount();
  }, [currentUser, currentIndex]);

  useEffect(() => {
    if (matchesCount >= 5 && !userProfile?.isPremium) {
      setShowPaywall(true);
    } else {
      setShowPaywall(false);
    }
  }, [matchesCount, userProfile]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!currentUser || !userProfile) return;

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const swipesRef = collection(db, 'swipes');
        const swipesQuery = query(swipesRef, where('fromUserId', '==', currentUser.uid));
        const swipesSnapshot = await getDocs(swipesQuery);
        const swipedIds = new Set(swipesSnapshot.docs.map(doc => doc.data().toUserId));

        const fetchedProfiles: Profile[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Profile;
          if (swipedIds.has(data.uid)) return;
          if (userProfile.interestedIn !== 'everyone' && data.gender !== userProfile.interestedIn) return;
          if (data.interestedIn !== 'everyone' && data.interestedIn !== userProfile.gender) return;
          fetchedProfiles.push(data);
        });

        setProfiles(fetchedProfiles);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users/swipes');
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [currentUser, userProfile]);

  const handleSwipe = async (direction: 'left' | 'right', profileId: string) => {
    if (!currentUser) return;
    
    const action = direction === 'right' ? 'like' : 'pass';
    
    try {
      await addDoc(collection(db, 'swipes'), {
        fromUserId: currentUser.uid,
        toUserId: profileId,
        action,
        createdAt: serverTimestamp()
      });

      if (action === 'like') {
        const swipesRef = collection(db, 'swipes');
        const matchQuery = query(
          swipesRef, 
          where('fromUserId', '==', profileId),
          where('toUserId', '==', currentUser.uid),
          where('action', '==', 'like')
        );
        const matchSnapshot = await getDocs(matchQuery);
        
        if (!matchSnapshot.empty) {
          const matchId = currentUser.uid < profileId 
            ? `${currentUser.uid}_${profileId}` 
            : `${profileId}_${currentUser.uid}`;
            
          await setDoc(doc(db, 'matches', matchId), {
            users: [currentUser.uid, profileId],
            createdAt: serverTimestamp()
          });
          
          alert(`It's a match with someone!`);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'swipes/matches');
    }

    setCurrentIndex(prev => prev + 1);
  };

  const handleUpgrade = async () => {
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.uid })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout session', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-lime-500">Finding matches...</div></div>;
  }

  if (showPaywall) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 bg-zinc-950 text-white">
        <div className="w-24 h-24 bg-gradient-to-tr from-lime-500 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-lime-500/20">
          <Heart className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-4">You're on fire! ❤️</h2>
        <p className="text-zinc-400 mb-8 max-w-md">
          You've reached the limit of 5 conversations. Upgrade to Premium to unlock unlimited matches and keep the sparks flying.
        </p>
        <button 
          onClick={handleUpgrade}
          className="w-full max-w-xs bg-white text-zinc-900 font-bold py-4 rounded-full hover:bg-zinc-200 transition-colors"
        >
          Upgrade Now - $5.00
        </button>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-zinc-700" />
        </div>
        <h2 className="text-2xl font-bold mb-2">You're all caught up!</h2>
        <p className="text-zinc-500">Check back later for more potential matches.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center bg-zinc-950">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1518599904199-0ca897819ddb?q=80&w=1920&auto=format&fit=crop" 
          alt="Background" 
          className="w-full h-full object-cover opacity-30"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90" />
      </div>

      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <h1 className="text-2xl font-bold text-white tracking-tight">Discover</h1>
      </div>

      <div className="relative w-full max-w-sm h-[70vh] perspective-1000 mt-12 z-10">
        {profiles.map((profile, index) => {
          if (index < currentIndex) return null;
          const isTop = index === currentIndex;
          
          return (
            <SwipeCard 
              key={profile.uid}
              profile={profile}
              isTop={isTop}
              onSwipe={(dir) => handleSwipe(dir, profile.uid)}
              zIndex={profiles.length - index}
            />
          );
        })}
      </div>
    </div>
  );
}

const SwipeCard: React.FC<{ profile: Profile, isTop: boolean, onSwipe: (dir: 'left'|'right') => void, zIndex: number }> = ({ profile, isTop, onSwipe, zIndex }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [0, -100], [0, 1]);
  const controls = useAnimation();

  useEffect(() => {
    controls.start({ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 20 });
  }, [isTop, controls]);

  const handleDragEnd = async (event: any, info: any) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      await controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } });
      onSwipe('right');
    } else if (info.offset.x < -threshold) {
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.3 } });
      onSwipe('left');
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  return (
    <motion.div
      className="absolute inset-0 w-full h-full rounded-3xl bg-zinc-900 shadow-2xl overflow-hidden border border-zinc-800"
      style={{ x, rotate, opacity: isTop ? opacity : 1, zIndex }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ scale: 0.95, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="relative w-full h-full">
        <img 
          src={profile.photoURL || `https://picsum.photos/seed/${profile.uid}/600/800`} 
          alt={profile.displayName}
          className="w-full h-full object-cover"
          draggable={false}
          referrerPolicy="no-referrer"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        {/* Swipe Indicators */}
        <motion.div 
          className="absolute top-10 left-8 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 rounded-xl transform -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </motion.div>
        <motion.div 
          className="absolute top-10 right-8 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rounded-xl transform rotate-12"
          style={{ opacity: nopeOpacity }}
        >
          NOPE
        </motion.div>

        {/* Profile Info */}
        <div className="absolute bottom-0 left-0 w-full p-6 text-white pointer-events-none">
          <div className="flex items-end space-x-3 mb-2">
            <h2 className="text-3xl font-bold">{profile.displayName}</h2>
            <span className="text-2xl font-light text-zinc-300">{profile.age}</span>
          </div>
          <p className="text-zinc-300 text-sm line-clamp-3">{profile.bio}</p>
        </div>
      </div>

      {/* Action Buttons (Only visible on top card) */}
      {isTop && (
        <div className="absolute bottom-24 left-0 w-full flex justify-center space-x-6 px-6 z-20">
          <button 
            onClick={() => {
              controls.start({ x: -500, opacity: 0, transition: { duration: 0.3 } }).then(() => onSwipe('left'));
            }}
            className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-red-500 shadow-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <button 
            onClick={() => {
              controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } }).then(() => onSwipe('right'));
            }}
            className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-green-500 shadow-xl hover:bg-zinc-800 transition-colors"
          >
            <Heart className="w-8 h-8 fill-current" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
