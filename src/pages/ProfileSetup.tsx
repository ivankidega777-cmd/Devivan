import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Loader2 } from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function ProfileSetup() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [age, setAge] = useState<string>(userProfile?.age?.toString() || '');
  const [gender, setGender] = useState<string>(userProfile?.gender || '');
  const [interestedIn, setInterestedIn] = useState<string>(userProfile?.interestedIn || '');
  const [bio, setBio] = useState<string>(userProfile?.bio || '');
  const [photoURL, setPhotoURL] = useState<string>(userProfile?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');
      
      const fileExt = file.name.split('.').pop();
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}.${fileExt}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setPhotoURL(downloadURL);
    } catch (err: any) {
      console.error("Error uploading image:", err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!age || !gender || !interestedIn) {
      setError('Please fill out all required fields.');
      return;
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      setError('Please enter a valid age (18+).');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      if (!currentUser) throw new Error("No user logged in");

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        age: ageNum,
        gender,
        interestedIn,
        bio,
        photoURL
      });

      await refreshProfile();
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser?.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 flex flex-col overflow-y-auto">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="mb-8 mt-12">
          <h1 className="text-3xl font-bold mb-2">Complete Profile</h1>
          <p className="text-zinc-400">Tell us a bit about yourself to find the best matches.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6 pb-8">
          
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="relative">
              <div 
                className="w-32 h-32 rounded-full overflow-hidden bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center cursor-pointer group relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Camera className="w-10 h-10 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                )}
                
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <p className="text-sm text-zinc-500 mt-3">Tap to upload profile picture</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 25"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">I am a</label>
            <div className="grid grid-cols-3 gap-3">
              {['male', 'female', 'other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                    gender === g
                      ? 'bg-lime-500 border-lime-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Interested in</label>
            <div className="grid grid-cols-3 gap-3">
              {['male', 'female', 'everyone'].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterestedIn(i)}
                  className={`py-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                    interestedIn === i
                      ? 'bg-lime-500 border-lime-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Bio (Optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a little about yourself..."
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all resize-none"
            />
          </div>

          <div className="flex-1" />

          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white font-semibold py-4 rounded-full shadow-lg shadow-lime-500/25 hover:shadow-lime-500/40 transition-all disabled:opacity-50 mt-8"
          >
            {loading ? 'Saving...' : 'Start Swiping'}
          </button>
        </form>
      </div>
    </div>
  );
}
