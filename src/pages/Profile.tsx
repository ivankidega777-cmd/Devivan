import React, { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, Loader2, LogOut, Check } from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function Profile() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  
  const [age, setAge] = useState<string>(userProfile?.age?.toString() || '');
  const [gender, setGender] = useState<string>(userProfile?.gender || '');
  const [interestedIn, setInterestedIn] = useState<string>(userProfile?.interestedIn || '');
  const [bio, setBio] = useState<string>(userProfile?.bio || '');
  const [photoURL, setPhotoURL] = useState<string>(userProfile?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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
      setSuccess('');
      
      const fileExt = file.name.split('.').pop();
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}.${fileExt}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setPhotoURL(downloadURL);
      
      // Auto-save the new photo URL
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { photoURL: downloadURL });
      await refreshProfile();
      
      setSuccess('Profile picture updated!');
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
      setSuccess('');
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
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser?.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-50 p-6 flex flex-col overflow-y-auto pb-24 relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-lime-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full mx-auto flex-1 flex flex-col relative z-10">
        <div className="flex justify-between items-center mb-8 mt-4">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <button 
            onClick={handleLogout}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-full transition-colors"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
          
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
            <p className="text-sm text-zinc-500 mt-3">Tap to change profile picture</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Display Name</label>
            <input
              type="text"
              value={userProfile?.displayName || ''}
              disabled
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
            />
            <p className="text-xs text-zinc-600">Name is synced from your Google account.</p>
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
            <label className="text-sm font-medium text-zinc-300">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a little about yourself..."
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all resize-none"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full bg-zinc-100 text-zinc-900 font-semibold py-4 rounded-full shadow-lg hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
